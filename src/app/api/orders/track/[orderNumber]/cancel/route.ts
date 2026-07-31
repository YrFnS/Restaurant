import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";
import {
  flushKdsOutboxBestEffort,
  queueKdsEvent,
} from "@/lib/kds/outbox";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

const CANCEL_WINDOW_MS = 60_000;
const MAX_CANCEL_ATTEMPTS_PER_WINDOW = 30;

function bearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function notFound(rateLimit: RateLimitResult) {
  return NextResponse.json(
    { order: null },
    { status: 404, headers: rateLimitHeaders(rateLimit) }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  let cancellationLimit: RateLimitResult;
  try {
    cancellationLimit = await consumeRateLimit({
      scope: "order-cancel",
      identifier: getRequestSource(req),
      limit: MAX_CANCEL_ATTEMPTS_PER_WINDOW,
      windowMs: CANCEL_WINDOW_MS,
    });
  } catch (error) {
    console.error("[orders/cancel] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Order cancellation is temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!cancellationLimit.allowed) {
    return NextResponse.json(
      { error: "Too many cancellation attempts", code: "ORDER_CANCEL_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(cancellationLimit) }
    );
  }

  try {
    const { orderNumber } = await params;
    let normalized = "";
    try {
      normalized = decodeURIComponent(orderNumber)
        .replace(/^%23/i, "")
        .replace(/^#/, "")
        .trim();
    } catch {
      return notFound(cancellationLimit);
    }

    const existing = await db.order.findUnique({
      where: { orderNumber: `#${normalized}` },
      select: { id: true, status: true, tableId: true, orderNumber: true },
    });
    if (!existing) return notFound(cancellationLimit);

    const token = new URL(req.url).searchParams.get("token") || bearerToken(req);
    if (!verifyOrderAccessToken(existing.id, token)) {
      return notFound(cancellationLimit);
    }

    if (!["pending", "confirmed"].includes(existing.status)) {
      return NextResponse.json(
        {
          error: "This order can no longer be cancelled online",
          code: "ORDER_CANCELLATION_CLOSED",
        },
        { status: 409, headers: rateLimitHeaders(cancellationLimit) }
      );
    }

    const context = auditContextFromRequest(req);
    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: existing.id },
        select: { status: true, tableId: true },
      });
      if (!["pending", "confirmed"].includes(current.status)) {
        throw new Error("ORDER_CANCELLATION_CLOSED");
      }

      await tx.orderItem.updateMany({
        where: { orderId: existing.id, status: { not: "served" } },
        data: { status: "cancelled", hold: false },
      });
      const cancelled = await tx.order.update({
        where: { id: existing.id },
        data: { status: "cancelled" },
        include: { items: { include: { menuItem: true } }, table: true },
      });

      if (current.tableId) {
        const otherActiveOrders = await tx.order.count({
          where: {
            tableId: current.tableId,
            id: { not: existing.id },
            status: { in: ["pending", "confirmed", "preparing", "ready"] },
          },
        });
        if (otherActiveOrders === 0) {
          await tx.restaurantTable.update({
            where: { id: current.tableId },
            data: { status: "open", seatedAt: null },
          });
        }
      }

      await writeAuditEvent(tx, {
        actor: null,
        action: "order.customer.cancel",
        entityType: "Order",
        entityId: existing.id,
        context,
        metadata: {
          orderNumber: existing.orderNumber,
          previousStatus: current.status,
          status: "cancelled",
          tableId: current.tableId,
        },
      });

      await queueKdsEvent(tx, {
        type: "order:status",
        screenSlugs: [],
        payload: { orderId: existing.id, status: "cancelled" },
      });

      return cancelled;
    });

    await flushKdsOutboxBestEffort(10);

    return NextResponse.json(
      {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
        },
      },
      { headers: rateLimitHeaders(cancellationLimit) }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_CANCELLATION_CLOSED") {
      return NextResponse.json(
        {
          error: "This order can no longer be cancelled online",
          code: "ORDER_CANCELLATION_CLOSED",
        },
        { status: 409, headers: rateLimitHeaders(cancellationLimit) }
      );
    }
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Order access is not configured",
          code: "ORDER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503, headers: rateLimitHeaders(cancellationLimit) }
      );
    }

    console.error("[orders/cancel] Failed to cancel order", error);
    return NextResponse.json(
      { error: "Unable to cancel order", code: "ORDER_CANCEL_FAILED" },
      { status: 500, headers: rateLimitHeaders(cancellationLimit) }
    );
  }
}
