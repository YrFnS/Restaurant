import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  REPORTING_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { exactMinorToNumber } from "@/lib/money/exact-store";
import { divideAndRoundHalfUp } from "@/lib/money/scaled-integer";

function compareMinorDescending(a: bigint, b: bigint): number {
  return a === b ? 0 : a > b ? -1 : 1;
}

export async function GET(req: Request) {
  const auth = await requireStaffSession(REPORTING_ROLES);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const requestedDays = Number(searchParams.get("days") || "30");
  if (!Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 366) {
    return NextResponse.json(
      { error: "Days must be an integer between 1 and 366", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }
  const days = requestedDays;

  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { not: "cancelled" },
      },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        totalMinor: true,
        items: {
          select: {
            menuItemId: true,
            quantity: true,
            totalPriceMinor: true,
            menuItem: {
              select: {
                nameEn: true,
                nameAr: true,
                category: { select: { nameEn: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const byDay: Record<string, { revenueMinor: bigint; orders: number }> = {};
    for (const order of orders) {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!byDay[date]) {
        byDay[date] = { revenueMinor: BigInt(0), orders: 0 };
      }
      byDay[date].revenueMinor += order.totalMinor;
      byDay[date].orders += 1;
    }
    const dailyRevenue = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        revenue: exactMinorToNumber(value.revenueMinor),
        orders: value.orders,
        avgTicket:
          value.orders > 0
            ? exactMinorToNumber(
                divideAndRoundHalfUp(value.revenueMinor, BigInt(value.orders))
              )
            : 0,
      }));

    const itemStats: Record<
      string,
      {
        name: string;
        nameAr: string;
        category: string;
        qty: number;
        revenueMinor: bigint;
      }
    > = {};
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemStats[key]) {
          itemStats[key] = {
            name: item.menuItem?.nameEn || "Unknown",
            nameAr: item.menuItem?.nameAr || "",
            category: item.menuItem?.category?.nameEn || "",
            qty: 0,
            revenueMinor: BigInt(0),
          };
        }
        itemStats[key].qty += item.quantity;
        itemStats[key].revenueMinor += item.totalPriceMinor;
      }
    }
    const serializeItem = (item: (typeof itemStats)[string]) => ({
      name: item.name,
      nameAr: item.nameAr,
      category: item.category,
      qty: item.qty,
      revenue: exactMinorToNumber(item.revenueMinor),
    });
    const topItemsByRevenue = Object.values(itemStats)
      .sort((a, b) => compareMinorDescending(a.revenueMinor, b.revenueMinor))
      .slice(0, 10)
      .map(serializeItem);
    const topItemsByQty = Object.values(itemStats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(serializeItem);

    const categoryStats: Record<
      string,
      { name: string; revenueMinor: bigint; qty: number }
    > = {};
    for (const order of orders) {
      for (const item of order.items) {
        const category = item.menuItem?.category?.nameEn || "Other";
        if (!categoryStats[category]) {
          categoryStats[category] = {
            name: category,
            revenueMinor: BigInt(0),
            qty: 0,
          };
        }
        categoryStats[category].revenueMinor += item.totalPriceMinor;
        categoryStats[category].qty += item.quantity;
      }
    }
    const salesByCategory = Object.values(categoryStats)
      .sort((a, b) => compareMinorDescending(a.revenueMinor, b.revenueMinor))
      .map((entry) => ({
        name: entry.name,
        revenue: exactMinorToNumber(entry.revenueMinor),
        qty: entry.qty,
      }));

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNamesAr = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
    const salesByDayOfWeekInternal = dayNames.map((day, index) => ({
      day,
      dayAr: dayNamesAr[index],
      revenueMinor: BigInt(0),
      orders: 0,
    }));
    for (const order of orders) {
      const dayOfWeek = order.createdAt.getDay();
      salesByDayOfWeekInternal[dayOfWeek].revenueMinor += order.totalMinor;
      salesByDayOfWeekInternal[dayOfWeek].orders += 1;
    }
    const salesByDayOfWeek = salesByDayOfWeekInternal.map((entry) => ({
      day: entry.day,
      dayAr: entry.dayAr,
      revenue: exactMinorToNumber(entry.revenueMinor),
      orders: entry.orders,
    }));

    const hourStats = Array.from({ length: 24 }, () => ({
      revenueMinor: BigInt(0),
      orders: 0,
    }));
    for (const order of orders) {
      const hour = order.createdAt.getHours();
      hourStats[hour].revenueMinor += order.totalMinor;
      hourStats[hour].orders += 1;
    }
    const salesByHour = hourStats
      .map((entry, hour) => ({
        hour: `${hour}:00`,
        revenue: exactMinorToNumber(entry.revenueMinor),
        orders: entry.orders,
      }))
      .filter((entry) => {
        const hour = Number.parseInt(entry.hour, 10);
        return hour >= 10 && hour <= 23;
      });

    const typeStats: Record<
      string,
      { count: number; revenueMinor: bigint }
    > = {};
    for (const order of orders) {
      if (!typeStats[order.type]) {
        typeStats[order.type] = { count: 0, revenueMinor: BigInt(0) };
      }
      typeStats[order.type].count += 1;
      typeStats[order.type].revenueMinor += order.totalMinor;
    }

    const totalRevenueMinor = orders.reduce(
      (sum, order) => sum + order.totalMinor,
      BigInt(0)
    );
    const totalOrders = orders.length;
    const avgTicketMinor =
      totalOrders > 0
        ? divideAndRoundHalfUp(totalRevenueMinor, BigInt(totalOrders))
        : BigInt(0);

    return NextResponse.json(
      {
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
        },
        summary: {
          totalRevenue: exactMinorToNumber(totalRevenueMinor),
          totalOrders,
          avgTicket: exactMinorToNumber(avgTicketMinor),
          uniqueItems: Object.keys(itemStats).length,
        },
        dailyRevenue,
        topItemsByRevenue,
        topItemsByQty,
        salesByCategory,
        salesByDayOfWeek,
        salesByHour,
        orderTypes: Object.entries(typeStats).map(([type, value]) => ({
          type,
          count: value.count,
          revenue: exactMinorToNumber(value.revenueMinor),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[analytics] Failed to build analytics", error);
    return NextResponse.json(
      { error: "Unable to load analytics", code: "ANALYTICS_FAILED" },
      { status: 500 }
    );
  }
}
