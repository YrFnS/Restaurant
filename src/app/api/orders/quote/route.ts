import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calculateOrderPricing,
  fromCents,
  OrderPricingError,
  orderRequestSchema,
} from "@/lib/orders/pricing";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const QUOTE_WINDOW_MS = 60_000;
const MAX_QUOTES_PER_WINDOW = 60;

export async function POST(req: NextRequest) {
  let quoteLimit;
  try {
    quoteLimit = await consumeRateLimit({
      scope: "order-quote",
      identifier: getRequestSource(req),
      limit: MAX_QUOTES_PER_WINDOW,
      windowMs: QUOTE_WINDOW_MS,
    });
  } catch (error) {
    console.error("[orders/quote] Shared rate limiter failed", error);
    return NextResponse.json(
      { error: "Order quotes are temporarily unavailable", code: "RATE_LIMIT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!quoteLimit.allowed) {
    return NextResponse.json(
      { error: "Too many quote requests", code: "QUOTE_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(quoteLimit) }
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
