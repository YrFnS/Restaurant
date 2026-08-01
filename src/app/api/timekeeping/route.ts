import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  addTimeAdjustment,
  readTimesheet,
  TimekeepingError,
  timekeepingErrorFromDatabase,
} from "@/lib/timekeeping/timekeeping";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const adjustmentSchema = z
  .object({
    shiftId: z.string().trim().min(1).max(191),
    paidMinutesDelta: z.number().min(-10_080).max(10_080).refine((value) => value !== 0),
    reasonCode: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict();

function errorResponse(error: TimekeepingError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const params = new URL(req.url).searchParams;
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1_000);
    const parsed = z
      .object({
        from: dateSchema,
        to: dateSchema,
        employeeId: z.string().trim().min(1).max(191).optional(),
        limit: z.coerce.number().int().min(1).max(2_000).default(500),
      })
      .strict()
      .safeParse({
        from: params.get("from") || isoDate(defaultFrom),
        to: params.get("to") || isoDate(now),
        employeeId: params.get("employeeId") || undefined,
        limit: params.get("limit") || 500,
      });
    if (!parsed.success || parsed.data.from > parsed.data.to) {
      return NextResponse.json(
        {
          error: "Invalid timesheet range",
          code: "VALIDATION_ERROR",
          details: parsed.success ? { from: ["From date must not exceed to date"] } : parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await readTimesheet(db, parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof TimekeepingError) return errorResponse(error);
    const mapped = timekeepingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[timekeeping] Failed to load timesheet", error);
    return NextResponse.json(
      { error: "Unable to load timesheet", code: "TIMESHEET_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const key = req.headers.get("Idempotency-Key")?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Idempotency-Key is required", code: "IDEMPOTENCY_KEY_REQUIRED" },
        { status: 400 }
      );
    }
    const parsed = adjustmentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid time adjustment",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const saved = await addTimeAdjustment(tx, {
        idempotencyKey: key,
        ...parsed.data,
        actor: auth.session,
      });
      if (!saved.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "employee.time.adjust",
          entityType: "EmployeeTimeAdjustment",
          entityId: saved.adjustment.id,
          context,
          metadata: {
            shiftId: saved.adjustment.shiftId,
            paidSecondsDelta: saved.adjustment.paidSecondsDelta,
            laborCostDelta: saved.adjustment.laborCostDelta,
            reasonCode: saved.adjustment.reasonCode,
          },
        });
      }
      return saved;
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof TimekeepingError) return errorResponse(error);
    const mapped = timekeepingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[timekeeping] Failed to create adjustment", error);
    return NextResponse.json(
      { error: "Unable to create time adjustment", code: "TIME_ADJUSTMENT_FAILED" },
      { status: 500 }
    );
  }
}
