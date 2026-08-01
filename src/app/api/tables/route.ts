import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  STAFF_ADMIN_ROLES,
  TABLE_OPERATION_ROLES,
  requireStaffSession,
  roleIsAllowed,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

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
    // Accepted for compatibility with the existing UI, but derived server-side.
    seatedAt: z.string().datetime().nullable().optional(),
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
    // Accepted for compatibility. New tables are always created open/unassigned.
    status: z.literal("open").optional(),
    serverName: z.literal("").optional(),
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

const tableAuditSelect = {
  id: true,
  number: true,
  capacity: true,
  section: true,
  status: true,
  shape: true,
  x: true,
  y: true,
  width: true,
  height: true,
  serverName: true,
  seatedAt: true,
} as const;

function permissionDenied() {
  return NextResponse.json(
    { error: "Permission denied", code: "PERMISSION_DENIED" },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

function operationalUpdateData(input: {
  status?: z.infer<typeof tableStatusSchema>;
  serverName?: string;
}): Prisma.RestaurantTableUpdateInput {
  const data: Prisma.RestaurantTableUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "seated") {
      data.seatedAt = new Date();
    } else if (["open", "cleaning"].includes(input.status)) {
      data.seatedAt = null;
    }
  }
  if (input.serverName !== undefined) {
    data.serverName = input.serverName;
  }

  return data;
}

function isRecordMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

export async function GET() {
  const auth = await requireStaffSession(TABLE_OPERATION_ROLES);
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
  const auth = await requireStaffSession();
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const context = auditContextFromRequest(req);

    if (body?.type === "update") {
      if (!roleIsAllowed(auth.session.role, TABLE_OPERATION_ROLES)) {
        return permissionDenied();
      }

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

      const table = await db.$transaction(async (tx) => {
        const before = await tx.restaurantTable.findUniqueOrThrow({
          where: { id: parsed.data.id },
          select: tableAuditSelect,
        });
        const updated = await tx.restaurantTable.update({
          where: { id: parsed.data.id },
          data: operationalUpdateData({
            status: parsed.data.status,
            serverName: parsed.data.serverName,
          }),
          select: tableAuditSelect,
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "table.operation.update",
          entityType: "RestaurantTable",
          entityId: updated.id,
          context,
          metadata: { before, after: updated },
        });
        return updated;
      });

      return NextResponse.json({ table });
    }

    if (!roleIsAllowed(auth.session.role, STAFF_ADMIN_ROLES)) {
      return permissionDenied();
    }

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

    const {
      type: _type,
      status: _status,
      serverName: _serverName,
      ...tableData
    } = parsed.data;
    const table = await db.$transaction(async (tx) => {
      const created = await tx.restaurantTable.create({
        data: { ...tableData, status: "open", serverName: "" },
        select: tableAuditSelect,
      });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "table.create",
        entityType: "RestaurantTable",
        entityId: created.id,
        context,
        metadata: { after: created },
      });
      return created;
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
    if (isRecordMissing(error)) {
      return NextResponse.json(
        { error: "Table not found", code: "TABLE_NOT_FOUND" },
        { status: 404 }
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
  const auth = await requireStaffSession();
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

    const { id, status, serverName, ...structuralData } = parsed.data;
    const hasStructuralChanges = Object.values(structuralData).some(
      (value) => value !== undefined
    );
    const allowedRoles = hasStructuralChanges
      ? STAFF_ADMIN_ROLES
      : TABLE_OPERATION_ROLES;

    if (!roleIsAllowed(auth.session.role, allowedRoles)) {
      return permissionDenied();
    }

    const context = auditContextFromRequest(req);
    const table = await db.$transaction(async (tx) => {
      const before = await tx.restaurantTable.findUniqueOrThrow({
        where: { id },
        select: tableAuditSelect,
      });
      const updated = await tx.restaurantTable.update({
        where: { id },
        data: {
          ...structuralData,
          ...operationalUpdateData({ status, serverName }),
        },
        select: tableAuditSelect,
      });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: hasStructuralChanges
          ? "table.structure.update"
          : "table.operation.update",
        entityType: "RestaurantTable",
        entityId: updated.id,
        context,
        metadata: { before, after: updated },
      });
      return updated;
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
    if (isRecordMissing(error)) {
      return NextResponse.json(
        { error: "Table not found", code: "TABLE_NOT_FOUND" },
        { status: 404 }
      );
    }

    console.error("[tables] Failed to update table", error);
    return NextResponse.json(
      { error: "Unable to update table", code: "TABLE_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
