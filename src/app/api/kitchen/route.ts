import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastKds } from "@/lib/kds/broadcast";

// Get active orders for a KDS screen (filtered by station)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stationSlug = searchParams.get("station");
  const screenSlug = searchParams.get("screen");
  const includeCompleted = searchParams.get("completed") === "true";

  let stationFilter: string[] = [];
  if (screenSlug) {
    const screen = await db.kitchenScreen.findUnique({ where: { slug: screenSlug } });
    if (screen) {
      stationFilter = screen.stationFilter ? screen.stationFilter.split(",").filter(Boolean) : [];
    }
  } else if (stationSlug) {
    stationFilter = [stationSlug];
  }

  const orderItemWhere: any = {};
  if (stationFilter.length > 0) {
    orderItemWhere.stationSlug = { in: stationFilter };
  }
  if (!includeCompleted) {
    orderItemWhere.status = { notIn: ["served", "cancelled"] };
  } else {
    orderItemWhere.status = { not: "cancelled" };
  }

  const orders = await db.order.findMany({
    where: {
      status: { in: includeCompleted ? ["confirmed", "preparing", "ready", "completed"] : ["confirmed", "preparing", "ready"] },
      items: { some: orderItemWhere },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        where: orderItemWhere,
        include: { menuItem: true },
        orderBy: { course: "asc" },
      },
      table: true,
    },
  });

  // "All Day" counts: aggregate item quantities across active orders
  const allDay: Record<string, { nameEn: string; nameAr: string; count: number }> = {};
  orders.forEach((o) => {
    o.items.forEach((it) => {
      const key = it.menuItemId;
      if (!allDay[key]) allDay[key] = { nameEn: it.menuItem.nameEn, nameAr: it.menuItem.nameAr, count: 0 };
      allDay[key].count += it.quantity;
    });
  });

  return NextResponse.json({ orders, allDay: Object.values(allDay) });
}

// Update an order item status (start / ready / bump / recall)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, status, orderId } = body;

    if (itemId) {
      const update: any = { status };
      if (status === "preparing") update.firedAt = new Date();
      if (status === "ready") update.readyAt = new Date();
      const item = await db.orderItem.update({ where: { id: itemId }, data: update, include: { menuItem: true } });

      // check if all items in the order are ready -> mark order ready
      const orderItems = await db.orderItem.findMany({ where: { orderId: item.orderId } });
      const allReady = orderItems.every((i) => i.status === "ready" || i.status === "served");
      if (allReady && orderItems.length > 0) {
        await db.order.update({ where: { id: item.orderId }, data: { status: "ready" } });
      } else if (status === "preparing") {
        await db.order.update({ where: { id: item.orderId }, data: { status: "preparing" } });
      }

      // ── Broadcast update to relevant KDS screens ────────────────────────
      try {
        const stationSlugs = Array.from(
          new Set(orderItems.map((i) => i.stationSlug).filter(Boolean) as string[])
        );
        const screens = await db.kitchenScreen.findMany({
          where: { isActive: true },
          select: { slug: true, stationFilter: true, screenType: true },
        });
        const target = screens
          .filter((s) => {
            if (s.screenType === "expo") return true;
            if (!s.stationFilter) return true;
            const f = s.stationFilter.split(",").filter(Boolean);
            return f.some((slug) => stationSlugs.includes(slug));
          })
          .map((s) => s.slug);
        await broadcastKds({
          type: "order:update",
          screenSlugs: target,
          payload: { orderId: item.orderId, itemId: item.id, status },
        });
      } catch {
        /* best-effort */
      }

      return NextResponse.json({ item });
    }

    if (orderId) {
      const order = await db.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      if (status === "completed") {
        await db.orderItem.updateMany({ where: { orderId }, data: { status: "served" } });
        if (order.tableId) {
          await db.restaurantTable.update({ where: { id: order.tableId }, data: { status: "cleaning", seatedAt: null } });
        }
      }

      // ── Broadcast order status update to relevant KDS screens ──────────
      try {
        const stationSlugs = Array.from(
          new Set(order.items.map((i) => i.stationSlug).filter(Boolean) as string[])
        );
        const screens = await db.kitchenScreen.findMany({
          where: { isActive: true },
          select: { slug: true, stationFilter: true, screenType: true },
        });
        const target = screens
          .filter((s) => {
            if (s.screenType === "expo") return true;
            if (!s.stationFilter) return true;
            const f = s.stationFilter.split(",").filter(Boolean);
            return f.some((slug) => stationSlugs.includes(slug));
          })
          .map((s) => s.slug);
        await broadcastKds({
          type: "order:status",
          screenSlugs: target,
          payload: { orderId: order.id, status },
        });
      } catch {
        /* best-effort */
      }

      return NextResponse.json({ order });
    }

    return NextResponse.json({ error: "itemId or orderId required" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
