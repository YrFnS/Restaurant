import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import {
  createPinVerifier,
  PinConfigurationError,
} from "@/lib/auth/pin";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

const EMPLOYEE_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "server",
  "cook",
  "bartender",
  "host",
  "inventory_manager",
  "analyst",
  "staff",
] as const;

const updateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    pin: z.string().regex(/^\d{4,8}$/).optional(),
    role: z.enum(EMPLOYEE_ROLES).optional(),
    hourlyWage: z.number().min(0).max(10_000).optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const safeEmployeeSelect = {
  id: true,
  name: true,
  role: true,
  hourlyWage: true,
  isActive: true,
  email: true,
  phone: true,
  clockedIn: true,
  lastClockIn: true,
  lastClockOut: true,
  createdAt: true,
  updatedAt: true,
  schedules: true,
} as const;

function wageMinor(value: number): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    CURRENCY_MINOR_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = updateEmployeeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid employee data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const target = await db.employee.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Employee not found", code: "EMPLOYEE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (
      auth.session.role !== "owner" &&
      (target.role === "owner" || parsed.data.role === "owner")
    ) {
      return NextResponse.json(
        { error: "Only an owner can manage owner accounts", code: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    const { pin, ...employeeData } = parsed.data;
    const hourlyWageMinor =
      employeeData.hourlyWage === undefined
        ? null
        : wageMinor(employeeData.hourlyWage);
    const updateData: Prisma.EmployeeUpdateInput = {
      ...employeeData,
      ...(hourlyWageMinor === null ? {} : { hourlyWageMinor }),
    };
    if (pin) updateData.pin = await createPinVerifier(pin);

    const revokeSessions =
      Boolean(pin) ||
      parsed.data.isActive === false ||
      (parsed.data.role !== undefined && parsed.data.role !== target.role);
    const context = auditContextFromRequest(req);
    const employee = await db.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id },
        data: updateData,
        select: safeEmployeeSelect,
      });

      let revokedSessionCount = 0;
      if (revokeSessions) {
        const revoked = await tx.staffSession.updateMany({
          where: { employeeId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        revokedSessionCount = revoked.count;
      }

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "employee.update",
        entityType: "Employee",
        entityId: id,
        context,
        metadata: {
          changedFields: Object.keys(employeeData),
          pinChanged: Boolean(pin),
          previousRole: target.role,
          role: updated.role,
          previousActive: target.isActive,
          isActive: updated.isActive,
          revokedSessionCount,
          ...(hourlyWageMinor === null
            ? {}
            : { hourlyWageMinor: hourlyWageMinor.toString() }),
        },
      });

      return updated;
    });

    return NextResponse.json({ employee });
  } catch (error) {
    if (error instanceof PinConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured", code: "AUTH_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That PIN is already assigned", code: "PIN_ALREADY_IN_USE" },
        { status: 409 }
      );
    }

    console.error("[employees] Failed to update employee", error);
    return NextResponse.json(
      { error: "Unable to update employee", code: "EMPLOYEE_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    if (id === auth.session.id) {
      return NextResponse.json(
        { error: "You cannot delete your active account", code: "SELF_DELETE_BLOCKED" },
        { status: 400 }
      );
    }

    const target = await db.employee.findUnique({
      where: { id },
      select: { name: true, role: true, isActive: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Employee not found", code: "EMPLOYEE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (target.role === "owner" && auth.session.role !== "owner") {
      return NextResponse.json(
        { error: "Only an owner can delete an owner account", code: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    const context = auditContextFromRequest(req);
    await db.$transaction(async (tx) => {
      const deletedSessions = await tx.staffSession.deleteMany({
        where: { employeeId: id },
      });
      await tx.employee.delete({ where: { id } });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "employee.delete",
        entityType: "Employee",
        entityId: id,
        context,
        metadata: {
          name: target.name,
          role: target.role,
          wasActive: target.isActive,
          deletedSessionCount: deletedSessions.count,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[employees] Failed to delete employee", error);
    return NextResponse.json(
      { error: "Unable to delete employee", code: "EMPLOYEE_DELETE_FAILED" },
      { status: 500 }
    );
  }
}