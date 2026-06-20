"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLoading, EmptyState, ORDER_STATUS_META } from "../shared";
import { LiveOrdersCard } from "./LiveOrdersCard";
import {
  DollarSign, ShoppingBag, Armchair, Clock, TrendingUp,
  AlertTriangle, ArrowUpRight, ArrowDownRight, ChefHat, Receipt,
  BarChart3, Flame,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar,
} from "recharts";
import Link from "next/link";

export function DashboardTab() {
  const { t, isRTL, locale, fmtCurrency, fmtNumber } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await fetch("/api/reports")).json(),
    refetchInterval: 30000,
  });

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  const {
    todaySales = 0, weekSales = 0, todayOrderCount = 0,
    activeTables = 0, totalTables = 0, salesByHour = [],
    statusCounts = {}, topItems = [], lowStock = [],
  } = data || {};

  const avgPrepMin = 18; // reasonable default; could be derived from order data later
  const salesHourData = salesByHour
    .filter((h: any) => h.hour >= 9 && h.hour <= 23)
    .map((h: any) => ({
      hour: `${h.hour}:00`,
      total: Math.round(h.total),
    }));

  const stats = [
    {
      label: t.admin.todaysSales,
      value: fmtCurrency(todaySales),
      icon: <DollarSign className="size-5" />,
      trend: "+12.5%",
      up: true,
      tint: "bg-emerald-500/10 text-emerald-700",
      gradient: "from-emerald-500/5 to-emerald-500/0",
    },
    {
      label: t.admin.todaysOrders,
      value: fmtNumber(todayOrderCount),
      icon: <ShoppingBag className="size-5" />,
      trend: "+8.2%",
      up: true,
      tint: "bg-amber-500/10 text-amber-700",
      gradient: "from-amber-500/5 to-amber-500/0",
    },
    {
      label: t.admin.activeTables,
      value: `${activeTables}/${totalTables}`,
      icon: <Armchair className="size-5" />,
      trend: `${Math.round((activeTables / Math.max(totalTables, 1)) * 100)}%`,
      up: true,
      tint: "bg-sky-500/10 text-sky-700",
      gradient: "from-sky-500/5 to-sky-500/0",
    },
    {
      label: t.admin.avgPrepTime,
      value: `${avgPrepMin} ${t.common.minutes}`,
      icon: <Clock className="size-5" />,
      trend: "-2m",
      up: false,
      tint: "bg-violet-500/10 text-violet-700",
      gradient: "from-violet-500/5 to-violet-500/0",
    },
  ];

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className={`overflow-hidden border-border/60 bg-gradient-to-br ${s.gradient} hover:shadow-md transition-shadow`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={`size-11 rounded-xl flex items-center justify-center ${s.tint}`}>
                  {s.icon}
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${s.up ? "text-emerald-600" : "text-rose-600"}`}>
                  {s.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {s.trend}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-amber-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t.admin.revenueToday}</span>
              <TrendingUp className="size-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{fmtCurrency(todaySales)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {todayOrderCount} {t.admin.todaysOrders.toLowerCase()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-emerald-50 to-teal-50/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t.admin.revenueWeek}</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-bold">{fmtCurrency(weekSales)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {isRTL ? "آخر ٧ أيام" : "Last 7 days"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Orders row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <LiveOrdersCard />
        {/* Orders by status (compact) */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              {t.admin.ordersByStatus}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.entries(statusCounts) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([s, count]) => {
                const meta = ORDER_STATUS_META[s] || ORDER_STATUS_META.pending;
                const pct = todayOrderCount > 0 ? Math.round((count / todayOrderCount) * 100) : 0;
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${meta.dot}`} />
                        <span className="font-medium">{meta.label[locale]}</span>
                      </div>
                      <span className="text-muted-foreground">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${meta.dot} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(statusCounts).length === 0 && (
                <EmptyState icon={<Receipt className="size-5" />} title={isRTL ? "لا طلبات" : "No orders"} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales by hour */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3Icon />
              {t.admin.salesByHour}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salesHourData.length === 0 ? (
              <EmptyState icon={<BarChart3Icon />} title={isRTL ? "لا بيانات" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesHourData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: "#71717a" }}
                    reversed={isRTL}
                    interval={1}
                    tickFormatter={(v: string) => v.replace(":00", "")}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} orientation={isRTL ? "right" : "left"} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
                    formatter={(v: any) => [fmtCurrency(v), t.admin.todaysSales]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Avg ticket / peak hour */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              {isRTL ? "مؤشرات سريعة" : "Quick Metrics"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">{isRTL ? "متوسط الفاتورة" : "Avg Ticket"}</span>
              <span className="font-bold text-sm">{fmtCurrency(todayOrderCount > 0 ? todaySales / todayOrderCount : 0)}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">{isRTL ? "ساعة الذروة" : "Peak Hour"}</span>
              <span className="font-bold text-sm">
                {salesHourData.length > 0
                  ? salesHourData.reduce((max: any, h: any) => h.total > max.total ? h : max, salesHourData[0]).hour
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">{isRTL ? "إشغال الطاولات" : "Table Occupancy"}</span>
              <span className="font-bold text-sm">{Math.round((activeTables / Math.max(totalTables, 1)) * 100)}%</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
              <span className="text-xs text-muted-foreground">{isRTL ? "تنبيهات المخزون" : "Low Stock Alerts"}</span>
              <span className={`font-bold text-sm ${lowStock.length > 0 ? "text-red-600" : ""}`}>{lowStock.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: recent orders + top items + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top selling items */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ChefHat className="size-4 text-primary" />
              {t.admin.topItems}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <EmptyState icon={<ChefHat className="size-5" />} title={isRTL ? "لا بيانات" : "No data yet"} />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scroll-thin pe-1">
                {topItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                    <div className="size-7 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.count} {isRTL ? "طلب" : "sold"}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">
                      {fmtCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              {t.admin.lowStock}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <EmptyState
                icon={<span className="text-xl">✓</span>}
                title={t.admin.noLowStock}
                description={isRTL ? "كل المخزون في مستوى جيد" : "All inventory levels are healthy"}
              />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto scroll-thin pe-1">
                {lowStock.map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50 border border-red-100">
                    <div className="size-8 rounded-md bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                      {Math.round(inv.quantity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{inv.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(inv.quantity)}/{inv.lowThreshold} {inv.unit}
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-[10px]">
                      {isRTL ? "منخفض" : "LOW"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isRTL ? "إجراءات سريعة" : "Quick Actions"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Link href="/kds/expo" target="_blank">
              <button className="p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-start w-full">
                <MonitorIcon />
                <div className="text-sm font-semibold mt-1.5">KDS Expo</div>
                <div className="text-[10px] text-muted-foreground">{isRTL ? "شاشة المطبخ" : "Kitchen view"}</div>
              </button>
            </Link>
            <Link href="/pos" target="_blank">
              <button className="p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-start w-full">
                <ReceiptIcon />
                <div className="text-sm font-semibold mt-1.5">POS</div>
                <div className="text-[10px] text-muted-foreground">{isRTL ? "نقطة البيع" : "Point of Sale"}</div>
              </button>
            </Link>
            <Link href="/" target="_blank">
              <button className="p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-start w-full">
                <StoreIcon />
                <div className="text-sm font-semibold mt-1.5">{isRTL ? "الموقع" : "Storefront"}</div>
                <div className="text-[10px] text-muted-foreground">{isRTL ? "واجهة العملاء" : "Customer view"}</div>
              </button>
            </Link>
            <div className="p-3 rounded-lg border border-dashed border-border bg-muted/20">
              <ClockIcon />
              <div className="text-sm font-semibold mt-1.5">{openHoursLabel(isRTL)}</div>
              <div className="text-[10px] text-muted-foreground">10:00 — 23:00</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BarChart3Icon() {
  return <BarChart3 className="size-4 text-primary" />;
}
function MonitorIcon() {
  return <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center"><ChefHat className="size-4" /></div>;
}
function ReceiptIcon() {
  return <div className="size-7 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center"><Receipt className="size-4" /></div>;
}
function StoreIcon() {
  return <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-700 flex items-center justify-center"><ShoppingBag className="size-4" /></div>;
}
function ClockIcon() {
  return <div className="size-7 rounded-md bg-violet-500/10 text-violet-700 flex items-center justify-center"><Clock className="size-4" /></div>;
}
function openHoursLabel(isRTL: boolean) {
  return isRTL ? "ساعات العمل" : "Open Hours";
}
