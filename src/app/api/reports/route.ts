import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday);
  startWeek.setDate(startWeek.getDate() - 7);

  const [todayOrders, weekOrders, allOrders, tables, lowStock, menuItems] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: startToday } }, include: { items: true } }),
    db.order.findMany({ where: { createdAt: { gte: startWeek } } }),
    db.order.findMany({ where: { createdAt: { gte: startToday } }, include: { items: { include: { menuItem: true } } } }),
    db.restaurantTable.findMany(),
    db.ingredient.findMany({ where: { quantity: { lte: 5 } } }),
    db.menuItem.count(),
  ]);

  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const weekSales = weekOrders.reduce((s, o) => s + o.total, 0);
  const activeTables = tables.filter((t) => ["seated", "ordered", "served"].includes(t.status)).length;

  // sales by hour
  const salesByHour: { hour: number; total: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const hourTotal = todayOrders
      .filter((o) => new Date(o.createdAt).getHours() === h)
      .reduce((s, o) => s + o.total, 0);
    salesByHour.push({ hour: h, total: hourTotal });
  }

  // orders by status
  const statusCounts: Record<string, number> = {};
  todayOrders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  // top items
  const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  allOrders.forEach((o) => {
    o.items.forEach((it) => {
      const key = it.menuItemId;
      const name = it.menuItem?.nameEn || "Unknown";
      if (!itemCounts[key]) itemCounts[key] = { name, count: 0, revenue: 0 };
      itemCounts[key].count += it.quantity;
      itemCounts[key].revenue += it.totalPrice;
    });
  });
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 8);

  return NextResponse.json({
    todaySales,
    weekSales,
    todayOrderCount: todayOrders.length,
    activeTables,
    totalTables: tables.length,
    salesByHour,
    statusCounts,
    topItems,
    lowStock,
    menuItems,
  });
}
