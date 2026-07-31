import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { authenticateEmployeePin } from "@/lib/auth/employee-pin";
import { PinConfigurationError } from "@/lib/auth/pin";
import type { StaffSession } from "@/lib/auth/session";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
  resetRateLimit,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

const CLOCK_WINDOW_MS = 15 * 60 * 1_000;
const MAX_SOURCE_ATTEMPTS = 30;
const MAX_PIN_ATTEMPTS = 5;

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

function clockRateLimited(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many clock attempts", code: "CLOCK_RATE_LIMITED" },
    { status: 429, headers: rateLimitHeaders(result) }
  );
}

function clockRateLimitUnavailable() {
  return NextResponse.json(
    {
      error: "Employee clock is temporarily unavailable",
      code: "RATE_LIMIT_UNAVAILABLE",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

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
    let managerSession: StaffSession | null = null;
    let source = "";
    let sourceLimit: RateLimitResult | null = null;
    let pinLimit: RateLimitResult | null = null;

    if (employeeId) {
      const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
      if ("response" in auth) return auth.response;
      managerSession = auth.session;
    } else {
      source = getRequestSource(req);
      try {
        sourceLimit = await consumeRateLimit({
          scope: "employee-clock-source",
          identifier: source,
          limit: MAX_SOURCE_ATTEMPTS,
          windowMs: CLOCK_WINDOW_MS,
        });
      } catch (error) {
        console.error("[employees/clock] Shared source limiter failed", error);
        return clockRateLimitUnavailable();
      }
      if (!sourceLimit.allowed) return clockRateLimited(sourceLimit);

      try {
        pinLimit = await consumeRateLimit({
          scope: "employee-clock-pin",
          identifier: pin!,
          limit: MAX_PIN_ATTEMPTS,
          windowMs: CLOCK_WINDOW_MS,
        });
      } catch (error) {
        console.error("[employees/clock] Shared credential limiter failed", error);
        return clockRateLimitUnavailable();
      }
      if (!pinLimit.allowed) return clockRateLimited(pinLimit);
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
        {
          status: 401,
          headers: pinLimit
            ? rateLimitHeaders(pinLimit)
            : { "Cache-Control": "no-store" },
        }
      );
    }

    const now = new Date();
    const context = auditContextFromRequest(req);
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.employee.update({
        where: { id: employee.id },
        data:
          action === "in"
            ? { clockedIn: true, lastClockIn: now }
            : { clockedIn: false, lastClockOut: now },
        select: clockEmployeeSelect,
      });

      await writeAuditEvent(tx, {
        actor: managerSession || {
          id: employee.id,
          name: employee.name,
          role: employee.role,
        },
        action: `employee.clock.${action}`,
        entityType: "Employee",
        entityId: employee.id,
        context,
        metadata: {
          via: pin ? "pin" : "manager",
          previousClockedIn: employee.clockedIn,
          clockedIn: saved.clockedIn,
          previousLastClockIn: employee.lastClockIn,
          previousLastClockOut: employee.lastClockOut,
          lastClockIn: saved.lastClockIn,
          lastClockOut: saved.lastClockOut,
        },
      });

      return saved;
    });

    if (pin && sourceLimit && pinLimit) {
      await Promise.all([
        resetRateLimit({
          scope: "employee-clock-source",
          identifier: source,
          windowMs: CLOCK_WINDOW_MS,
        }),
        resetRateLimit({
          scope: "employee-clock-pin",
          identifier: pin,
          windowMs: CLOCK_WINDOW_MS,
        }),
      ]).catch((error) =>
        console.warn("[employees/clock] Rate-limit reset failed", error)
      );
    }

    let sessionHours = 0;
    if (updated.clockedIn && updated.lastClockIn) {
      sessionHours = (now.getTime() - updated.lastClockIn.getTime()) / 3_600_000;
    }

    return NextResponse.json(
      {
        employee: updated,
        sessionHours: Math.round(sessionHours * 100) / 100,
      },
      {
        headers: sourceLimit
          ? rateLimitHeaders(sourceLimit)
          : { "Cache-Control": "no-store" },
      }
    );
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
      currentSessionHours =
        (now.getTime() - employee.lastClockIn.getTime()) / 3_600_000;
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
