"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, CheckCircle2, ChefHat } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { StationHeader } from "./station/StationHeader";
import { StationOrderCard } from "./station/StationOrderCard";

interface StationData {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

interface OrderItemData {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNameAr: string;
  quantity: number;
  unitPrice: number;
  modifiers: string;
  notes: string | null;
  totalPrice: number;
  status: string;
  station: string;
  hold: boolean;
  seatNumber: number | null;
}

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  customerName: string;
  notes: string | null;
  tableNumber: number | null;
  createdAt: string;
  items: OrderItemData[];
}

function getElapsedSeconds(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function playDingSound() {
  try {
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1200, ctx.currentTime);
    osc1.frequency.setValueAtTime(1600, ctx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
  } catch { /* silent fail */ }
}

export default function StationDisplay({ stationSlug }: { stationSlug: Promise<{ station: string }> }) {
  const { t, locale, isRTL } = useI18n();
  const [slug, setSlug] = useState<string>("");
  const [station, setStation] = useState<StationData | null>(null);
  const [stations, setStations] = useState<StationData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderData[]>([]);
  const [sortMode, setSortMode] = useState<"time" | "priority">("time");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showControls, setShowControls] = useState(false);
  const prevOrderCountRef = useRef(0);

  useEffect(() => { stationSlug.then((params) => setSlug(params.station)); }, [stationSlug]);

  useEffect(() => {
    if (!slug) return;
    const fetchStation = async () => {
      try {
        const res = await fetch("/api/stations");
        if (res.ok) {
          const data = await res.json();
          const allStations = data.stations || [];
          setStations(allStations);
          if (slug !== "all") {
            const found = allStations.find((s: StationData) => s.slug.toLowerCase() === slug.toLowerCase());
            setStation(found || null);
          }
        }
      } catch (e) { console.error("Failed to fetch station:", e); }
    };
    fetchStation();
  }, [slug]);

  const fetchOrders = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch("/api/orders?status=active");
      if (res.ok) {
        const data = await res.json();
        const mapped: OrderData[] = (data.orders || data || []).map((o: Record<string, unknown>) => ({
          id: o.id, orderNumber: o.orderNumber, type: o.type, status: o.status,
          customerName: o.customerName || "", notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt,
          items: (o.items as OrderItemData[] || []).map((item: OrderItemData) => ({
            id: item.id, menuItemId: item.menuItemId,
            menuItemName: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameEn || t.kitchen.unknownItem,
            menuItemNameAr: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameAr || "",
            quantity: item.quantity, unitPrice: item.unitPrice, modifiers: item.modifiers,
            notes: item.notes, totalPrice: item.totalPrice, status: item.status || "pending",
            station: item.station || "prep", hold: item.hold || false, seatNumber: item.seatNumber,
          })),
        }));
        const stationOrders = slug === "all" ? mapped : mapped.filter((order) => order.items.some((item) => item.station?.toLowerCase() === slug.toLowerCase()));
        setOrders(stationOrders);
        if (soundEnabled && stationOrders.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) playDingSound();
        prevOrderCountRef.current = stationOrders.length;
      }
      const compRes = await fetch("/api/orders?status=completed");
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompletedOrders((compData.orders || compData || []).slice(0, 5).map((o: Record<string, unknown>) => ({
          id: o.id, orderNumber: o.orderNumber, type: o.type, status: o.status,
          customerName: o.customerName || "", notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt, items: (o.items as OrderItemData[] || []),
        })));
      }
    } catch (e) { console.error("Failed to fetch orders:", e); }
    setLastUpdated(new Date());
    setLoading(false);
  }, [slug, soundEnabled, t]);

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await fetchOrders(); };
    load();
    const interval = setInterval(() => { if (mounted) fetchOrders(); }, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchOrders]);

  const handleBump = async (itemId: string) => {
    try { await fetch(`/api/orders/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ready" }) }); fetchOrders(); }
    catch (e) { console.error("Failed to bump item:", e); }
  };
  const handleFire = async (itemId: string) => {
    try { await fetch(`/api/orders/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hold: false, status: "fired" }) }); fetchOrders(); }
    catch (e) { console.error("Failed to fire item:", e); }
  };
  const handleBumpAll = async (order: OrderData) => {
    try {
      const itemsToBump = slug === "all" ? order.items : order.items.filter((item) => item.station?.toLowerCase() === slug.toLowerCase());
      await Promise.all(itemsToBump.filter((item) => !["ready", "served", "cancelled"].includes(item.status)).map((item) => fetch(`/api/orders/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ready" }) })));
      fetchOrders();
    } catch (e) { console.error("Failed to bump all:", e); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const allDaySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((order) => { order.items.forEach((item) => {
      if (["ready", "served", "cancelled"].includes(item.status)) return;
      if (slug === "all" || item.station?.toLowerCase() === slug.toLowerCase()) {
        const name = locale === "ar" && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName;
        counts[name] = (counts[name] || 0) + item.quantity;
      }
    }); });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders, slug, locale]);

  const stats = useMemo(() => {
    const allItems = orders.flatMap((o) => o.items);
    const stationItems = slug === "all" ? allItems : allItems.filter((i) => i.station?.toLowerCase() === slug.toLowerCase());
    const completedItems = stationItems.filter((i) => ["ready", "served"].includes(i.status));
    const avgWait = orders.length > 0 ? orders.reduce((sum, o) => sum + getElapsedSeconds(o.createdAt), 0) / orders.length : 0;
    const priorityCount = orders.filter((o) => getElapsedSeconds(o.createdAt) > 15 * 60).length;
    const activeItems = stationItems.filter((i) => !["ready", "served", "cancelled"].includes(i.status));
    return { totalActive: orders.length, avgWait, completedItems: completedItems.length, totalItems: stationItems.length, activeItems: activeItems.length, priorityCount };
  }, [orders, slug]);

  const sortedOrders = useMemo(() => {
    if (sortMode === "priority") return [...orders].sort((a, b) => getElapsedSeconds(b.createdAt) - getElapsedSeconds(a.createdAt));
    return orders;
  }, [orders, sortMode]);

  const stationColor = station?.color || "#f59e0b";
  const stationName = slug === "all" ? t.staff.allStations : (station?.name || slug);

  if (!slug) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRTL ? "rtl" : "ltr"}>
      <StationHeader
        stationName={stationName} stationColor={stationColor}
        stationIcon={station?.icon || "ChefHat"} isAllStations={slug === "all"}
        activeItems={stats.activeItems} priorityCount={stats.priorityCount}
        avgWait={stats.avgWait} completedItems={stats.completedItems} totalItems={stats.totalItems}
        allDaySummary={allDaySummary} sortMode={sortMode}
        soundEnabled={soundEnabled} isFullscreen={isFullscreen} showControls={showControls}
        onRefresh={fetchOrders} onSortToggle={() => setSortMode(sortMode === "time" ? "priority" : "time")}
        onSoundToggle={() => setSoundEnabled(!soundEnabled)} onFullscreenToggle={toggleFullscreen}
        onShowControlsToggle={() => setShowControls(!showControls)} isRTL={isRTL}
      />

      {/* Order Cards Grid */}
      <div className="p-2 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin text-amber-500 me-2" /> {t.common.loading}
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ChefHat className="size-12 mb-3 opacity-20" />
            <p className="text-base font-medium">{t.staff.noActiveOrders}</p>
            <p className="text-sm">{stationName}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {sortedOrders.map((order, idx) => (
              <StationOrderCard key={order.id} order={order} stationSlug={slug} stationColor={stationColor} onBump={handleBump} onFire={handleFire} onBumpAll={handleBumpAll} orderIndex={idx} />
            ))}
          </div>
        )}

        {completedOrders.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t.staff.recentlyCompleted}</h2>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 font-medium rounded-full">{completedOrders.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {completedOrders.map((order) => (
                <div key={order.id} className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">#{order.orderNumber}</span>
                    {order.tableNumber && <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] px-1.5 py-0.5 font-medium rounded-full">T{order.tableNumber}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{order.items.length} {t.staff.items}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
