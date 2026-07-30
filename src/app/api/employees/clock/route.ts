import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { authenticateEmployeePin } from "@/lib/auth/employee-pin";
import { PinConfigurationError } from "@/lib/auth/pin";

const clockSchema = z
  .object({
    pin: z.string().regex(/^\d{4,8}$/).optional(),
    employeeId: z.string().min(1).optional(),
    action: z.enum(["in", "out"]),
  })
  .strict()
  .refine((value) => Boolean(value.pin) !== Boolean(value.employeeId), {
    message: "Provide either pin or employeeId",
  });

const clockEmployeeSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
  clockedIn: true,
  lastClockIn: true,
  lastClockOut: true,
} as const;

// Clock in/out by PIN for the staff kiosk, or by employeeId for authorized managers.
export async function POST(req: NextRequest) {
  try {
    const parsed = clockSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid clock request", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { pin, employeeId, action } = parsed.data;
    if (employeeId) {
      const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
      if ("response" in auth) return auth.response;
    }

    const employee = pin
      ? await authenticateEmployeePin(pin)
      : await db.employee.findUnique({
          where: { id: employeeId! },
          select: clockEmployeeSelect,
        });

    if (!employee?.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const now = new Date();
    const updated = await db.employee.update({
      where: { id: employee.id },
      data:
        action === "in"
          ? { clockedIn: true, lastClockIn: now }
          : { clockedIn: false, lastClockOut: now },
      select: clockEmployeeSelect,
    });

    let sessionHours = 0;
    if (updated.clockedIn && updated.lastClockIn) {
      sessionHours = (now.getTime() - updated.lastClockIn.getTime()) / 3_600_000;
    }

    return NextResponse.json({
      employee: updated,
      sessionHours: Math.round(sessionHours * 100) / 100,
    });
  } catch (error) {
    if (error instanceof PinConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured", code: "AUTH_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[employees/clock] Clock operation failed", error);
    return NextResponse.json(
      { error: "Unable to update clock status", code: "CLOCK_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

// Management view of all active employee clock states.
export async function GET() {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  const employees = await db.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      hourlyWage: true,
      clockedIn: true,
      lastClockIn: true,
      lastClockOut: true,
    },
  });

  const now = new Date();
  const withHours = employees.map((employee) => {
    let currentSessionHours = 0;
    if (employee.clockedIn && employee.lastClockIn) {
      currentSessionHours = (now.getTime() - employee.lastClockIn.getTime()) / 3_600_000;
    }
    return {
      ...employee,
      currentSessionHours: Math.round(currentSessionHours * 100) / 100,
    };
  });

  const clockedInCount = employees.filter((employee) => employee.clockedIn).length;
  const totalHoursToday = withHours.reduce(
    (sum, employee) => sum + employee.currentSessionHours,
    0
  );

  return NextResponse.json(
    {
      employees: withHours,
      clockedInCount,
      totalHoursToday: Math.round(totalHoursToday * 100) / 100,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
