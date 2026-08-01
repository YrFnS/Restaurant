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

class TableMutationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 409) {
    super(message);
    this.name = "TableMutationError";
    this.code = code;
    this.status = status;
  }
}

function tableError(error: TableMutationError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

async function lockTable(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "RestaurantTable"
    WHERE "id" = ${id}
    FOR UPDATE
  `);
}

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

    const table = await db.$transaction(async (tx) => {
      await lockTable(tx, id);
      const existing = await tx.restaurantTable.findUnique({
        where: { id },
        select: {
          id: true,
          waitlistEntries: {
            where: { status: "notified" },
            take: 1,
            select: { id: true, partySize: true },
          },
        },
      });
      if (!existing) {
        throw new TableMutationError("Table not found", "TABLE_NOT_FOUND", 404);
      }

      const activeHold = existing.waitlistEntries[0];
      if (activeHold) {
        if (parsed.data.status && parsed.data.status !== "reserved") {
          throw new TableMutationError(
            "Release or seat the active waitlist hold before changing this table status",
            "TABLE_HAS_WAITLIST_HOLD"
          );
        }
        if (
          parsed.data.capacity !== undefined &&
          parsed.data.capacity < activeHold.partySize
        ) {
          throw new TableMutationError(
            "Table capacity cannot be reduced below the held waitlist party size",
            "TABLE_CAPACITY_BELOW_WAITLIST_PARTY"
          );
        }
      }

      return tx.restaurantTable.update({
        where: { id },
        data: parsed.data,
      });
    });
    return NextResponse.json({ table });
  } catch (error) {
    if (error instanceof TableMutationError) return tableError(error);
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
    await db.$transaction(async (tx) => {
      await lockTable(tx, id);
      const table = await tx.restaurantTable.findUnique({
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
          waitlistEntries: {
            where: { status: "notified" },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!table) {
        throw new TableMutationError("Table not found", "TABLE_NOT_FOUND", 404);
      }
      if (
        table.orders.length > 0 ||
        table.reservations.length > 0 ||
        table.waitlistEntries.length > 0
      ) {
        throw new TableMutationError(
          "Move active orders, reservations, and waitlist holds before deleting this table",
          "TABLE_IN_USE"
        );
      }

      await tx.restaurantTable.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TableMutationError) return tableError(error);
    console.error("[tables] Failed to delete table", error);
    return NextResponse.json(
      { error: "Unable to delete table", code: "TABLE_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
