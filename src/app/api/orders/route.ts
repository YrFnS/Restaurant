import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastKds, stationSlugsFromItems } from "@/lib/kds/broadcast";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: any = {};
  if (phone) where.customerPhone = phone;
  if (status && status !== "all") where.status = status;

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      items: { include: { menuItem: true } },
      table: true,
    },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Fetch settings for server-side defaults (tax, delivery, prep time)
    const settings = await db.restaurantSettings.findFirst({ where: { id: "1" } });
    const taxRate = settings?.taxRate ?? 0.1;
    const deliveryFee = settings?.deliveryFee ?? 4.99;
    const minDeliveryOrder = settings?.minDeliveryOrder ?? 15;
    const avgPrepMin = settings?.avgPrepTimeMin ?? 25;

    // Server-side validation: min delivery order
    if (body.type === "delivery" && (body.subtotal || 0) < minDeliveryOrder) {
      return NextResponse.json(
        { error: `Minimum delivery order is ${minDeliveryOrder}` },
        { status: 400 }
      );
    }

    // Resolve stationSlug for each item from its menu category if not provided
    const menuItemIds = (body.items || []).map((it: any) => it.menuItemId).filter(Boolean);
    const menuItems = menuItemIds.length > 0
      ? await db.menuItem.findMany({ where: { id: { in: menuItemIds } }, include: { category: true } })
      : [];
    const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));

    // Resolve tableId if tableNumber (string) provided but no tableId
    let resolvedTableId = body.tableId || null;
    if (!resolvedTableId && body.tableNumber) {
      const table = await db.restaurantTable.findFirst({ where: { number: parseInt(body.tableNumber) } });
      if (table) resolvedTableId = table.id;
    }

    // generate order number
    const count = await db.order.count();
    const orderNumber = `#${1000 + count + 1}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        type: body.type || "dine_in",
        status: "confirmed",
        customerName: body.customerName || "",
        customerPhone: body.customerPhone || "",
        deliveryAddress: body.deliveryAddress || null,
        notes: body.notes || null,
        subtotal: body.subtotal || 0,
        taxAmount: body.taxAmount ?? (body.subtotal || 0) * taxRate,
        deliveryFee: body.deliveryFee ?? (body.type === "delivery" ? deliveryFee : 0),
        discountAmount: body.discountAmount || 0,
        tipAmount: body.tipAmount || 0,
        total: body.total || 0,
        paymentMethod: body.paymentMethod || "cash",
        paymentStatus: body.paymentStatus || "unpaid",
        serverName: body.serverName || "",
        tableId: resolvedTableId,
        customerId: body.customerId || null,
        estimatedReady: body.estimatedReady ? new Date(body.estimatedReady) : new Date(Date.now() + avgPrepMin * 60 * 1000),
        items: {
          create: (body.items || []).map((it: any) => {
            const mi = menuItemMap.get(it.menuItemId);
            const stationSlug = it.stationSlug || mi?.category?.stationSlugs || "prep";
            return {
              menuItemId: it.menuItemId,
              quantity: it.quantity || 1,
              unitPrice: it.unitPrice,
              modifiers: JSON.stringify(it.modifiers || []),
              notes: it.notes || null,
              totalPrice: it.totalPrice,
              stationSlug,
              course: it.course || 1,
              status: "pending",
            };
          }),
        },
      },
      include: { items: { include: { menuItem: true } } },
    });

    // update customer loyalty if phone provided
    if (body.customerPhone && body.total) {
      const customer = await db.customer.findUnique({ where: { phone: body.customerPhone } });
      if (customer) {
        await db.customer.update({
          where: { id: customer.id },
          data: {
            loyaltyPoints: { increment: Math.floor(body.total) },
            totalSpent: { increment: body.total },
            visits: { increment: 1 },
          },
        });
      } else if (body.customerName) {
        await db.customer.create({
          data: {
            name: body.customerName,
            phone: body.customerPhone,
            loyaltyPoints: Math.floor(body.total),
            totalSpent: body.total,
            visits: 1,
          },
        });
      }
    }

    // update table status if dine-in
    if (body.tableId) {
      await db.restaurantTable.update({
        where: { id: body.tableId },
        data: { status: "ordered" },
      });
    }

    // ── Broadcast to KDS screens so they update instantly ────────────────
    // Determine which screens should see this order: any active screen whose
    // stationFilter is empty (all stations) OR contains one of the order's
    // station slugs. Also include "expo" screens (screenType=expo) since they
    // show everything.
    try {
      const itemStationSlugs = stationSlugsFromItems(order.items);
      const screens = await db.kitchenScreen.findMany({
        where: { isActive: true },
        select: { slug: true, stationFilter: true, screenType: true },
      });
      const targetScreenSlugs = screens
        .filter((s) => {
          if (s.screenType === "expo") return true;
          if (!s.stationFilter) return true; // empty filter = all stations
          const filter = s.stationFilter.split(",").filter(Boolean);
          return filter.some((slug) => itemStationSlugs.includes(slug));
        })
        .map((s) => s.slug);
      await broadcastKds({
        type: "order:new",
        screenSlugs: targetScreenSlugs,
        payload: { orderId: order.id, orderNumber: order.orderNumber },
      });
    } catch (e) {
      // best-effort; polling will catch up
    }

    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
