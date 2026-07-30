import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const PROMO_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const PROMO_WINDOW_MS = 60_000;
const MAX_PROMO_CHECKS_PER_WINDOW = 60;
type PromoBucket = { count: number; resetAt: number };
const globalForPromoLimit = globalThis as unknown as {
  restaurantPromoRateLimits?: Map<string, PromoBucket>;
};
const promoRateLimits =
  globalForPromoLimit.restaurantPromoRateLimits ?? new Map<string, PromoBucket>();
if (!globalForPromoLimit.restaurantPromoRateLimits) {
  globalForPromoLimit.restaurantPromoRateLimits = promoRateLimits;
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
  const existing = promoRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + PROMO_WINDOW_MS };
  bucket.count += 1;
  promoRateLimits.set(key, bucket);
  if (bucket.count <= MAX_PROMO_CHECKS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}

export async function GET(req: NextRequest) {
  const retryAfter = consumeLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { valid: false, code: "PROMO_RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code || !PROMO_PATTERN.test(code)) {
    return NextResponse.json(
      { valid: false },
      { headers: { "Cache-Control": "no-store" } }
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
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[promo] Promo lookup failed", error);
    return NextResponse.json(
      { valid: false, code: "PROMO_LOOKUP_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
