"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, TrendingUp, DollarSign, ShoppingBag, Receipt, Award } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { motion } from "framer-motion";

const CHART_COLORS = ["#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#22c55e", "#ec4899", "#84cc16", "#f97316"];

export default function AdminAnalyticsPage() {
  const { t, isRTL, fmtCurrency, fmtNumber, fmtDate } = useI18n();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => (await fetch(`/api/analytics?days=${days}`)).json(),
  });

  const summary = data?.summary;
  const dailyRevenue = data?.dailyRevenue || [];
  const topItemsByRevenue = data?.topItemsByRevenue || [];
  const salesByCategory = data?.salesByCategory || [];
  const salesByDayOfWeek = data?.salesByDayOfWeek || [];
  const salesByHour = data?.salesByHour || [];
  const orderTypes = data?.orderTypes || [];

  const periodButtons = [
    { days: 7, label: isRTL ? "٧ أيام" : "7 days" },
    { days: 30, label: isRTL ? "٣٠ يوم" : "30 days" },
    { days: 90, label: isRTL ? "٩٠ يوم" : "90 days" },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                {isRTL ? "تحليلات المبيعات" : "Sales Analytics"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "رؤى عميقة حول الأداء" : "Deep insights into performance"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {periodButtons.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  days === p.days ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: isRTL ? "إجمالي الإيرادات" : "Total Revenue", value: fmtCurrency(summary?.totalRevenue || 0), icon: DollarSign, color: "text-green-600", bg: "from-green-500/5" },
                { label: isRTL ? "إجمالي الطلبات" : "Total Orders", value: fmtNumber(summary?.totalOrders || 0), icon: ShoppingBag, color: "text-primary", bg: "from-primary/5" },
                { label: isRTL ? "متوسط الفاتورة" : "Avg Ticket", value: fmtCurrency(summary?.avgTicket || 0), icon: Receipt, color: "text-amber-600", bg: "from-amber-500/5" },
                { label: isRTL ? "أصناف مُباعة" : "Items Sold", value: fmtNumber(summary?.uniqueItems || 0), icon: Award, color: "text-violet-600", bg: "from-violet-500/5" },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`bg-gradient-to-br ${s.bg} to-transparent`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                          <Icon className={`size-4 ${s.color}`} />
                        </div>
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Revenue trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  {isRTL ? "اتجاه الإيرادات" : "Revenue Trend"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      tickFormatter={(v) => v.slice(5)}
                      reversed={isRTL}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} orientation={isRTL ? "right" : "left"} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
                      formatter={(v: any) => [fmtCurrency(v), isRTL ? "الإيرادات" : "Revenue"]}
                      labelFormatter={(l) => fmtDate(l)}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top items by revenue */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="size-4 text-primary" />
                    {isRTL ? "أعلى الأصناف (إيرادات)" : "Top Items (Revenue)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topItemsByRevenue.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا بيانات" : "No data"}</p>
                  ) : (
                    <div className="space-y-2">
                      {topItemsByRevenue.slice(0, 8).map((item: any, i: number) => {
                        const maxRev = topItemsByRevenue[0]?.revenue || 1;
                        const pct = (item.revenue / maxRev) * 100;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium truncate">{isRTL ? item.nameAr || item.name : item.name}</span>
                                <span className="font-bold text-primary shrink-0 ms-2">{fmtCurrency(item.revenue)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5, delay: i * 0.05 }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{item.qty} {isRTL ? "وحدة" : "sold"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sales by category pie */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="size-4 text-primary" />
                    {isRTL ? "المبيعات حسب الفئة" : "Sales by Category"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesByCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا بيانات" : "No data"}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={salesByCategory}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={40}
                          label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                          style={{ fontSize: 10 }}
                        >
                          {salesByCategory.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => fmtCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Sales by day of week */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{isRTL ? "المبيعات حسب اليوم" : "Sales by Day of Week"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesByDayOfWeek} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                      <XAxis dataKey={isRTL ? "dayAr" : "day"} tick={{ fontSize: 11, fill: "#71717a" }} reversed={isRTL} />
                      <YAxis tick={{ fontSize: 10, fill: "#71717a" }} orientation={isRTL ? "right" : "left"} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
                        formatter={(v: any) => [fmtCurrency(v), isRTL ? "الإيرادات" : "Revenue"]}
                      />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {salesByDayOfWeek.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Sales by hour */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{isRTL ? "المبيعات حسب الساعة" : "Sales by Hour"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesByHour} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        tickFormatter={(v) => v.replace(":00", "")}
                        reversed={isRTL}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#71717a" }} orientation={isRTL ? "right" : "left"} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
                        formatter={(v: any) => [fmtCurrency(v), isRTL ? "الإيرادات" : "Revenue"]}
                      />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Order types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isRTL ? "أنواع الطلبات" : "Order Types"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {orderTypes.map((ot: any, i: number) => {
                    const totalRev = orderTypes.reduce((s: number, o: any) => s + o.revenue, 0) || 1;
                    const pct = Math.round((ot.revenue / totalRev) * 100);
                    const labels: Record<string, { en: string; ar: string; icon: string }> = {
                      dine_in: { en: "Dine In", ar: "في المطعم", icon: "🍽️" },
                      takeout: { en: "Takeout", ar: "أخذ خارج", icon: "🥡" },
                      delivery: { en: "Delivery", ar: "توصيل", icon: "🛵" },
                    };
                    const label = labels[ot.type] || { en: ot.type, ar: ot.type, icon: "📋" };
                    return (
                      <div key={i} className="p-4 rounded-xl border border-border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl">{label.icon}</span>
                          <Badge variant="secondary" className="text-[10px]">{pct}%</Badge>
                        </div>
                        <div className="font-semibold text-sm">{isRTL ? label.ar : label.en}</div>
                        <div className="text-lg font-bold text-primary mt-1">{fmtCurrency(ot.revenue)}</div>
                        <div className="text-[11px] text-muted-foreground">{ot.count} {isRTL ? "طلب" : "orders"}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
