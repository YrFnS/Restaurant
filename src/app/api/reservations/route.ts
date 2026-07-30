import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import {
  createCustomerAccessToken,
  CustomerAccessConfigurationError,
} from "@/lib/customer-access";

const reservationStatusSchema = z.enum([
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
const reservationQuerySchema = z
  .object({
    status: z.union([z.literal("all"), reservationStatusSchema]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();
const reservationCreateSchema = z
  .object({
    customerName: z.string().trim().min(1).max(160),
    customerPhone: z.string().trim().min(5).max(40),
    customerEmail: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .nullable()
      .optional(),
    partySize: z.number().int().min(1).max(50),
    dateTime: z.string().datetime(),
    occasion: z.string().trim().max(80).nullable().optional(),
    preference: z.string().trim().max(80).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const RESERVATION_WINDOW_MS = 60_000;
const MAX_RESERVATIONS_PER_WINDOW = 10;
type ReservationBucket = { count: number; resetAt: number };
const globalForReservationLimit = globalThis as unknown as {
  restaurantReservationRateLimits?: Map<string, ReservationBucket>;
};
const reservationRateLimits =
  globalForReservationLimit.restaurantReservationRateLimits ??
  new Map<string, ReservationBucket>();
if (!globalForReservationLimit.restaurantReservationRateLimits) {
  globalForReservationLimit.restaurantReservationRateLimits =
    reservationRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function consumeReservationLimit(key: string): number | null {
  const now = Date.now();
  const existing = reservationRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + RESERVATION_WINDOW_MS };
  bucket.count += 1;
  reservationRateLimits.set(key, bucket);
  if (bucket.count <= MAX_RESERVATIONS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinServiceHours(
  reservationDate: Date,
  openTime: string,
  closeTime: string
): boolean {
  const reservationMinutes =
    reservationDate.getHours() * 60 + reservationDate.getMinutes();
  const openMinutes = minutesSinceMidnight(openTime);
  const closeMinutes = minutesSinceMidnight(closeTime);

  if (openMinutes <= closeMinutes) {
    return (
      reservationMinutes >= openMinutes && reservationMinutes < closeMinutes
    );
  }
  return reservationMinutes >= openMinutes || reservationMinutes < closeMinutes;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = reservationQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reservation query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const where: Prisma.ReservationWhereInput = {
      ...(parsed.data.status && parsed.data.status !== "all"
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.from || parsed.data.to
        ? {
            dateTime: {
              ...(parsed.data.from
                ? { gte: new Date(parsed.data.from) }
                : {}),
              ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
            },
          }
        : {}),
    };
    const reservations = await db.reservation.findMany({
      where,
      orderBy: { dateTime: "asc" },
      take: parsed.data.limit,
      include: { table: true },
    });
    return NextResponse.json(
      { reservations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[reservations] Failed to load reservations", error);
    return NextResponse.json(
      { error: "Unable to load reservations", code: "RESERVATIONS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const retryAfter = consumeReservationLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many reservation attempts", code: "RESERVATION_RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const parsed = reservationCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid reservation",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const reservationDate = new Date(parsed.data.dateTime);
    const now = new Date();
    const latestAllowed = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1_000);
    if (reservationDate.getTime() < now.getTime() + 15 * 60 * 1_000) {
      return NextResponse.json(
        { error: "Reservation time must be in the future", code: "PAST_RESERVATION" },
        { status: 400 }
      );
    }
    if (reservationDate > latestAllowed) {
      return NextResponse.json(
        { error: "Reservations can be made up to one year ahead", code: "RESERVATION_TOO_FAR" },
        { status: 400 }
      );
    }

    const settings = await db.restaurantSettings.findUnique({
      where: { id: "1" },
      select: { openTime: true, closeTime: true },
    });
    if (
      settings &&
      !isWithinServiceHours(
        reservationDate,
        settings.openTime,
        settings.closeTime
      )
    ) {
      return NextResponse.json(
        { error: "The selected time is outside restaurant hours", code: "OUTSIDE_SERVICE_HOURS" },
        { status: 400 }
      );
    }

    const overlapStart = new Date(reservationDate.getTime() - 90 * 60 * 1_000);
    const overlapEnd = new Date(reservationDate.getTime() + 90 * 60 * 1_000);
    const duplicate = await db.reservation.findFirst({
      where: {
        customerPhone: parsed.data.customerPhone,
        dateTime: { gte: overlapStart, lte: overlapEnd },
        status: { in: ["confirmed", "seated"] },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "An active reservation already exists near this time", code: "DUPLICATE_RESERVATION" },
        { status: 409 }
      );
    }

    const reservation = await db.$transaction(async (tx) => {
      const candidateTables = await tx.restaurantTable.findMany({
        where: { capacity: { gte: parsed.data.partySize } },
        orderBy: [{ capacity: "asc" }, { number: "asc" }],
        select: { id: true },
      });
      const occupied = await tx.reservation.findMany({
        where: {
          tableId: { in: candidateTables.map((table) => table.id) },
          dateTime: { gte: overlapStart, lte: overlapEnd },
          status: { in: ["confirmed", "seated"] },
        },
        select: { tableId: true },
      });
      const occupiedIds = new Set(
        occupied.map((entry) => entry.tableId).filter(Boolean)
      );
      const availableTable = candidateTables.find(
        (table) => !occupiedIds.has(table.id)
      );
      if (!availableTable) {
        throw new Error("NO_TABLE_AVAILABLE");
      }

      const customer = await tx.customer.upsert({
        where: { phone: parsed.data.customerPhone },
        update: {
          name: parsed.data.customerName,
          ...(parsed.data.customerEmail
            ? { email: parsed.data.customerEmail }
            : {}),
        },
        create: {
          name: parsed.data.customerName,
          phone: parsed.data.customerPhone,
          email: parsed.data.customerEmail || null,
        },
        select: { id: true },
      });

      return tx.reservation.create({
        data: {
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          customerEmail: parsed.data.customerEmail || null,
          partySize: parsed.data.partySize,
          tableId: availableTable.id,
          customerId: customer.id,
          dateTime: reservationDate,
          status: "confirmed",
          occasion: parsed.data.occasion || null,
          preference: parsed.data.preference || null,
          notes: parsed.data.notes || null,
        },
        include: { table: true },
      });
    });

    return NextResponse.json(
      {
        reservation,
        accessToken: createCustomerAccessToken("reservation", reservation.id),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        { error: "Reservation access is not configured", code: "CUSTOMER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    if (error instanceof Error && error.message === "NO_TABLE_AVAILABLE") {
      return NextResponse.json(
        { error: "No suitable table is available at that time", code: "NO_TABLE_AVAILABLE" },
        { status: 409 }
      );
    }

    console.error("[reservations] Failed to create reservation", error);
    return NextResponse.json(
      { error: "Unable to create reservation", code: "RESERVATION_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
