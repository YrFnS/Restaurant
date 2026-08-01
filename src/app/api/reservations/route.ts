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
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  createReservationBooking,
  readReservationPolicy,
  reservationErrorFromDatabase,
  ReservationAvailabilityError,
  serializeReservationForCustomer,
  serializeReservationForStaff,
} from "@/lib/reservations/availability";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

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
    partySize: z.number().int().min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    occasion: z.string().trim().max(80).nullable().optional(),
    preference: z.string().trim().max(80).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const RESERVATION_WINDOW_MS = 60_000;
const MAX_RESERVATIONS_PER_WINDOW = 10;

function reservationErrorResponse(error: ReservationAvailabilityError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
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
    const [policy, reservations] = await Promise.all([
      readReservationPolicy(db),
      db.reservation.findMany({
        where,
        orderBy: { dateTime: "asc" },
        take: parsed.data.limit,
        include: { table: true },
      }),
    ]);
    return NextResponse.json(
      {
        timezone: policy.timezone,
        reservations: reservations.map((reservation) =>
          serializeReservationForStaff(reservation, policy.timezone)
        ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[reservations] Failed to load reservations", error);
    return NextResponse.json(
      {
        error: "Unable to load reservations",
        code: "RESERVATIONS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let reservationLimit;
  try {
    reservationLimit = await consumeRateLimit({
      scope: "reservation-create",
      identifier: getRequestSource(req),
      limit: MAX_RESERVATIONS_PER_WINDOW,
      windowMs: RESERVATION_WINDOW_MS,
    });
  } catch (error) {
    console.error("[reservations] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Reservations are temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!reservationLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many reservation attempts",
        code: "RESERVATION_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(reservationLimit) }
    );
  }

  const parsed = reservationCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid reservation",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: rateLimitHeaders(reservationLimit) }
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 191) {
    return NextResponse.json(
      {
        error: "A valid Idempotency-Key header is required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
      { status: 400, headers: rateLimitHeaders(reservationLimit) }
    );
  }

  try {
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      async (tx) => {
        const saved = await createReservationBooking(tx, {
          idempotencyKey,
          ...parsed.data,
          source: "customer",
        });
        if (!saved.replayed) {
          await writeAuditEvent(tx, {
            actor: null,
            action: "reservation.customer.create",
            entityType: "Reservation",
            entityId: saved.reservation.id,
            context,
            metadata: {
              partySize: saved.reservation.partySize,
              dateTime: saved.reservation.dateTime,
              endsAt: saved.reservation.endsAt,
              releaseAt: saved.reservation.releaseAt,
              tableId: saved.reservation.tableId,
              source: saved.reservation.source,
            },
          });
        }
        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const policy = await readReservationPolicy(db);
    return NextResponse.json(
      {
        reservation: serializeReservationForCustomer(
          result.reservation,
          policy.timezone
        ),
        accessToken: createCustomerAccessToken(
          "reservation",
          result.reservation.id
        ),
        replayed: result.replayed,
      },
      {
        status: result.replayed ? 200 : 201,
        headers: rateLimitHeaders(reservationLimit),
      }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Reservation access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(reservationLimit) }
      );
    }
    if (error instanceof ReservationAvailabilityError) {
      const response = reservationErrorResponse(error);
      response.headers.set("X-RateLimit-Limit", String(reservationLimit.limit));
      response.headers.set(
        "X-RateLimit-Remaining",
        String(reservationLimit.remaining)
      );
      return response;
    }
    const mapped = reservationErrorFromDatabase(error);
    if (mapped) return reservationErrorResponse(mapped);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error: "Reservation availability changed; please retry",
          code: "RESERVATION_RETRY_REQUIRED",
        },
        { status: 409, headers: rateLimitHeaders(reservationLimit) }
      );
    }

    console.error("[reservations] Failed to create reservation", error);
    return NextResponse.json(
      {
        error: "Unable to create reservation",
        code: "RESERVATION_CREATE_FAILED",
      },
      { status: 500, headers: rateLimitHeaders(reservationLimit) }
    );
  }
}
