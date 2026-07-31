import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  REPORTING_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { exactMinorToNumber } from "@/lib/money/exact-store";

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

    const [todayOrders, weekOrders, tables, lowStock, menuItems] =
      await Promise.all([
        db.order.findMany({
          where: { createdAt: { gte: startToday } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            totalMinor: true,
            items: {
              select: {
                menuItemId: true,
                quantity: true,
                totalPriceMinor: true,
                menuItem: { select: { nameEn: true } },
              },
            },
          },
        }),
        db.order.findMany({
          where: { createdAt: { gte: startWeek } },
          select: { totalMinor: true },
        }),
        db.restaurantTable.findMany(),
        db.ingredient.findMany({ where: { quantity: { lte: 5 } } }),
        db.menuItem.count(),
      ]);

    const todaySalesMinor = todayOrders.reduce(
      (sum, order) => sum + order.totalMinor,
      BigInt(0)
    );
    const weekSalesMinor = weekOrders.reduce(
      (sum, order) => sum + order.totalMinor,
      BigInt(0)
    );
    const activeTables = tables.filter((table) =>
      ["seated", "ordered", "served"].includes(table.status)
    ).length;

    const salesByHourInternal = Array.from({ length: 24 }, () => BigInt(0));
    for (const order of todayOrders) {
      salesByHourInternal[order.createdAt.getHours()] += order.totalMinor;
    }
    const salesByHour = salesByHourInternal.map((totalMinor, hour) => ({
      hour,
      total: exactMinorToNumber(totalMinor),
    }));

    const statusCounts: Record<string, number> = {};
    for (const order of todayOrders) {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    }

    const itemCounts: Record<
      string,
      { name: string; count: number; revenueMinor: bigint }
    > = {};
    for (const order of todayOrders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        const name = item.menuItem?.nameEn || "Unknown";
        if (!itemCounts[key]) {
          itemCounts[key] = {
            name,
            count: 0,
            revenueMinor: BigInt(0),
          };
        }
        itemCounts[key].count += item.quantity;
        itemCounts[key].revenueMinor += item.totalPriceMinor;
      }
    }
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((item) => ({
        name: item.name,
        count: item.count,
        revenue: exactMinorToNumber(item.revenueMinor),
      }));

    return NextResponse.json(
      {
        todaySales: exactMinorToNumber(todaySalesMinor),
        weekSales: exactMinorToNumber(weekSalesMinor),
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
