import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";
import { broadcastKds } from "@/lib/kds/broadcast";

function bearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    let normalized = "";
    try {
      normalized = decodeURIComponent(orderNumber)
        .replace(/^%23/i, "")
        .replace(/^#/, "")
        .trim();
    } catch {
      return NextResponse.json({ order: null }, { status: 404 });
    }

    const existing = await db.order.findUnique({
      where: { orderNumber: `#${normalized}` },
      select: { id: true, status: true, tableId: true, orderNumber: true },
    });
    if (!existing) {
      return NextResponse.json({ order: null }, { status: 404 });
    }

    const token =
      new URL(req.url).searchParams.get("token") || bearerToken(req);
    if (!verifyOrderAccessToken(existing.id, token)) {
      return NextResponse.json({ order: null }, { status: 404 });
    }

    if (!["pending", "confirmed"].includes(existing.status)) {
      return NextResponse.json(
        {
          error: "This order can no longer be cancelled online",
          code: "ORDER_CANCELLATION_CLOSED",
        },
        { status: 409 }
      );
    }

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

      return cancelled;
    });

    await broadcastKds({
      type: "order:status",
      payload: { orderId: order.id, status: "cancelled" },
    });

    return NextResponse.json(
      { order: { id: order.id, orderNumber: order.orderNumber, status: order.status } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ORDER_CANCELLATION_CLOSED"
    ) {
      return NextResponse.json(
        {
          error: "This order can no longer be cancelled online",
          code: "ORDER_CANCELLATION_CLOSED",
        },
        { status: 409 }
      );
    }
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        { error: "Order access is not configured", code: "ORDER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[orders/cancel] Failed to cancel order", error);
    return NextResponse.json(
      { error: "Unable to cancel order", code: "ORDER_CANCEL_FAILED" },
      { status: 500 }
    );
  }
}
