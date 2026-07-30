import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ORDER_MANAGEMENT_ROLES,
  STAFF_ADMIN_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";

const TABLE_READ_ROLES = [
  ...ORDER_MANAGEMENT_ROLES,
  "host",
] as const;
const tableStatusSchema = z.enum([
  "open",
  "seated",
  "ordered",
  "served",
  "paid",
  "cleaning",
  "reserved",
]);
const tableOperationSchema = z
  .object({
    type: z.literal("update"),
    id: z.string().trim().min(1).max(191),
    status: tableStatusSchema,
    serverName: z.string().trim().max(160).default(""),
  })
  .strict();
const tableCreateSchema = z
  .object({
    type: z.literal("create").optional(),
    number: z.number().int().positive().max(1_000_000),
    capacity: z.number().int().min(1).max(100).default(4),
    section: z.string().trim().min(1).max(80).default("main"),
    shape: z.enum(["square", "round"]).default("square"),
    x: z.number().min(-100_000).max(100_000).default(0),
    y: z.number().min(-100_000).max(100_000).default(0),
    width: z.number().min(30).max(2_000).default(90),
    height: z.number().min(30).max(2_000).default(90),
  })
  .strict();
const tablePatchSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    number: z.number().int().positive().max(1_000_000).optional(),
    capacity: z.number().int().min(1).max(100).optional(),
    section: z.string().trim().min(1).max(80).optional(),
    shape: z.enum(["square", "round"]).optional(),
    x: z.number().min(-100_000).max(100_000).optional(),
    y: z.number().min(-100_000).max(100_000).optional(),
    width: z.number().min(30).max(2_000).optional(),
    height: z.number().min(30).max(2_000).optional(),
    status: tableStatusSchema.optional(),
    serverName: z.string().trim().max(160).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one editable field is required",
  });

export async function GET() {
  const auth = await requireStaffSession(TABLE_READ_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const tables = await db.restaurantTable.findMany({
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: { status: { in: ["confirmed", "preparing", "ready"] } },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            serverName: true,
            createdAt: true,
          },
        },
      },
    });
    return NextResponse.json(
      { tables },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[tables] Failed to load tables", error);
    return NextResponse.json(
      { error: "Unable to load tables", code: "TABLES_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.type === "update") {
      const auth = await requireStaffSession(TABLE_READ_ROLES);
      if ("response" in auth) return auth.response;

      const parsed = tableOperationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Invalid table operation",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const table = await db.restaurantTable.update({
        where: { id: parsed.data.id },
        data: {
          status: parsed.data.status,
          serverName: parsed.data.serverName,
          seatedAt:
            parsed.data.status === "seated"
              ? new Date()
              : ["open", "cleaning"].includes(parsed.data.status)
                ? null
                : undefined,
        },
      });
      return NextResponse.json({ table });
    }

    const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
    if ("response" in auth) return auth.response;

    const parsed = tableCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid table",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type: _type, ...tableData } = parsed.data;
    const table = await db.restaurantTable.create({
      data: { ...tableData, status: "open" },
    });
    return NextResponse.json({ table }, { status: 201 });
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

    console.error("[tables] Failed to write table", error);
    return NextResponse.json(
      { error: "Unable to save table", code: "TABLE_SAVE_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = tablePatchSchema.safeParse(await req.json());
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

    const { id, ...tableData } = parsed.data;
    const table = await db.restaurantTable.update({
      where: { id },
      data: tableData,
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
