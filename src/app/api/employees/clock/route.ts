import { randomUUID } from "node:crypto";
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
import {
  clockEmployee,
  readClockStatuses,
  TimekeepingError,
  timekeepingErrorFromDatabase,
  type TimeAction,
} from "@/lib/timekeeping/timekeeping";

const CLOCK_WINDOW_MS = 15 * 60 * 1_000;
const MAX_SOURCE_ATTEMPTS = 30;
const MAX_PIN_ATTEMPTS = 5;

const clockSchema = z
  .object({
    pin: z.string().regex(/^\d{4,8}$/).optional(),
    employeeId: z.string().min(1).max(191).optional(),
    action: z.enum([
      "in",
      "out",
      "clock_in",
      "clock_out",
      "break_start",
      "break_end",
    ]),
    occurredAt: z.string().datetime().optional(),
    reasonCode: z.string().trim().max(80).optional(),
    reason: z.string().trim().max(2_000).optional(),
    requestId: z.string().trim().min(8).max(191).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.pin) !== Boolean(value.employeeId), {
    message: "Provide either pin or employeeId",
  });

function normalizedAction(action: z.infer<typeof clockSchema>["action"]): TimeAction {
  if (action === "in") return "clock_in";
  if (action === "out") return "clock_out";
  return action;
}

function errorResponse(error: TimekeepingError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

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

// Clock and break actions by PIN for a kiosk, or by employee ID for managers.
export async function POST(req: NextRequest) {
  try {
    const parsed = clockSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid clock request",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { pin, employeeId } = parsed.data;
    const action = normalizedAction(parsed.data.action);
    let managerSession: StaffSession | null = null;
    let sourceIdentifier = "";
    let sourceLimit: RateLimitResult | null = null;
    let pinLimit: RateLimitResult | null = null;

    if (employeeId) {
      const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
      if ("response" in auth) return auth.response;
      managerSession = auth.session;
    } else {
      if (parsed.data.occurredAt || parsed.data.reasonCode || parsed.data.reason) {
        return NextResponse.json(
          {
            error: "Kiosk clock events cannot be backdated or corrected",
            code: "KIOSK_CLOCK_FIELDS_FORBIDDEN",
          },
          { status: 400 }
        );
      }

      sourceIdentifier = getRequestSource(req);
      try {
        sourceLimit = await consumeRateLimit({
          scope: "employee-clock-source",
          identifier: sourceIdentifier,
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

    const kioskEmployee = pin ? await authenticateEmployeePin(pin) : null;
    if (pin && !kioskEmployee?.isActive) {
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

    const targetEmployeeId = employeeId || kioskEmployee!.id;
    const actor: StaffSession | { id: string; name: string; role: string } =
      managerSession || {
        id: kioskEmployee!.id,
        name: kioskEmployee!.name,
        role: kioskEmployee!.role,
      };
    const idempotencyKey =
      req.headers.get("Idempotency-Key")?.trim() ||
      parsed.data.requestId ||
      `clock:${targetEmployeeId}:${action}:${randomUUID()}`;
    const context = auditContextFromRequest(req);

    const result = await db.$transaction(async (tx) => {
      const saved = await clockEmployee(tx, {
        idempotencyKey,
        employeeId: targetEmployeeId,
        action,
        source: managerSession ? "manager" : "kiosk",
        actor,
        occurredAt: managerSession ? parsed.data.occurredAt : undefined,
        reasonCode: managerSession ? parsed.data.reasonCode : undefined,
        reason: managerSession ? parsed.data.reason : undefined,
      });

      if (!saved.replayed) {
        await writeAuditEvent(tx, {
          actor,
          action: `employee.time.${action}`,
          entityType: "EmployeeTimeEvent",
          entityId: saved.event.id,
          context,
          metadata: {
            employeeId: targetEmployeeId,
            source: managerSession ? "manager" : "kiosk",
            occurredAt: saved.event.occurredAt,
            operationalDate: saved.event.operationalDate,
            shiftId: saved.employee.shiftId,
            onBreak: saved.employee.onBreak,
          },
        });
      }
      return saved;
    });

    if (pin && sourceLimit && pinLimit) {
      await Promise.all([
        resetRateLimit({
          scope: "employee-clock-source",
          identifier: sourceIdentifier,
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

    return NextResponse.json(
      {
        employee: result.employee,
        event: {
          id: result.event.id,
          eventType: result.event.eventType,
          occurredAt: result.event.occurredAt,
          operationalDate: result.event.operationalDate,
        },
        replayed: result.replayed,
        sessionHours: result.employee.currentSessionHours,
      },
      {
        status: result.replayed ? 200 : 201,
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
    if (error instanceof TimekeepingError) return errorResponse(error);
    const mapped = timekeepingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);

    console.error("[employees/clock] Clock operation failed", error);
    return NextResponse.json(
      { error: "Unable to record time event", code: "CLOCK_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

// Management view of active employee state derived from open shifts and breaks.
export async function GET() {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const result = await readClockStatuses(db);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const mapped = timekeepingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[employees/clock] Failed to load clock states", error);
    return NextResponse.json(
      { error: "Unable to load clock states", code: "CLOCK_STATUS_FAILED" },
      { status: 500 }
    );
  }
}
