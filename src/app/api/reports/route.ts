import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  REPORTING_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";

export async function GET() {
  const auth = await requireStaffSession(REPORTING_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 7);

    const [todayOrders, weekOrders, allOrders, tables, lowStock, menuItems] =
      await Promise.all([
        db.order.findMany({
          where: { createdAt: { gte: startToday } },
          include: { items: true },
        }),
        db.order.findMany({ where: { createdAt: { gte: startWeek } } }),
        db.order.findMany({
          where: { createdAt: { gte: startToday } },
          include: { items: { include: { menuItem: true } } },
        }),
        db.restaurantTable.findMany(),
        db.ingredient.findMany({ where: { quantity: { lte: 5 } } }),
        db.menuItem.count(),
      ]);

    const todaySales = todayOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const weekSales = weekOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const activeTables = tables.filter((table) =>
      ["seated", "ordered", "served"].includes(table.status)
    ).length;

    const salesByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total: todayOrders
        .filter((order) => new Date(order.createdAt).getHours() === hour)
        .reduce((sum, order) => sum + order.total, 0),
    }));

    const statusCounts: Record<string, number> = {};
    todayOrders.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    const itemCounts: Record<
      string,
      { name: string; count: number; revenue: number }
    > = {};
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.menuItemId;
        const name = item.menuItem?.nameEn || "Unknown";
        if (!itemCounts[key]) {
          itemCounts[key] = { name, count: 0, revenue: 0 };
        }
        itemCounts[key].count += item.quantity;
        itemCounts[key].revenue += item.totalPrice;
      });
    });
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return NextResponse.json(
      {
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
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[reports] Failed to build report", error);
    return NextResponse.json(
      { error: "Unable to load reports", code: "REPORTS_FAILED" },
      { status: 500 }
    );
  }
}
