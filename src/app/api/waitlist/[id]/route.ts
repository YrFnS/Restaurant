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

const waitlistUpdateSchema = z
  .object({
    status: z.enum(["waiting", "notified", "seated", "cancelled", "no_show"]),
  })
  .strict();

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  waiting: ["notified", "seated", "cancelled", "no_show"],
  notified: ["seated", "cancelled", "no_show"],
  seated: [],
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
      "waitlist",
      id,
      accessToken(req)
    );

    if (!customerAuthorized) {
      const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
      if ("response" in auth) return auth.response;
    }

    const parsed = waitlistUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid waitlist update", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const existing = await db.waitlistEntry.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Waitlist entry not found", code: "WAITLIST_ENTRY_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (customerAuthorized) {
      if (
        parsed.data.status !== "cancelled" ||
        !["waiting", "notified"].includes(existing.status)
      ) {
        return NextResponse.json(
          {
            error: "This waitlist entry can no longer be changed online",
            code: "CUSTOMER_WAITLIST_CHANGE_DENIED",
          },
          { status: 409 }
        );
      }
    }

    if (
      parsed.data.status !== existing.status &&
      !(ALLOWED_TRANSITIONS[existing.status] || []).includes(parsed.data.status)
    ) {
      return NextResponse.json(
        {
          error: `Waitlist entry cannot move from ${existing.status} to ${parsed.data.status}`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 409 }
      );
    }

    const entry = await db.waitlistEntry.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "seated" ? { seatedAt: new Date() } : {}),
        ...(parsed.data.status === "notified"
          ? { notifiedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        customerName: true,
        partySize: true,
        status: true,
        estimatedWait: true,
        seatedAt: true,
        notifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { entry },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Waitlist access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    console.error("[waitlist] Failed to update waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to update waitlist entry", code: "WAITLIST_UPDATE_FAILED" },
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
    await db.waitlistEntry.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[waitlist] Failed to cancel waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to cancel waitlist entry", code: "WAITLIST_CANCEL_FAILED" },
      { status: 500 }
    );
  }
}
