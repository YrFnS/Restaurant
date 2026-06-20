"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChefHat,
  Clock,
  Flag,
  Flame,
  Play,
  Utensils,
  Bike,
  ShoppingBag,
  AlertTriangle,
  Timer,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  AgeBucket,
  getAgeBucket,
  KdsMenuItem,
  KdsOrder,
  KdsOrderItem,
  KdsSettings,
} from "@/lib/kds/types";
import { playReadyBeep } from "@/lib/kds/sound";
import { cn } from "@/lib/utils";

interface ParsedModifier {
  nameEn: string;
  nameAr: string;
  preset?: string;
}

function parseModifiers(raw: string): ParsedModifier[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((m: any) => ({
      nameEn: m?.nameEn ?? "",
      nameAr: m?.nameAr ?? "",
      preset: m?.preset,
    }));
  } catch {
    return [];
  }
}

function allergenList(item: KdsOrderItem): string[] {
  const raw = item.menuItem?.allergens ?? "";
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Age → color mapping (LIGHT theme) ────────────────────────────────────
const AGE_BORDER_LIGHT: Record<AgeBucket, string> = {
  fresh: "border-l-emerald-500",
  warning: "border-l-amber-500",
  urgent: "border-l-orange-500",
  overdue: "border-l-red-500",
};

const AGE_BORDER_DARK: Record<AgeBucket, string> = {
  fresh: "border-l-emerald-400",
  warning: "border-l-amber-400",
  urgent: "border-l-orange-400",
  overdue: "border-l-red-500",
};

const AGE_TICKET_BG_LIGHT: Record<AgeBucket, string> = {
  fresh: "bg-white",
  warning: "bg-amber-50",
  urgent: "bg-orange-50",
  overdue: "bg-red-50",
};

const AGE_TICKET_BG_DARK: Record<AgeBucket, string> = {
  fresh: "bg-zinc-800/80",
  warning: "bg-zinc-800/90",
  urgent: "bg-orange-950/40",
  overdue: "bg-red-950/50",
};

const AGE_TIMER_LIGHT: Record<AgeBucket, string> = {
  fresh: "text-emerald-600",
  warning: "text-amber-600",
  urgent: "text-orange-600",
  overdue: "text-red-600 animate-pulse",
};

const AGE_TIMER_DARK: Record<AgeBucket, string> = {
  fresh: "text-emerald-400",
  warning: "text-amber-300",
  urgent: "text-orange-400",
  overdue: "text-red-400 animate-pulse",
};

// ── Order type icon ─────────────────────────────────────────────────────────
function OrderTypeIcon({ type }: { type: KdsOrder["type"] }) {
  if (type === "delivery") return <Bike className="size-5" aria-label="Delivery" />;
  if (type === "takeout") return <ShoppingBag className="size-5" aria-label="Takeout" />;
  return <Utensils className="size-5" aria-label="Dine-in" />;
}

// ── Elapsed time hook ────────────────────────────────────────────────────────
function useElapsed(fromIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const startedAt = new Date(fromIso).getTime();
  const diffMs = Math.max(0, now - startedAt);
  const totalSec = Math.floor(diffMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const hrs = Math.floor(min / 60);
  return {
    min,
    sec,
    hrs,
    label: hrs > 0 ? `${hrs}:${String(min % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
    totalMin: min,
  };
}

interface KdsTicketProps {
  order: KdsOrder;
  settings: KdsSettings;
  isNew?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  stationLabel?: string;
  onMutated?: () => void;
  index?: number;
  isDark?: boolean;
}

export function KdsTicket({
  order,
  settings,
  isNew,
  selected,
  onSelect,
  stationLabel,
  onMutated,
  index,
  isDark = false,
}: KdsTicketProps) {
  const { t, isRTL } = useI18n();
  const [busy, setBusy] = useState(false);

  const elapsed = useElapsed(order.createdAt);
  const ageBucket = getAgeBucket(elapsed.totalMin, settings);

  const ageBorder = isDark ? AGE_BORDER_DARK : AGE_BORDER_LIGHT;
  const ageBg = isDark ? AGE_TICKET_BG_DARK : AGE_TICKET_BG_LIGHT;
  const ageTimer = isDark ? AGE_TIMER_DARK : AGE_TIMER_LIGHT;

  const items = order.items ?? [];
  const hasAllergens = items.some((it) => allergenList(it).length > 0);
  const anyPending = items.some((it) => it.status === "pending");
  const anyPreparing = items.some((it) => it.status === "preparing");
  const allItemsReady = items.every((it) => it.status === "ready" || it.status === "served");
  const ticketStateLabel = allItemsReady ? t.kds.ready : anyPreparing ? t.kds.inProgress : t.kds.new;

  // Group items by course
  const itemsByCourse = useMemo(() => {
    const map = new Map<number, KdsOrderItem[]>();
    items.forEach((it) => {
      const c = it.course ?? 1;
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(it);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  const nameOf = (mi?: KdsMenuItem) => (isRTL ? mi?.nameAr || mi?.nameEn || "—" : mi?.nameEn || mi?.nameAr || "—");

  const patch = async (payload: { itemId?: string; orderId?: string; status: string }) => {
    setBusy(true);
    try {
      await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (payload.status === "ready") playReadyBeep();
      onMutated?.();
    } finally {
      setBusy(false);
    }
  };

  const startAll = () => items.filter((it) => it.status === "pending").forEach((it) => patch({ itemId: it.id, status: "preparing" }));
  const bumpAll = () => items.filter((it) => it.status !== "ready" && it.status !== "served").forEach((it) => patch({ itemId: it.id, status: "ready" }));

  const tableLabel = order.table
    ? `${t.kds.table} ${order.table.number}`
    : order.type === "dine_in" ? t.kds.table
    : order.type === "takeout" ? (isRTL ? "تيك أوت" : "Takeout")
    : (isRTL ? "توصيل" : "Delivery");

  // Theme-aware classes
  const headerBorder = isDark ? "border-white/10" : "border-zinc-100";
  const itemBgReady = isDark ? "bg-emerald-900/30" : "bg-emerald-50";
  const itemBgPrep = isDark ? "bg-sky-900/30" : "bg-sky-50";
  const itemBgPending = isDark ? "bg-zinc-900/40" : "bg-zinc-50";
  const modNo = isDark ? "text-red-300" : "text-red-600";
  const modExtra = isDark ? "text-amber-300" : "text-amber-600";
  const modDefault = isDark ? "text-zinc-300" : "text-zinc-600";
  const notesColor = isDark ? "text-amber-200" : "text-amber-700";
  const footerBorder = isDark ? "border-white/10" : "border-zinc-100";

  return (
    <article
      dir={isRTL ? "rtl" : "ltr"}
      onClick={() => onSelect?.(order.id)}
      className={cn(
        "relative flex flex-col rounded-2xl border-l-4 shadow-lg overflow-hidden transition-all hover:shadow-xl",
        ageBorder[ageBucket],
        ageBg[ageBucket],
        isNew && "kds-flash",
        selected && (isDark ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950" : "ring-2 ring-primary ring-offset-2 ring-offset-background"),
        ageBucket === "overdue" && (isDark ? "ring-1 ring-red-500/60" : "ring-1 ring-red-400"),
        isDark ? "text-zinc-100" : "text-zinc-900"
      )}
      style={{ minHeight: "320px" }}
    >
      {/* Allergen red banner */}
      {hasAllergens && (
        <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2 font-bold text-base sm:text-lg">
          <AlertTriangle className="size-6 shrink-0" />
          <span className="tracking-wide">{t.kds.allergenAlert}</span>
        </div>
      )}

      {/* Header */}
      <header className={cn("px-4 pt-3 pb-2 flex items-start justify-between gap-3 border-b", headerBorder)}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tabular-nums leading-none">
              {order.orderNumber.replace(/^#/, "")}
            </span>
            {index !== undefined && (
              <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", isDark ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-500")}>
                {index + 1}
              </span>
            )}
          </div>
          <div className={cn("flex items-center gap-2 text-sm mt-1", isDark ? "text-zinc-300" : "text-zinc-600")}>
            <OrderTypeIcon type={order.type} />
            <span className="font-medium">{tableLabel}</span>
            {order.serverName && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className={isDark ? "text-zinc-400" : "text-zinc-500"}>
                  {t.kds.server}: <span className={isDark ? "text-zinc-200" : "text-zinc-700"}>{order.serverName}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={cn("flex items-center gap-1.5 font-mono font-bold tabular-nums text-2xl sm:text-3xl", ageTimer[ageBucket])}>
            <Clock className="size-5" />
            {elapsed.label}
          </div>
          <span
            className={cn(
              "text-[10px] sm:text-xs font-bold tracking-wider px-2 py-0.5 rounded-full",
              allItemsReady
                ? "bg-emerald-500 text-white"
                : anyPreparing
                ? "bg-sky-500 text-white"
                : isDark ? "bg-zinc-700 text-zinc-200" : "bg-zinc-200 text-zinc-700"
            )}
          >
            {ticketStateLabel}
          </span>
        </div>
      </header>

      {/* Items grouped by course */}
      <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto scroll-thin">
        {itemsByCourse.map(([course, items]) => (
          <section key={course}>
            <div className="flex items-center gap-2 mb-1.5 text-primary">
              <span className="text-[10px] font-bold tracking-widest uppercase">{t.kds.course} {course}</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
            <ul className="space-y-2">
              {items.map((it) => {
                const mods = parseModifiers(it.modifiers);
                const allergens = allergenList(it);
                const itemReady = it.status === "ready" || it.status === "served";
                return (
                  <li
                    key={it.id}
                    className={cn(
                      "rounded-lg p-2.5 border",
                      isDark ? "border-white/5" : "border-zinc-100",
                      itemReady ? itemBgReady : it.status === "preparing" ? itemBgPrep : itemBgPending
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "shrink-0 inline-flex items-center justify-center rounded-md font-black text-xl sm:text-2xl tabular-nums px-2 py-0.5",
                          itemReady ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"
                        )}
                      >
                        {it.quantity}×
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-lg sm:text-xl font-semibold leading-tight",
                            itemReady && (isDark ? "line-through text-zinc-500" : "line-through text-zinc-400")
                          )}
                        >
                          {nameOf(it.menuItem)}
                        </div>
                        {mods.length > 0 && (
                          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                            {mods.map((m, i) => (
                              <li
                                key={i}
                                className={cn(
                                  "font-medium",
                                  m.preset === "no" || m.preset === "light" ? modNo
                                  : m.preset === "extra" || m.preset === "spicy" ? modExtra
                                  : modDefault
                                )}
                              >
                                • {isRTL ? m.nameAr || m.nameEn : m.nameEn || m.nameAr}
                              </li>
                            ))}
                          </ul>
                        )}
                        {allergens.length > 0 && (
                          <div className={cn("mt-1 text-xs font-semibold flex items-center gap-1", modNo)}>
                            <AlertTriangle className="size-3.5" />
                            {allergens.join(", ")}
                          </div>
                        )}
                        {it.notes && (
                          <div className={cn("mt-1 text-sm italic", notesColor)}>“{it.notes}”</div>
                        )}
                        {it.seatNumber != null && (
                          <div className={cn("mt-0.5 text-xs", isDark ? "text-zinc-400" : "text-zinc-500")}>
                            {isRTL ? `مقعد ${it.seatNumber}` : `Seat ${it.seatNumber}`}
                          </div>
                        )}
                      </div>
                      {/* Per-item bump */}
                      {!itemReady && (
                        <button
                          onClick={(e) => { e.stopPropagation(); patch({ itemId: it.id, status: "ready" }); }}
                          disabled={busy}
                          aria-label="Bump item"
                          className="shrink-0 size-11 sm:size-12 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check className="size-6" strokeWidth={3} />
                        </button>
                      )}
                      {itemReady && (
                        <span className="shrink-0 size-11 sm:size-12 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                          <Check className="size-6" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {order.notes && (
          <div className={cn("mt-2 p-2 rounded-lg border text-sm", isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-800")}>
            <span className="font-bold">{isRTL ? "ملاحظات الطلب:" : "Order notes:"} </span>
            {order.notes}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <footer className={cn("px-3 py-3 border-t flex items-center gap-2", footerBorder)}>
        {stationLabel && (
          <span className={cn("text-xs px-2 py-1 rounded hidden sm:inline-flex items-center gap-1", isDark ? "bg-white/5 text-zinc-300" : "bg-zinc-100 text-zinc-600")}>
            <ChefHat className="size-3.5" />
            {stationLabel}
          </span>
        )}
        <div className="flex-1 flex items-center gap-2">
          {anyPending && (
            <button
              onClick={(e) => { e.stopPropagation(); startAll(); }}
              disabled={busy}
              className="flex-1 h-14 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Play className="size-5" fill="currentColor" />
              {t.kds.start}
            </button>
          )}
          {!allItemsReady && !anyPending && (
            <button
              onClick={(e) => { e.stopPropagation(); startAll(); }}
              disabled={busy}
              className="flex-1 h-14 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Flame className="size-5" />
              {t.kds.fireCourse.replace("{n}", "").trim() || (isRTL ? "إطلاق" : "Fire")}
            </button>
          )}
          {!allItemsReady && (
            <button
              onClick={(e) => { e.stopPropagation(); bumpAll(); }}
              disabled={busy}
              className="flex-1 h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Timer className="size-5" />
              {t.kds.bump} {t.kds.allDay === "الإجمالي" ? "الكل" : "All"}
            </button>
          )}
          {allItemsReady && (
            <div className="flex-1 h-14 rounded-xl bg-emerald-500/15 text-emerald-500 font-bold text-lg flex items-center justify-center gap-2">
              <Check className="size-6" strokeWidth={3} />
              {t.kds.ready}
            </div>
          )}
        </div>
      </footer>

      {/* Overdue ribbon */}
      {ageBucket === "overdue" && (
        <div className="absolute top-0 inset-inline-0 h-1 bg-red-500 animate-pulse" />
      )}
    </article>
  );
}

export { allergenList, parseModifiers };
