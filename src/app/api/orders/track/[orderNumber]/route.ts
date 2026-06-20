import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Track an order by its order number (e.g. #1001)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber } = await params;
    // normalize: allow with or without #
    const normalized = orderNumber.replace(/^#/, "").replace(/^%23/, "");
    const order = await db.order.findFirst({
      where: { orderNumber: { startsWith: `#${normalized}` } },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });
    if (!order) {
      return NextResponse.json({ order: null }, { status: 404 });
    }

    // Build a timeline of status changes based on timestamps
    const timeline: { status: string; time: string | null; label: string }[] = [
      { status: "confirmed", time: order.createdAt.toISOString(), label: "Order Confirmed" },
    ];
    if (order.status === "preparing" || order.status === "ready" || order.status === "completed") {
      // find earliest firedAt among items as "preparing" start
      const firedTimes = order.items.filter((i) => i.firedAt).map((i) => i.firedAt!.getTime());
      if (firedTimes.length) {
        timeline.push({ status: "preparing", time: new Date(Math.min(...firedTimes)).toISOString(), label: "Being Prepared" });
      }
    }
    if (order.status === "ready" || order.status === "completed") {
      const readyTimes = order.items.filter((i) => i.readyAt).map((i) => i.readyAt!.getTime());
      const readyTime = readyTimes.length ? new Date(Math.min(...readyTimes)).toISOString() : order.estimatedReady?.toISOString() || null;
      timeline.push({ status: "ready", time: readyTime, label: "Ready for Pickup/Serving" });
    }
    if (order.status === "completed" && order.completedAt) {
      timeline.push({ status: "completed", time: order.completedAt.toISOString(), label: "Completed" });
    }
    if (order.status === "cancelled") {
      timeline.push({ status: "cancelled", time: order.updatedAt.toISOString(), label: "Cancelled" });
    }

    // estimated remaining time
    const elapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000);
    const estimatedTotal = order.estimatedReady ? Math.max(0, Math.ceil((order.estimatedReady.getTime() - Date.now()) / 60000)) : 0;

    return NextResponse.json({
      order: {
        ...order,
        timeline,
        elapsedMin: elapsed,
        estimatedRemainingMin: estimatedTotal,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
