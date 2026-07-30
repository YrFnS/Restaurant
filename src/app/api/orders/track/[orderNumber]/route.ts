import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/session";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";

const TRACK_WINDOW_MS = 60_000;
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
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
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

function bearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const retryAfter = consumeTrackLimit(clientKey(req));
  if (retryAfter) {
    return NextResponse.json(
      { error: "Too many tracking requests", code: "TRACK_RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const { orderNumber } = await params;
    const normalized = decodeURIComponent(orderNumber)
      .replace(/^%23/i, "")
      .replace(/^#/, "")
      .trim();
    if (!normalized || normalized.length > 100) {
      return NextResponse.json({ order: null }, { status: 404 });
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
      return NextResponse.json({ order: null }, { status: 404 });
    }

    const token =
      new URL(req.url).searchParams.get("token") || bearerToken(req);
    const session = token ? null : await getStaffSession();
    if (!session && !verifyOrderAccessToken(order.id, token)) {
      return NextResponse.json({ order: null }, { status: 404 });
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
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        { error: "Order access is not configured", code: "ORDER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[orders/track] Failed to load order", error);
    return NextResponse.json(
      { error: "Unable to load order", code: "ORDER_TRACKING_FAILED" },
      { status: 500 }
    );
  }
}
