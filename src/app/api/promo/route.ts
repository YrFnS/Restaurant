import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const PROMO_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const PROMO_WINDOW_MS = 60_000;
const MAX_PROMO_CHECKS_PER_WINDOW = 60;

export async function GET(req: NextRequest) {
  let promoLimit;
  try {
    promoLimit = await consumeRateLimit({
      scope: "promo-check",
      identifier: getRequestSource(req),
      limit: MAX_PROMO_CHECKS_PER_WINDOW,
      windowMs: PROMO_WINDOW_MS,
    });
  } catch (error) {
    console.error("[promo] Shared rate limiter failed", error);
    return NextResponse.json(
      { valid: false, code: "RATE_LIMIT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!promoLimit.allowed) {
    return NextResponse.json(
      { valid: false, code: "PROMO_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(promoLimit) }
    );
  }

  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code || !PROMO_PATTERN.test(code)) {
    return NextResponse.json(
      { valid: false },
      { headers: rateLimitHeaders(promoLimit) }
    );
  }

  try {
    const promo = await db.promoCode.findUnique({
      where: { code },
      select: {
        code: true,
        discountPercent: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
      },
    });
    const now = new Date();
    const valid = Boolean(
      promo?.isActive &&
        (!promo.validFrom || now >= promo.validFrom) &&
        (!promo.validUntil || now <= promo.validUntil) &&
        Number.isFinite(promo.discountPercent) &&
        promo.discountPercent >= 0 &&
        promo.discountPercent <= 100
    );

    return NextResponse.json(
      valid
        ? {
            valid: true,
            discount: promo!.discountPercent,
            code: promo!.code,
          }
        : { valid: false },
      { headers: rateLimitHeaders(promoLimit) }
    );
  } catch (error) {
    console.error("[promo] Promo lookup failed", error);
    return NextResponse.json(
      { valid: false, code: "PROMO_LOOKUP_FAILED" },
      { status: 500, headers: rateLimitHeaders(promoLimit) }
    );
  }
}
