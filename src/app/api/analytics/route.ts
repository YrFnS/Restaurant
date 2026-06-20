import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

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

  // Daily revenue trend
  const dailyRevenue: { date: string; revenue: number; orders: number; avgTicket: number }[] = [];
  const byDay: Record<string, { revenue: number; orders: number }> = {};
  orders.forEach((o) => {
    const d = new Date(o.createdAt).toISOString().split("T")[0];
    if (!byDay[d]) byDay[d] = { revenue: 0, orders: 0 };
    byDay[d].revenue += o.total;
    byDay[d].orders += 1;
  });
  Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, v]) => {
      dailyRevenue.push({
        date,
        revenue: Math.round(v.revenue * 100) / 100,
        orders: v.orders,
        avgTicket: v.orders > 0 ? Math.round((v.revenue / v.orders) * 100) / 100 : 0,
      });
    });

  // Top items by revenue and quantity
  const itemStats: Record<string, { name: string; nameAr: string; category: string; qty: number; revenue: number }> = {};
  orders.forEach((o) => {
    o.items.forEach((it) => {
      const key = it.menuItemId;
      if (!itemStats[key]) {
        itemStats[key] = {
          name: it.menuItem?.nameEn || "Unknown",
          nameAr: it.menuItem?.nameAr || "",
          category: it.menuItem?.category?.nameEn || "",
          qty: 0,
          revenue: 0,
        };
      }
      itemStats[key].qty += it.quantity;
      itemStats[key].revenue += it.totalPrice;
    });
  });
  const topItemsByRevenue = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topItemsByQty = Object.values(itemStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Sales by category
  const categoryStats: Record<string, { name: string; revenue: number; qty: number }> = {};
  orders.forEach((o) => {
    o.items.forEach((it) => {
      const cat = it.menuItem?.category?.nameEn || "Other";
      if (!categoryStats[cat]) categoryStats[cat] = { name: cat, revenue: 0, qty: 0 };
      categoryStats[cat].revenue += it.totalPrice;
      categoryStats[cat].qty += it.quantity;
    });
  });
  const salesByCategory = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);

  // Sales by day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesAr = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
  const byDayOfWeek: { day: string; dayAr: string; revenue: number; orders: number }[] = dayNames.map((d, i) => ({
    day: d, dayAr: dayNamesAr[i], revenue: 0, orders: 0,
  }));
  orders.forEach((o) => {
    const dow = new Date(o.createdAt).getDay();
    byDayOfWeek[dow].revenue += o.total;
    byDayOfWeek[dow].orders += 1;
  });

  // Sales by hour (aggregated)
  const byHour: { hour: string; revenue: number; orders: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const hourOrders = orders.filter((o) => new Date(o.createdAt).getHours() === h);
    byHour.push({
      hour: `${h}:00`,
      revenue: Math.round(hourOrders.reduce((s, o) => s + o.total, 0) * 100) / 100,
      orders: hourOrders.length,
    });
  }
  // Filter to business hours (10:00 - 23:00)
  const salesByHour = byHour.filter((h) => parseInt(h.hour) >= 10 && parseInt(h.hour) <= 23);

  // Order type breakdown
  const typeStats: Record<string, { count: number; revenue: number }> = {};
  orders.forEach((o) => {
    if (!typeStats[o.type]) typeStats[o.type] = { count: 0, revenue: 0 };
    typeStats[o.type].count += 1;
    typeStats[o.type].revenue += o.total;
  });

  // Summary metrics
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const uniqueItems = Object.keys(itemStats).length;

  return NextResponse.json({
    period: { days, startDate: startDate.toISOString(), endDate: now.toISOString() },
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgTicket: Math.round(avgTicket * 100) / 100,
      uniqueItems,
    },
    dailyRevenue,
    topItemsByRevenue,
    topItemsByQty,
    salesByCategory,
    salesByDayOfWeek: byDayOfWeek,
    salesByHour,
    orderTypes: Object.entries(typeStats).map(([type, v]) => ({ type, ...v })),
  });
}
