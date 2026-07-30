import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calculateOrderPricing,
  fromCents,
  OrderPricingError,
  orderRequestSchema,
} from "@/lib/orders/pricing";

const QUOTE_WINDOW_MS = 60_000;
const MAX_QUOTES_PER_WINDOW = 60;

type QuoteRateBucket = { count: number; resetAt: number };
const globalForQuoteLimit = globalThis as unknown as {
  restaurantQuoteRateLimits?: Map<string, QuoteRateBucket>;
};
const quoteRateLimits =
  globalForQuoteLimit.restaurantQuoteRateLimits ??
  new Map<string, QuoteRateBucket>();
if (!globalForQuoteLimit.restaurantQuoteRateLimits) {
  globalForQuoteLimit.restaurantQuoteRateLimits = quoteRateLimits;
}

function getClientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function consumeQuoteRateLimit(key: string): number | null {
  const now = Date.now();
  const existing = quoteRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + QUOTE_WINDOW_MS };
  bucket.count += 1;
  quoteRateLimits.set(key, bucket);
  if (bucket.count <= MAX_QUOTES_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}

export async function POST(req: NextRequest) {
  const retryAfter = consumeQuoteRateLimit(getClientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many quote requests", code: "QUOTE_RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const parsed = orderRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid order",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const pricing = await db.$transaction((tx) =>
      calculateOrderPricing(tx, parsed.data)
    );

    return NextResponse.json(
      {
        quote: {
          subtotal: fromCents(pricing.subtotalCents),
          discountAmount: fromCents(pricing.discountCents),
          taxAmount: fromCents(pricing.taxCents),
          deliveryFee: fromCents(pricing.deliveryFeeCents),
          tipAmount: fromCents(pricing.tipCents),
          total: fromCents(pricing.totalCents),
          minimumDeliveryOrder: fromCents(
            pricing.minimumDeliveryOrderCents
          ),
          promoCode: pricing.promoCode,
          promoDiscountPercent: pricing.promoDiscountPercent,
          dynamicMultiplier: pricing.dynamicMultiplier,
          activePricingRules: pricing.activePricingRules,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }

    console.error("[orders/quote] Failed to calculate quote", error);
    return NextResponse.json(
      { error: "Unable to calculate order total", code: "QUOTE_FAILED" },
      { status: 500 }
    );
  }
}
