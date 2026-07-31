import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const recentOrdersSchema = z
  .object({
    orders: z
      .array(
        z
          .object({
            orderNumber: z.string().trim().min(1).max(100),
            accessToken: z.string().trim().min(20).max(200),
            createdAt: z.string().datetime().optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

const RECENT_ORDERS_WINDOW_MS = 60_000;
const MAX_RECENT_ORDER_LOOKUPS_PER_WINDOW = 60;

function normalizeOrderNumber(value: string): string {
  return `#${value.replace(/^#/, "").trim()}`;
}

export async function POST(req: NextRequest) {
  let lookupLimit;
  try {
    lookupLimit = await consumeRateLimit({
      scope: "recent-orders-lookup",
      identifier: getRequestSource(req),
      limit: MAX_RECENT_ORDER_LOOKUPS_PER_WINDOW,
      windowMs: RECENT_ORDERS_WINDOW_MS,
    });
  } catch (error) {
    console.error("[orders/recent] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Recent orders are temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!lookupLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many recent-order requests",
        code: "RECENT_ORDERS_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(lookupLimit) }
    );
  }

  try {
    const parsed = recentOrdersSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order credentials", code: "VALIDATION_ERROR" },
        { status: 400, headers: rateLimitHeaders(lookupLimit) }
      );
    }

    const credentials = new Map(
      parsed.data.orders.map((entry) => [
        normalizeOrderNumber(entry.orderNumber),
        entry.accessToken,
      ])
    );
    const orders = await db.order.findMany({
      where: { orderNumber: { in: Array.from(credentials.keys()) } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        customerName: true,
        subtotal: true,
        taxAmount: true,
        deliveryFee: true,
        discountAmount: true,
        tipAmount: true,
        total: true,
        estimatedReady: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        table: { select: { id: true, number: true, section: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            unitPrice: true,
            modifiers: true,
            notes: true,
            totalPrice: true,
            course: true,
            menuItem: {
              select: {
                id: true,
                nameEn: true,
                nameAr: true,
                price: true,
                image: true,
                isAvailable: true,
              },
            },
          },
        },
      },
    });

    const authorizedOrders = orders.filter((order) =>
      verifyOrderAccessToken(order.id, credentials.get(order.orderNumber))
    );

    return NextResponse.json(
      { orders: authorizedOrders },
      { headers: rateLimitHeaders(lookupLimit) }
    );
  } catch (error) {
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Order access is not configured",
          code: "ORDER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(lookupLimit) }
      );
    }

    console.error("[orders/recent] Failed to load recent orders", error);
    return NextResponse.json(
      { error: "Unable to load recent orders", code: "RECENT_ORDERS_FAILED" },
      { status: 500, headers: rateLimitHeaders(lookupLimit) }
    );
  }
}
