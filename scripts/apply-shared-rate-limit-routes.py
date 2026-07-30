from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
changed: list[str] = []


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected block was not found in {path}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")
    changed.append(path)


RATE_IMPORT = """import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from \"@/lib/security/rate-limit\";
"""

# Orders
path = "src/app/api/orders/route.ts"
replace_once(
    path,
    'import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";\n',
    'import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const ORDER_WINDOW_MS = 60_000;
const MAX_ORDERS_PER_WINDOW = 20;

type RateBucket = { count: number; resetAt: number };
const globalForOrderRateLimit = globalThis as unknown as {
  restaurantOrderRateLimits?: Map<string, RateBucket>;
};
const orderRateLimits =
  globalForOrderRateLimit.restaurantOrderRateLimits ?? new Map<string, RateBucket>();
if (!globalForOrderRateLimit.restaurantOrderRateLimits) {
  globalForOrderRateLimit.restaurantOrderRateLimits = orderRateLimits;
}

function getClientKey(req: NextRequest): string {
  return (
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
  );
}

function consumeOrderRateLimit(key: string): number | null {
  const now = Date.now();
  const existing = orderRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + ORDER_WINDOW_MS };

  bucket.count += 1;
  orderRateLimits.set(key, bucket);
  if (bucket.count <= MAX_ORDERS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}
""",
    """const ORDER_WINDOW_MS = 60_000;
const MAX_ORDERS_PER_WINDOW = 20;
""",
)
replace_once(
    path,
    """export async function POST(req: NextRequest) {
  const retryAfter = consumeOrderRateLimit(getClientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many order attempts\", code: \"ORDER_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }

""",
    """export async function POST(req: NextRequest) {
  let orderLimit;
  try {
    orderLimit = await consumeRateLimit({
      scope: \"order-create\",
      identifier: getRequestSource(req),
      limit: MAX_ORDERS_PER_WINDOW,
      windowMs: ORDER_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[orders] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"Ordering is temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!orderLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many order attempts\", code: \"ORDER_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(orderLimit) }
    );
  }

""",
)

# Order tracking
path = "src/app/api/orders/track/[orderNumber]/route.ts"
replace_once(
    path,
    '} from "@/lib/orders/access";\n',
    '} from "@/lib/orders/access";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const TRACK_WINDOW_MS = 60_000;
const MAX_TRACK_REQUESTS = 120;

type TrackRateBucket = { count: number; resetAt: number };
const globalForTrackLimit = globalThis as unknown as {
  restaurantTrackRateLimits?: Map<string, TrackRateBucket>;
};
const trackRateLimits =
  globalForTrackLimit.restaurantTrackRateLimits ??
  new Map<string, TrackRateBucket>();
if (!globalForTrackLimit.restaurantTrackRateLimits) {
  globalForTrackLimit.restaurantTrackRateLimits = trackRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
  );
}

function consumeTrackLimit(key: string): number | null {
  const now = Date.now();
  const existing = trackRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + TRACK_WINDOW_MS };
  bucket.count += 1;
  trackRateLimits.set(key, bucket);
  if (bucket.count <= MAX_TRACK_REQUESTS) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}
""",
    """const TRACK_WINDOW_MS = 60_000;
const MAX_TRACK_REQUESTS = 120;
""",
)
replace_once(
    path,
    """  const retryAfter = consumeTrackLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many tracking requests\", code: \"TRACK_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }
""",
    """  let trackingLimit;
  try {
    trackingLimit = await consumeRateLimit({
      scope: \"order-track\",
      identifier: getRequestSource(req),
      limit: MAX_TRACK_REQUESTS,
      windowMs: TRACK_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[orders/track] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"Order tracking is temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!trackingLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many tracking requests\", code: \"TRACK_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(trackingLimit) }
    );
  }
""",
)

# Feedback
path = "src/app/api/feedback/route.ts"
replace_once(
    path,
    'import { REPORTING_ROLES, requireStaffSession } from "@/lib/auth/guard";\n',
    'import { REPORTING_ROLES, requireStaffSession } from "@/lib/auth/guard";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const FEEDBACK_WINDOW_MS = 60_000;
const MAX_FEEDBACK_PER_WINDOW = 10;
type FeedbackBucket = { count: number; resetAt: number };
const globalForFeedbackLimit = globalThis as unknown as {
  restaurantFeedbackRateLimits?: Map<string, FeedbackBucket>;
};
const feedbackRateLimits =
  globalForFeedbackLimit.restaurantFeedbackRateLimits ??
  new Map<string, FeedbackBucket>();
if (!globalForFeedbackLimit.restaurantFeedbackRateLimits) {
  globalForFeedbackLimit.restaurantFeedbackRateLimits = feedbackRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
  );
}

function consumeLimit(key: string): number | null {
  const now = Date.now();
  const existing = feedbackRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + FEEDBACK_WINDOW_MS };
  bucket.count += 1;
  feedbackRateLimits.set(key, bucket);
  if (bucket.count <= MAX_FEEDBACK_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}
""",
    """const FEEDBACK_WINDOW_MS = 60_000;
const MAX_FEEDBACK_PER_WINDOW = 10;
""",
)
replace_once(
    path,
    """  const retryAfter = consumeLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many feedback submissions\", code: \"FEEDBACK_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }
""",
    """  let feedbackLimit;
  try {
    feedbackLimit = await consumeRateLimit({
      scope: \"feedback-submit\",
      identifier: getRequestSource(req),
      limit: MAX_FEEDBACK_PER_WINDOW,
      windowMs: FEEDBACK_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[feedback] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"Feedback is temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!feedbackLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many feedback submissions\", code: \"FEEDBACK_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(feedbackLimit) }
    );
  }
""",
)

# Newsletter
path = "src/app/api/newsletter/route.ts"
replace_once(
    path,
    'import { db } from "@/lib/db";\n',
    'import { db } from "@/lib/db";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const NEWSLETTER_WINDOW_MS = 60_000;
const MAX_SUBSCRIPTIONS_PER_WINDOW = 10;
type NewsletterBucket = { count: number; resetAt: number };
const globalForNewsletterLimit = globalThis as unknown as {
  restaurantNewsletterRateLimits?: Map<string, NewsletterBucket>;
};
const newsletterRateLimits =
  globalForNewsletterLimit.restaurantNewsletterRateLimits ??
  new Map<string, NewsletterBucket>();
if (!globalForNewsletterLimit.restaurantNewsletterRateLimits) {
  globalForNewsletterLimit.restaurantNewsletterRateLimits =
    newsletterRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
  );
}

function consumeLimit(key: string): number | null {
  const now = Date.now();
  const existing = newsletterRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + NEWSLETTER_WINDOW_MS };
  bucket.count += 1;
  newsletterRateLimits.set(key, bucket);
  if (bucket.count <= MAX_SUBSCRIPTIONS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}
""",
    """const NEWSLETTER_WINDOW_MS = 60_000;
const MAX_SUBSCRIPTIONS_PER_WINDOW = 10;
""",
)
replace_once(
    path,
    """  const retryAfter = consumeLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many subscription attempts\", code: \"NEWSLETTER_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }
""",
    """  let subscriptionLimit;
  try {
    subscriptionLimit = await consumeRateLimit({
      scope: \"newsletter-subscribe\",
      identifier: getRequestSource(req),
      limit: MAX_SUBSCRIPTIONS_PER_WINDOW,
      windowMs: NEWSLETTER_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[newsletter] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"Subscriptions are temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!subscriptionLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many subscription attempts\", code: \"NEWSLETTER_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(subscriptionLimit) }
    );
  }
""",
)

# Reservations
path = "src/app/api/reservations/route.ts"
replace_once(
    path,
    '} from "@/lib/customer-access";\n',
    '} from "@/lib/customer-access";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const RESERVATION_WINDOW_MS = 60_000;
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
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
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
""",
    """const RESERVATION_WINDOW_MS = 60_000;
const MAX_RESERVATIONS_PER_WINDOW = 10;
""",
)
replace_once(
    path,
    """  const retryAfter = consumeReservationLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many reservation attempts\", code: \"RESERVATION_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }
""",
    """  let reservationLimit;
  try {
    reservationLimit = await consumeRateLimit({
      scope: \"reservation-create\",
      identifier: getRequestSource(req),
      limit: MAX_RESERVATIONS_PER_WINDOW,
      windowMs: RESERVATION_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[reservations] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"Reservations are temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!reservationLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many reservation attempts\", code: \"RESERVATION_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(reservationLimit) }
    );
  }
""",
)

# Waitlist
path = "src/app/api/waitlist/route.ts"
replace_once(
    path,
    '} from "@/lib/customer-access";\n',
    '} from "@/lib/customer-access";\n' + RATE_IMPORT,
)
replace_once(
    path,
    """const WAITLIST_WINDOW_MS = 60_000;
const MAX_JOINS_PER_WINDOW = 10;
type WaitlistBucket = { count: number; resetAt: number };
const globalForWaitlistLimit = globalThis as unknown as {
  restaurantWaitlistRateLimits?: Map<string, WaitlistBucket>;
};
const waitlistRateLimits =
  globalForWaitlistLimit.restaurantWaitlistRateLimits ??
  new Map<string, WaitlistBucket>();
if (!globalForWaitlistLimit.restaurantWaitlistRateLimits) {
  globalForWaitlistLimit.restaurantWaitlistRateLimits = waitlistRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get(\"x-forwarded-for\")?.split(\",\")[0]?.trim() ||
    req.headers.get(\"x-real-ip\") ||
    \"unknown\"
  );
}

function consumeWaitlistLimit(key: string): number | null {
  const now = Date.now();
  const existing = waitlistRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + WAITLIST_WINDOW_MS };
  bucket.count += 1;
  waitlistRateLimits.set(key, bucket);
  if (bucket.count <= MAX_JOINS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}
""",
    """const WAITLIST_WINDOW_MS = 60_000;
const MAX_JOINS_PER_WINDOW = 10;
""",
)
replace_once(
    path,
    """  const retryAfter = consumeWaitlistLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: \"Too many waitlist attempts\", code: \"WAITLIST_RATE_LIMITED\" },
      {
        status: 429,
        headers: { \"Retry-After\": String(retryAfter), \"Cache-Control\": \"no-store\" },
      }
    );
  }
""",
    """  let waitlistLimit;
  try {
    waitlistLimit = await consumeRateLimit({
      scope: \"waitlist-create\",
      identifier: getRequestSource(req),
      limit: MAX_JOINS_PER_WINDOW,
      windowMs: WAITLIST_WINDOW_MS,
    });
  } catch (error) {
    console.error(\"[waitlist] Shared rate limiter failed\", error);
    return NextResponse.json(
      { error: \"The waitlist is temporarily unavailable\", code: \"RATE_LIMIT_UNAVAILABLE\" },
      { status: 503, headers: { \"Cache-Control\": \"no-store\" } }
    );
  }
  if (!waitlistLimit.allowed) {
    return NextResponse.json(
      { error: \"Too many waitlist attempts\", code: \"WAITLIST_RATE_LIMITED\" },
      { status: 429, headers: rateLimitHeaders(waitlistLimit) }
    );
  }
""",
)

print("Migrated public rate limits in:")
for path in sorted(set(changed)):
    print(f"- {path}")
