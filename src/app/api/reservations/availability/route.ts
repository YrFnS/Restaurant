import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listReservationAvailability,
  ReservationAvailabilityError,
} from "@/lib/reservations/availability";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const availabilityQuerySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    partySize: z.coerce.number().int().min(1).max(100),
    preference: z.string().trim().max(80).optional(),
  })
  .strict();

const AVAILABILITY_WINDOW_MS = 60_000;
const MAX_AVAILABILITY_REQUESTS_PER_WINDOW = 120;

export async function GET(req: NextRequest) {
  let availabilityLimit;
  try {
    availabilityLimit = await consumeRateLimit({
      scope: "reservation-availability",
      identifier: getRequestSource(req),
      limit: MAX_AVAILABILITY_REQUESTS_PER_WINDOW,
      windowMs: AVAILABILITY_WINDOW_MS,
    });
  } catch (error) {
    console.error("[reservations/availability] Shared limiter failed", error);
    return NextResponse.json(
      {
        error: "Reservation availability is temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!availabilityLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many availability requests",
        code: "RESERVATION_AVAILABILITY_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(availabilityLimit) }
    );
  }

  const parsed = availabilityQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid availability query",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: rateLimitHeaders(availabilityLimit) }
    );
  }

  try {
    const availability = await listReservationAvailability(parsed.data);
    return NextResponse.json(availability, {
      headers: rateLimitHeaders(availabilityLimit),
    });
  } catch (error) {
    if (error instanceof ReservationAvailabilityError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status, headers: rateLimitHeaders(availabilityLimit) }
      );
    }
    console.error("[reservations/availability] Failed to load slots", error);
    return NextResponse.json(
      {
        error: "Unable to load reservation availability",
        code: "RESERVATION_AVAILABILITY_FAILED",
      },
      { status: 500, headers: rateLimitHeaders(availabilityLimit) }
    );
  }
}
