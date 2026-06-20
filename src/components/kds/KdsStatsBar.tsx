"use client";

import { Clock, AlertTriangle, CheckCircle2, ListOrdered, Timer, Hourglass } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { KdsOrder, KdsSettings } from "@/lib/kds/types";
import { cn } from "@/lib/utils";

interface KdsStatsBarProps {
  orders: KdsOrder[];
  settings: KdsSettings;
  totalToday?: number;
  connected?: boolean;
  isDark?: boolean;
}

export function KdsStatsBar({ orders, settings, totalToday = 0, connected = false, isDark = false }: KdsStatsBarProps) {
  const { t, isRTL } = useI18n();

  let waiting = 0, preparing = 0, ready = 0, late = 0, totalElapsedSec = 0, countedForAvg = 0;
  const now = Date.now();

  orders.forEach((o) => {
    const items = o.items ?? [];
    if (items.length === 0) return;
    const allReady = items.every((i) => i.status === "ready" || i.status === "served");
    const anyPrep = items.some((i) => i.status === "preparing");
    if (allReady) ready++;
    else if (anyPrep) preparing++;
    else waiting++;
    const elapsedMin = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
    if (elapsedMin >= settings.kdsRedMin) late++;
    if (!allReady) {
      totalElapsedSec += Math.floor((now - new Date(o.createdAt).getTime()) / 1000);
      countedForAvg++;
    }
  });

  const avgSec = countedForAvg > 0 ? Math.floor(totalElapsedSec / countedForAvg) : 0;
  const avgMin = Math.floor(avgSec / 60);
  const avgRemSec = avgSec % 60;

  const stats = [
    { key: "waiting", label: t.kds.waitingOrders, value: waiting, icon: Hourglass,
      color: isDark ? "text-amber-300" : "text-amber-600", bg: isDark ? "bg-amber-500/10" : "bg-amber-50", border: isDark ? "border-amber-500/20" : "border-amber-200" },
    { key: "preparing", label: t.kds.preparing, value: preparing, icon: Clock,
      color: isDark ? "text-sky-300" : "text-sky-600", bg: isDark ? "bg-sky-500/10" : "bg-sky-50", border: isDark ? "border-sky-500/20" : "border-sky-200" },
    { key: "ready", label: t.kds.readyOrders, value: ready, icon: CheckCircle2,
      color: isDark ? "text-emerald-300" : "text-emerald-600", bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50", border: isDark ? "border-emerald-500/20" : "border-emerald-200" },
    { key: "late", label: t.kds.lateCount, value: late, icon: AlertTriangle,
      color: isDark ? "text-red-300" : "text-red-600", bg: isDark ? "bg-red-500/10" : "bg-red-50", border: isDark ? "border-red-500/20" : "border-red-200" },
    { key: "total", label: t.kds.totalToday, value: totalToday, icon: ListOrdered,
      color: isDark ? "text-zinc-200" : "text-zinc-700", bg: isDark ? "bg-white/5" : "bg-zinc-50", border: isDark ? "border-white/10" : "border-zinc-200" },
    { key: "avg", label: t.kds.avgTime, value: `${avgMin}:${String(avgRemSec).padStart(2, "0")}`, icon: Timer,
      color: isDark ? "text-zinc-200" : "text-zinc-700", bg: isDark ? "bg-white/5" : "bg-zinc-50", border: isDark ? "border-white/10" : "border-zinc-200" },
  ];

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3 w-full">
      {stats.map((s) => (
        <div key={s.key} className={cn("rounded-xl px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 border shadow-sm", s.bg, s.border)}>
          <s.icon className={cn("size-5 sm:size-6 shrink-0", s.color)} />
          <div className="min-w-0">
            <div className={cn("text-2xl sm:text-3xl font-black tabular-nums leading-none", s.color)}>{s.value}</div>
            <div className={cn("text-[10px] sm:text-xs uppercase tracking-wider truncate", isDark ? "text-zinc-400" : "text-muted-foreground")}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
