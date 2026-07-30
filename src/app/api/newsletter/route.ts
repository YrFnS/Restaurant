import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const newsletterSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();

const NEWSLETTER_WINDOW_MS = 60_000;
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
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
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

export async function POST(req: NextRequest) {
  const retryAfter = consumeLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many subscription attempts", code: "NEWSLETTER_RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const parsed = newsletterSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid email address is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    await db.newsletterSubscription.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[newsletter] Failed to subscribe email", error);
    return NextResponse.json(
      { error: "Unable to subscribe", code: "NEWSLETTER_SUBSCRIBE_FAILED" },
      { status: 500 }
    );
  }
}
