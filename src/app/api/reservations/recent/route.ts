import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";
import {
  readReservationPolicy,
  serializeReservationForCustomer,
} from "@/lib/reservations/availability";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const credentialsSchema = z
  .object({
    reservations: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(191),
            accessToken: z.string().trim().min(20).max(200),
            createdAt: z.string().datetime().optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

const RECENT_RESERVATIONS_WINDOW_MS = 60_000;
const MAX_RECENT_RESERVATION_LOOKUPS_PER_WINDOW = 60;

export async function POST(req: NextRequest) {
  let lookupLimit;
  try {
    lookupLimit = await consumeRateLimit({
      scope: "recent-reservations-lookup",
      identifier: getRequestSource(req),
      limit: MAX_RECENT_RESERVATION_LOOKUPS_PER_WINDOW,
      windowMs: RECENT_RESERVATIONS_WINDOW_MS,
    });
  } catch (error) {
    console.error("[reservations/recent] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Recent reservations are temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!lookupLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many recent-reservation requests",
        code: "RECENT_RESERVATIONS_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(lookupLimit) }
    );
  }

  try {
    const parsed = credentialsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reservation credentials", code: "VALIDATION_ERROR" },
        { status: 400, headers: rateLimitHeaders(lookupLimit) }
      );
    }

    const credentials = new Map(
      parsed.data.reservations.map((entry) => [entry.id, entry.accessToken])
    );
    const [policy, reservations] = await Promise.all([
      readReservationPolicy(db),
      db.reservation.findMany({
        where: { id: { in: Array.from(credentials.keys()) } },
        orderBy: { dateTime: "asc" },
        include: {
          table: {
            select: { id: true, number: true, section: true },
          },
        },
      }),
    ]);

    const authorizedReservations = reservations
      .filter((reservation) =>
        verifyCustomerAccessToken(
          "reservation",
          reservation.id,
          credentials.get(reservation.id)
        )
      )
      .map((reservation) =>
        serializeReservationForCustomer(reservation, policy.timezone)
      );

    return NextResponse.json(
      { reservations: authorizedReservations, timezone: policy.timezone },
      { headers: rateLimitHeaders(lookupLimit) }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Reservation access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(lookupLimit) }
      );
    }

    console.error("[reservations/recent] Failed to load reservations", error);
    return NextResponse.json(
      {
        error: "Unable to load reservations",
        code: "RECENT_RESERVATIONS_FAILED",
      },
      { status: 500, headers: rateLimitHeaders(lookupLimit) }
    );
  }
}
