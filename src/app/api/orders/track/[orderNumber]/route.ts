import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ORDER_MANAGEMENT_ROLES } from "@/lib/auth/guard";
import {
  AuthConfigurationError,
  getStaffSession,
} from "@/lib/auth/session";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const TRACK_WINDOW_MS = 60_000;
const MAX_TRACK_REQUESTS = 120;

function bearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function normalizeOrderNumber(value: string): string | null {
  try {
    const normalized = decodeURIComponent(value)
      .replace(/^%23/i, "")
      .replace(/^#/, "")
      .trim();
    return normalized && normalized.length <= 100 ? normalized : null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  let trackingLimit;
  try {
    trackingLimit = await consumeRateLimit({
      scope: "order-track",
      identifier: getRequestSource(req),
      limit: MAX_TRACK_REQUESTS,
      windowMs: TRACK_WINDOW_MS,
    });
  } catch (error) {
    console.error("[orders/track] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Order tracking is temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!trackingLimit.allowed) {
    return NextResponse.json(
      { error: "Too many tracking requests", code: "TRACK_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(trackingLimit) }
    );
  }

  try {
    const { orderNumber } = await params;
    const normalized = normalizeOrderNumber(orderNumber);
    if (!normalized) {
      return NextResponse.json(
        { order: null },
        { status: 404, headers: rateLimitHeaders(trackingLimit) }
      );
    }

    const token =
      new URL(req.url).searchParams.get("token") || bearerToken(req);
    if (!token) {
      const session = await getStaffSession();
      if (!session) {
        return NextResponse.json(
          { order: null },
          { status: 404, headers: rateLimitHeaders(trackingLimit) }
        );
      }
      if (!(ORDER_MANAGEMENT_ROLES as readonly string[]).includes(session.role)) {
        return NextResponse.json(
          { error: "Permission denied", code: "PERMISSION_DENIED" },
          { status: 403, headers: rateLimitHeaders(trackingLimit) }
        );
      }
    }

    const order = await db.order.findUnique({
      where: { orderNumber: `#${normalized}` },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        customerName: true,
        notes: true,
        subtotal: true,
        taxAmount: true,
        deliveryFee: true,
        discountAmount: true,
        tipAmount: true,
        total: true,
        serverName: true,
        tableId: true,
        estimatedReady: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        table: {
          select: { id: true, number: true, section: true },
        },
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
            status: true,
            course: true,
            firedAt: true,
            readyAt: true,
            menuItem: {
              select: {
                id: true,
                nameEn: true,
                nameAr: true,
                image: true,
              },
            },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json(
        { order: null },
        { status: 404, headers: rateLimitHeaders(trackingLimit) }
      );
    }

    if (token && !verifyOrderAccessToken(order.id, token)) {
      return NextResponse.json(
        { order: null },
        { status: 404, headers: rateLimitHeaders(trackingLimit) }
      );
    }

    const timeline: Array<{
      status: string;
      time: string | null;
      label: string;
    }> = [
      {
        status: "confirmed",
        time: order.createdAt.toISOString(),
        label: "Order Confirmed",
      },
    ];

    if (["preparing", "ready", "completed"].includes(order.status)) {
      const firedTimes = order.items
        .filter((item) => item.firedAt)
        .map((item) => item.firedAt!.getTime());
      if (firedTimes.length > 0) {
        timeline.push({
          status: "preparing",
          time: new Date(Math.min(...firedTimes)).toISOString(),
          label: "Being Prepared",
        });
      }
    }
    if (["ready", "completed"].includes(order.status)) {
      const readyTimes = order.items
        .filter((item) => item.readyAt)
        .map((item) => item.readyAt!.getTime());
      timeline.push({
        status: "ready",
        time:
          readyTimes.length > 0
            ? new Date(Math.min(...readyTimes)).toISOString()
            : order.estimatedReady?.toISOString() || null,
        label: "Ready for Pickup/Serving",
      });
    }
    if (order.status === "completed" && order.completedAt) {
      timeline.push({
        status: "completed",
        time: order.completedAt.toISOString(),
        label: "Completed",
      });
    }
    if (order.status === "cancelled") {
      timeline.push({
        status: "cancelled",
        time: order.updatedAt.toISOString(),
        label: "Cancelled",
      });
    }

    const elapsedMin = Math.max(
      0,
      Math.floor((Date.now() - order.createdAt.getTime()) / 60_000)
    );
    const estimatedRemainingMin = order.estimatedReady
      ? Math.max(
          0,
          Math.ceil((order.estimatedReady.getTime() - Date.now()) / 60_000)
        )
      : 0;

    return NextResponse.json(
      {
        order: {
          ...order,
          timeline,
          elapsedMin,
          estimatedRemainingMin,
        },
      },
      { headers: rateLimitHeaders(trackingLimit) }
    );
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        {
          error: "Authentication is not configured",
          code: "AUTH_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(trackingLimit) }
      );
    }
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Order access is not configured",
          code: "ORDER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(trackingLimit) }
      );
    }

    console.error("[orders/track] Failed to load order", error);
    return NextResponse.json(
      { error: "Unable to load order", code: "ORDER_TRACKING_FAILED" },
      { status: 500, headers: rateLimitHeaders(trackingLimit) }
    );
  }
}
