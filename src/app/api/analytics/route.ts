import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  REPORTING_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";

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
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const dailyRevenue: {
      date: string;
      revenue: number;
      orders: number;
      avgTicket: number;
    }[] = [];
    const byDay: Record<string, { revenue: number; orders: number }> = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      if (!byDay[date]) byDay[date] = { revenue: 0, orders: 0 };
      byDay[date].revenue += order.total;
      byDay[date].orders += 1;
    });
    Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, value]) => {
        dailyRevenue.push({
          date,
          revenue: Math.round(value.revenue * 100) / 100,
          orders: value.orders,
          avgTicket:
            value.orders > 0
              ? Math.round((value.revenue / value.orders) * 100) / 100
              : 0,
        });
      });

    const itemStats: Record<
      string,
      { name: string; nameAr: string; category: string; qty: number; revenue: number }
    > = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.menuItemId;
        if (!itemStats[key]) {
          itemStats[key] = {
            name: item.menuItem?.nameEn || "Unknown",
            nameAr: item.menuItem?.nameAr || "",
            category: item.menuItem?.category?.nameEn || "",
            qty: 0,
            revenue: 0,
          };
        }
        itemStats[key].qty += item.quantity;
        itemStats[key].revenue += item.totalPrice;
      });
    });
    const topItemsByRevenue = Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const topItemsByQty = Object.values(itemStats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const categoryStats: Record<
      string,
      { name: string; revenue: number; qty: number }
    > = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const category = item.menuItem?.category?.nameEn || "Other";
        if (!categoryStats[category]) {
          categoryStats[category] = { name: category, revenue: 0, qty: 0 };
        }
        categoryStats[category].revenue += item.totalPrice;
        categoryStats[category].qty += item.quantity;
      });
    });
    const salesByCategory = Object.values(categoryStats).sort(
      (a, b) => b.revenue - a.revenue
    );

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNamesAr = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
    const salesByDayOfWeek = dayNames.map((day, index) => ({
      day,
      dayAr: dayNamesAr[index],
      revenue: 0,
      orders: 0,
    }));
    orders.forEach((order) => {
      const dayOfWeek = new Date(order.createdAt).getDay();
      salesByDayOfWeek[dayOfWeek].revenue += order.total;
      salesByDayOfWeek[dayOfWeek].orders += 1;
    });

    const salesByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourOrders = orders.filter(
        (order) => new Date(order.createdAt).getHours() === hour
      );
      return {
        hour: `${hour}:00`,
        revenue:
          Math.round(
            hourOrders.reduce((sum, order) => sum + order.total, 0) * 100
          ) / 100,
        orders: hourOrders.length,
      };
    }).filter((entry) => {
      const hour = Number.parseInt(entry.hour, 10);
      return hour >= 10 && hour <= 23;
    });

    const typeStats: Record<string, { count: number; revenue: number }> = {};
    orders.forEach((order) => {
      if (!typeStats[order.type]) {
        typeStats[order.type] = { count: 0, revenue: 0 };
      }
      typeStats[order.type].count += 1;
      typeStats[order.type].revenue += order.total;
    });

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json(
      {
        period: {
          days,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
        },
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          avgTicket: Math.round(avgTicket * 100) / 100,
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
          ...value,
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
