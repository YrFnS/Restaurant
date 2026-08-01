import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireStaffSession,
  RESERVATION_MANAGEMENT_ROLES,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  formatRestaurantInstant,
  readReservationPolicy,
  ReservationAvailabilityError,
  restaurantLocalDateTimeToUtc,
} from "@/lib/reservations/availability";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/);

const policySchema = z
  .object({
    minNoticeMinutes: z.number().int().min(0).max(10_080),
    maxAdvanceDays: z.number().int().min(1).max(730),
    defaultDurationMinutes: z.number().int().min(15).max(1_440),
    turnoverMinutes: z.number().int().min(0).max(480),
    slotIntervalMinutes: z.number().int().min(5).max(240),
    minPartySize: z.number().int().min(1).max(100),
    maxPartySize: z.number().int().min(1).max(100),
    customerCancelCutoffMinutes: z.number().int().min(0).max(10_080),
  })
  .strict()
  .refine((value) => value.maxPartySize >= value.minPartySize, {
    message: "Maximum party size must be at least the minimum",
    path: ["maxPartySize"],
  });

const periodSchema = z
  .object({
    type: z.literal("period"),
    id: z.string().trim().min(1).max(191).optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeSchema,
    closesAt: timeSchema,
    label: z.string().trim().max(120).default(""),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((value) => value.opensAt !== value.closesAt, {
    message: "Opening and closing times must differ",
    path: ["closesAt"],
  });

const closureSchema = z
  .object({
    type: z.literal("closure"),
    localStart: localDateTimeSchema,
    localEnd: localDateTimeSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

const writeSchema = z.discriminatedUnion("type", [periodSchema, closureSchema]);
const deleteSchema = z
  .object({
    type: z.enum(["period", "closure"]),
    id: z.string().trim().min(1).max(191),
  })
  .strict();

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60
  ).padStart(2, "0")}`;
}

async function settingsPayload() {
  const policy = await readReservationPolicy(db);
  const [periods, closures] = await Promise.all([
    db.reservationServicePeriod.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { opensAtMinute: "asc" }],
    }),
    db.reservationClosure.findMany({
      where: { endsAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { startsAt: "asc" },
      take: 500,
    }),
  ]);

  return {
    policy: {
      timezone: policy.timezone,
      minNoticeMinutes: policy.minNoticeMinutes,
      maxAdvanceDays: policy.maxAdvanceDays,
      defaultDurationMinutes: policy.defaultDurationMinutes,
      turnoverMinutes: policy.turnoverMinutes,
      slotIntervalMinutes: policy.slotIntervalMinutes,
      minPartySize: policy.minPartySize,
      maxPartySize: policy.maxPartySize,
      customerCancelCutoffMinutes: policy.customerCancelCutoffMinutes,
    },
    periods: periods.map((period) => ({
      ...period,
      opensAt: minutesToTime(period.opensAtMinute),
      closesAt: minutesToTime(period.closesAtMinute),
    })),
    closures: closures.map((closure) => {
      const start = formatRestaurantInstant(closure.startsAt, policy.timezone);
      const end = formatRestaurantInstant(closure.endsAt, policy.timezone);
      return {
        ...closure,
        localStart: `${start.localDate}T${start.localTime}`,
        localEnd: `${end.localDate}T${end.localTime}`,
        timezone: policy.timezone,
      };
    }),
  };
}

function reservationSettingsError(error: unknown) {
  if (error instanceof ReservationAvailabilityError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      {
        error: "That service period already exists",
        code: "RESERVATION_PERIOD_DUPLICATE",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

export async function GET() {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(await settingsPayload(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[reservation-settings] Failed to load settings", error);
    return NextResponse.json(
      {
        error: "Unable to load reservation settings",
        code: "RESERVATION_SETTINGS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = policySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid reservation policy",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const context = auditContextFromRequest(req);
    await db.$transaction(async (tx) => {
      const before = await tx.restaurantSettings.findUniqueOrThrow({
        where: { id: "1" },
        select: {
          reservationMinNoticeMinutes: true,
          reservationMaxAdvanceDays: true,
          reservationDefaultDurationMinutes: true,
          reservationTurnoverMinutes: true,
          reservationSlotIntervalMinutes: true,
          reservationMinPartySize: true,
          reservationMaxPartySize: true,
          reservationCustomerCancelCutoffMinutes: true,
        },
      });
      const after = await tx.restaurantSettings.update({
        where: { id: "1" },
        data: {
          reservationMinNoticeMinutes: parsed.data.minNoticeMinutes,
          reservationMaxAdvanceDays: parsed.data.maxAdvanceDays,
          reservationDefaultDurationMinutes:
            parsed.data.defaultDurationMinutes,
          reservationTurnoverMinutes: parsed.data.turnoverMinutes,
          reservationSlotIntervalMinutes: parsed.data.slotIntervalMinutes,
          reservationMinPartySize: parsed.data.minPartySize,
          reservationMaxPartySize: parsed.data.maxPartySize,
          reservationCustomerCancelCutoffMinutes:
            parsed.data.customerCancelCutoffMinutes,
        },
        select: {
          reservationMinNoticeMinutes: true,
          reservationMaxAdvanceDays: true,
          reservationDefaultDurationMinutes: true,
          reservationTurnoverMinutes: true,
          reservationSlotIntervalMinutes: true,
          reservationMinPartySize: true,
          reservationMaxPartySize: true,
          reservationCustomerCancelCutoffMinutes: true,
        },
      });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "reservation.policy.update",
        entityType: "RestaurantSettings",
        entityId: "1",
        context,
        metadata: { before, after },
      });
    });
    return NextResponse.json(await settingsPayload());
  } catch (error) {
    const mapped = reservationSettingsError(error);
    if (mapped) return mapped;
    console.error("[reservation-settings] Failed to save policy", error);
    return NextResponse.json(
      {
        error: "Unable to save reservation policy",
        code: "RESERVATION_POLICY_SAVE_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = writeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid reservation setting",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const context = auditContextFromRequest(req);
    if (parsed.data.type === "period") {
      const period = await db.$transaction(async (tx) => {
        const data = {
          dayOfWeek: parsed.data.dayOfWeek,
          opensAtMinute: timeToMinutes(parsed.data.opensAt),
          closesAtMinute: timeToMinutes(parsed.data.closesAt),
          label: parsed.data.label,
          isActive: parsed.data.isActive,
        };
        const saved = parsed.data.id
          ? await tx.reservationServicePeriod.update({
              where: { id: parsed.data.id },
              data,
            })
          : await tx.reservationServicePeriod.create({ data });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: parsed.data.id
            ? "reservation.service_period.update"
            : "reservation.service_period.create",
          entityType: "ReservationServicePeriod",
          entityId: saved.id,
          context,
          metadata: { after: saved },
        });
        return saved;
      });
      return NextResponse.json({ period }, { status: parsed.data.id ? 200 : 201 });
    }

    const localStart = parsed.data.localStart;
    const localEnd = parsed.data.localEnd;
    const closure = await db.$transaction(async (tx) => {
      const startsAt = await restaurantLocalDateTimeToUtc(
        tx,
        localStart.slice(0, 10),
        localStart.slice(11)
      );
      const endsAt = await restaurantLocalDateTimeToUtc(
        tx,
        localEnd.slice(0, 10),
        localEnd.slice(11)
      );
      if (endsAt <= startsAt) {
        throw new ReservationAvailabilityError(
          "Closure end must be after its start",
          "INVALID_RESERVATION_CLOSURE",
          400
        );
      }
      const saved = await tx.reservationClosure.create({
        data: {
          startsAt,
          endsAt,
          reason: parsed.data.reason,
          createdById: auth.session.id,
          createdByName: auth.session.name,
        },
      });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "reservation.closure.create",
        entityType: "ReservationClosure",
        entityId: saved.id,
        context,
        metadata: { after: saved, localStart, localEnd },
      });
      return saved;
    });
    return NextResponse.json({ closure }, { status: 201 });
  } catch (error) {
    const mapped = reservationSettingsError(error);
    if (mapped) return mapped;
    console.error("[reservation-settings] Failed to write setting", error);
    return NextResponse.json(
      {
        error: "Unable to save reservation setting",
        code: "RESERVATION_SETTING_SAVE_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = deleteSchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delete request", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const context = auditContextFromRequest(req);
    await db.$transaction(async (tx) => {
      if (parsed.data.type === "period") {
        const before = await tx.reservationServicePeriod.delete({
          where: { id: parsed.data.id },
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "reservation.service_period.delete",
          entityType: "ReservationServicePeriod",
          entityId: before.id,
          context,
          metadata: { before },
        });
      } else {
        const before = await tx.reservationClosure.delete({
          where: { id: parsed.data.id },
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "reservation.closure.delete",
          entityType: "ReservationClosure",
          entityId: before.id,
          context,
          metadata: { before },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Reservation setting not found", code: "SETTING_NOT_FOUND" },
        { status: 404 }
      );
    }
    console.error("[reservation-settings] Failed to delete setting", error);
    return NextResponse.json(
      {
        error: "Unable to delete reservation setting",
        code: "RESERVATION_SETTING_DELETE_FAILED",
      },
      { status: 500 }
    );
  }
}
