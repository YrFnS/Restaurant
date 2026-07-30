import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";

const tableUpdateSchema = z
  .object({
    number: z.number().int().positive().max(1_000_000).optional(),
    capacity: z.number().int().min(1).max(100).optional(),
    section: z.string().trim().min(1).max(80).optional(),
    shape: z.enum(["square", "round"]).optional(),
    x: z.number().min(-100_000).max(100_000).optional(),
    y: z.number().min(-100_000).max(100_000).optional(),
    width: z.number().min(30).max(2_000).optional(),
    height: z.number().min(30).max(2_000).optional(),
    status: z
      .enum([
        "open",
        "seated",
        "ordered",
        "served",
        "paid",
        "cleaning",
        "reserved",
      ])
      .optional(),
    serverName: z.string().trim().max(160).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = tableUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid table update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const table = await db.restaurantTable.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ table });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That table number already exists", code: "TABLE_NUMBER_IN_USE" },
        { status: 409 }
      );
    }

    console.error("[tables] Failed to update table", error);
    return NextResponse.json(
      { error: "Unable to update table", code: "TABLE_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const table = await db.restaurantTable.findUnique({
      where: { id },
      select: {
        id: true,
        orders: {
          where: {
            status: { in: ["pending", "confirmed", "preparing", "ready"] },
          },
          take: 1,
          select: { id: true },
        },
        reservations: {
          where: { status: { in: ["confirmed", "seated"] } },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!table) {
      return NextResponse.json(
        { error: "Table not found", code: "TABLE_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (table.orders.length > 0 || table.reservations.length > 0) {
      return NextResponse.json(
        {
          error: "Move active orders and reservations before deleting this table",
          code: "TABLE_IN_USE",
        },
        { status: 409 }
      );
    }

    await db.restaurantTable.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tables] Failed to delete table", error);
    return NextResponse.json(
      { error: "Unable to delete table", code: "TABLE_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
