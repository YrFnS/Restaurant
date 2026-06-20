"use client";

import { ChefHat, Hash } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { KdsAllDayItem } from "@/lib/kds/types";
import { cn } from "@/lib/utils";

interface KdsAllDayProps {
  items: KdsAllDayItem[];
  title?: string;
  isDark?: boolean;
}

export function KdsAllDay({ items, title, isDark = false }: KdsAllDayProps) {
  const { t, isRTL } = useI18n();
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((acc, i) => acc + i.count, 0);

  return (
    <aside
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "flex flex-col h-full rounded-2xl overflow-hidden border shadow-sm",
        isDark ? "bg-zinc-900/70 border-white/10" : "bg-card border-border"
      )}
    >
      <header className={cn(
        "px-4 py-3 border-b flex items-center justify-between gap-2",
        isDark ? "bg-amber-500/10 border-white/10" : "bg-primary/5 border-border"
      )}>
        <div className={cn("flex items-center gap-2", isDark ? "text-amber-300" : "text-primary")}>
          <ChefHat className="size-5" />
          <h2 className="text-lg sm:text-xl font-bold">{title || t.kds.allDay}</h2>
        </div>
        <span className={cn("text-3xl sm:text-4xl font-black tabular-nums", isDark ? "text-amber-300" : "text-primary")}>
          {totalCount}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto scroll-thin px-2 py-2 max-h-[60vh] lg:max-h-none">
        {sorted.length === 0 ? (
          <div className={cn("text-center py-8 px-3 text-sm", isDark ? "text-zinc-500" : "text-muted-foreground")}>
            {isRTL ? "لا توجد أصناف نشطة" : "No active items"}
          </div>
        ) : (
          <ul className="space-y-1">
            {sorted.map((it, idx) => {
              const name = isRTL ? it.nameAr || it.nameEn : it.nameEn || it.nameAr;
              return (
                <li
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors",
                    isDark ? "bg-zinc-800/60 hover:bg-zinc-800" : "bg-accent/50 hover:bg-accent"
                  )}
                >
                  <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground font-black text-lg sm:text-xl tabular-nums size-9 sm:size-10">
                    {it.count}
                  </span>
                  <span className={cn("flex-1 min-w-0 text-base sm:text-lg font-medium leading-tight break-words", isDark ? "text-zinc-100" : "text-foreground")}>
                    {name}
                  </span>
                  <Hash className={cn("size-3.5 shrink-0", isDark ? "text-zinc-600" : "text-muted-foreground/40")} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
