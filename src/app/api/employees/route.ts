import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import {
  createPinVerifier,
  PinConfigurationError,
} from "@/lib/auth/pin";

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

const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    pin: z.string().regex(/^\d{4,8}$/),
    role: z.enum(EMPLOYEE_ROLES).default("staff"),
    hourlyWage: z.number().min(0).max(10_000).default(12),
    email: z.string().trim().email().max(254).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

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

export async function GET() {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  const employees = await db.employee.findMany({
    orderBy: { name: "asc" },
    select: safeEmployeeSelect,
  });

  return NextResponse.json(
    { employees },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = createEmployeeSchema.safeParse(await req.json());
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

    if (parsed.data.role === "owner" && auth.session.role !== "owner") {
      return NextResponse.json(
        { error: "Only an owner can create another owner", code: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    const { pin, ...employeeData } = parsed.data;
    const pinVerifier = await createPinVerifier(pin);
    const employee = await db.employee.create({
      data: { ...employeeData, pin: pinVerifier },
      select: safeEmployeeSelect,
    });

    return NextResponse.json({ employee }, { status: 201 });
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

    console.error("[employees] Failed to create employee", error);
    return NextResponse.json(
      { error: "Unable to create employee", code: "EMPLOYEE_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
