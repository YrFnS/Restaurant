import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import {
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";

const reservationUpdateSchema = z
  .object({
    status: z
      .enum(["confirmed", "seated", "completed", "cancelled", "no_show"])
      .optional(),
    tableId: z.string().trim().min(1).max(191).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

function accessToken(req: NextRequest): string | null {
  const queryToken = new URL(req.url).searchParams.get("token");
  if (queryToken) return queryToken;
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerAuthorized = verifyCustomerAccessToken(
      "reservation",
      id,
      accessToken(req)
    );

    if (!customerAuthorized) {
      const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
      if ("response" in auth) return auth.response;
    }

    const parsed = reservationUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid reservation update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await db.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        tableId: true,
        partySize: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Reservation not found", code: "RESERVATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (customerAuthorized) {
      if (
        parsed.data.status !== "cancelled" ||
        parsed.data.tableId !== undefined ||
        parsed.data.notes !== undefined ||
        existing.status !== "confirmed"
      ) {
        return NextResponse.json(
          {
            error: "This reservation can no longer be changed online",
            code: "CUSTOMER_RESERVATION_CHANGE_DENIED",
          },
          { status: 409 }
        );
      }
    }

    if (
      parsed.data.status &&
      parsed.data.status !== existing.status &&
      !(ALLOWED_TRANSITIONS[existing.status] || []).includes(parsed.data.status)
    ) {
      return NextResponse.json(
        {
          error: `Reservation cannot move from ${existing.status} to ${parsed.data.status}`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 409 }
      );
    }

    if (parsed.data.tableId) {
      const table = await db.restaurantTable.findUnique({
        where: { id: parsed.data.tableId },
        select: { id: true, capacity: true },
      });
      if (!table || table.capacity < existing.partySize) {
        return NextResponse.json(
          {
            error: "The selected table cannot accommodate this reservation",
            code: "INVALID_TABLE_ASSIGNMENT",
          },
          { status: 409 }
        );
      }
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: parsed.data,
      include: { table: true },
    });
    return NextResponse.json(
      { reservation },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Reservation access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    console.error("[reservations] Failed to update reservation", error);
    return NextResponse.json(
      { error: "Unable to update reservation", code: "RESERVATION_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const existing = await db.reservation.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Reservation not found", code: "RESERVATION_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (["completed", "cancelled", "no_show"].includes(existing.status)) {
      return NextResponse.json({ ok: true });
    }

    await db.reservation.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reservations] Failed to cancel reservation", error);
    return NextResponse.json(
      { error: "Unable to cancel reservation", code: "RESERVATION_CANCEL_FAILED" },
      { status: 500 }
    );
  }
}
