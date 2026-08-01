import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const newsletterSchema = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();

const NEWSLETTER_WINDOW_MS = 60_000;
const MAX_SUBSCRIPTIONS_PER_WINDOW = 10;

export async function POST(req: NextRequest) {
  let subscriptionLimit;
  try {
    subscriptionLimit = await consumeRateLimit({
      scope: "newsletter-subscribe",
      identifier: getRequestSource(req),
      limit: MAX_SUBSCRIPTIONS_PER_WINDOW,
      windowMs: NEWSLETTER_WINDOW_MS,
    });
  } catch (error) {
    console.error("[newsletter] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Subscriptions are temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!subscriptionLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many subscription attempts",
        code: "NEWSLETTER_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(subscriptionLimit) }
    );
  }

  try {
    const parsed = newsletterSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "A valid email address is required",
          code: "VALIDATION_ERROR",
        },
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
      {
        error: "Unable to subscribe",
        code: "NEWSLETTER_SUBSCRIBE_FAILED",
      },
      { status: 500 }
    );
  }
}
