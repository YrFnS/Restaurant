import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";

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
      select: { id: true, role: true },
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

    // P0-B02 replaces the optional plaintext PIN update with a hash operation.
    const employee = await db.employee.update({
      where: { id },
      data: parsed.data,
      select: safeEmployeeSelect,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error("[employees] Failed to update employee", error);
    return NextResponse.json(
      { error: "Unable to update employee", code: "EMPLOYEE_UPDATE_FAILED" },
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
    if (id === auth.session.id) {
      return NextResponse.json(
        { error: "You cannot delete your active account", code: "SELF_DELETE_BLOCKED" },
        { status: 400 }
      );
    }

    const target = await db.employee.findUnique({
      where: { id },
      select: { role: true },
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

    await db.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[employees] Failed to delete employee", error);
    return NextResponse.json(
      { error: "Unable to delete employee", code: "EMPLOYEE_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
