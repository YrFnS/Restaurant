"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  ChefHat,
  Wifi,
  WifiOff,
  Monitor,
  Loader2,
  Search,
  Utensils,
  Sun,
  Moon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  KdsKitchenResponse,
  KdsScreen,
  KdsScreenResponse,
  KdsSettings,
  KdsStation,
} from "@/lib/kds/types";
import { playNewTicketBeep } from "@/lib/kds/sound";
import { KdsTicket } from "./KdsTicket";
import { KdsStatsBar } from "./KdsStatsBar";
import { KdsAllDay } from "./KdsAllDay";
import { cn } from "@/lib/utils";

interface KitchenDisplayProps {
  slug: string;
  initialScreen?: KdsScreenResponse | null;
  initialSettings?: KdsSettings | null;
}

export type KdsTheme = "light" | "dark";

export function KitchenDisplay({ slug, initialScreen, initialSettings }: KitchenDisplayProps) {
  const { t, isRTL } = useI18n();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundOverride, setSoundOverride] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [socketConnected, setSocketConnected] = useState(false);
  const [theme, setTheme] = useState<KdsTheme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("kds-theme") as KdsTheme) || "light";
  });

  const socketRef = useRef<Socket | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Theme management
  useEffect(() => {
    localStorage.setItem("kds-theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  // Theme-aware color tokens
  const c = useMemo(() => {
    if (isDark) {
      return {
        bg: "bg-zinc-950",
        text: "text-zinc-100",
        header: "bg-zinc-950/95 backdrop-blur",
        border: "border-white/10",
        muted: "text-zinc-400",
        accent: "text-amber-400",
        btnBg: "bg-zinc-800",
        btnHover: "hover:bg-zinc-700",
        cardBg: "bg-zinc-900/50",
      };
    }
    return {
      bg: "bg-gradient-to-br from-amber-50/30 via-background to-orange-50/20",
      text: "text-zinc-900",
      header: "bg-background/95 backdrop-blur",
      border: "border-border",
      muted: "text-muted-foreground",
      accent: "text-primary",
      btnBg: "bg-accent",
      btnHover: "hover:bg-accent/70",
      cardBg: "bg-card",
    };
  }, [isDark]);

  // ── Fetch screen config ─────────────────────────────────────────────────
  const screenQuery = useQuery<KdsScreenResponse>({
    queryKey: ["kds-screen", slug],
    queryFn: async () => {
      const r = await fetch(`/api/kitchen-screens?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 15000,
    initialData: initialScreen,
  });

  const screen = screenQuery.data?.screen ?? null;
  const stations: KdsStation[] = screenQuery.data?.stations ?? [];

  // ── Fetch settings ──────────────────────────────────────────────────────
  const settingsQuery = useQuery<KdsSettings>({
    queryKey: ["kds-settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const d = await r.json();
      return d.settings;
    },
    staleTime: 30000,
    initialData: initialSettings,
  });
  const settings = settingsQuery.data;

  // ── Fetch active orders ─────────────────────────────────────────────────
  const ordersQuery = useQuery<KdsKitchenResponse>({
    queryKey: ["kds-orders", slug, screen?.stationFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (screen?.stationFilter) params.set("station", screen.stationFilter);
      else params.set("screen", slug);
      params.set("completed", String(screen?.showCompleted ?? false));
      const r = await fetch(`/api/kitchen?${params}`, { cache: "no-store" });
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    enabled: !!screen,
    refetchInterval: (screen?.autoRefreshSec ?? 10) * 1000,
  });

  const orders = ordersQuery.data?.orders ?? [];
  const allDay = ordersQuery.data?.allDay ?? [];

  // ── Total today count ───────────────────────────────────────────────────
  const totalTodayQuery = useQuery<number>({
    queryKey: ["kds-total-today"],
    queryFn: async () => {
      const r = await fetch("/api/orders?limit=200");
      const d = await r.json();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d.orders?.filter((o: any) => new Date(o.createdAt) >= today).length ?? 0;
    },
    refetchInterval: 30000,
  });
  const totalToday = totalTodayQuery.data ?? 0;

  const soundOn = soundOverride ?? settings?.soundOnNewTicket ?? true;
  const screenStationSlugs = useMemo(() => {
    if (!screen) return [];
    return screen.stationFilter ? screen.stationFilter.split(",").filter(Boolean) : [];
  }, [screen]);

  // ── WebSocket ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!screen) return;
    const socket = io("/?XTransformPort=3003", { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("subscribe", { screen: slug, stations: screenStationSlugs });
    });
    socket.on("disconnect", () => setSocketConnected(false));
    const handler = () => ordersQuery.refetch();
    socket.on("order:new", handler);
    socket.on("order:update", handler);
    socket.on("order:status", handler);
    socket.on("screen:update", handler);
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [screen, slug, screenStationSlugs]);

  // ── New order detection (beep + flash) ──────────────────────────────────
  useEffect(() => {
    if (firstLoadRef.current) {
      if (orders.length > 0) orders.forEach((o) => seenOrderIdsRef.current.add(o.id));
      firstLoadRef.current = false;
      return;
    }
    const fresh = orders.filter((o) => !seenOrderIdsRef.current.has(o.id));
    if (fresh.length > 0 && soundOn) {
      playNewTicketBeep();
      fresh.forEach((o) => toast.success(`${t.kds.orderNumber} ${o.orderNumber}`, { duration: 3000 }));
    }
    fresh.forEach((o) => seenOrderIdsRef.current.add(o.id));
    const freshIds = fresh.map((o) => o.id);
    if (freshIds.length > 0) {
      setNewOrderIds((prev) => new Set([...prev, ...freshIds]));
      setTimeout(() => {
        setNewOrderIds((prev) => {
          const next = new Set(prev);
          freshIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 6000);
    }
  }, [orders, soundOn, t.kds.orderNumber]);

  // ── Fullscreen ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (orders[idx]) setSelectedId(orders[idx].id);
      } else if (e.key === "Enter" && selectedId) {
        const order = orders.find((o) => o.id === selectedId);
        if (order) {
          fetch("/api/kitchen", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id, status: "completed" }),
          }).then(() => ordersQuery.refetch());
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        setSoundOverride((v) => !(v ?? soundOn));
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [orders, selectedId, soundOn, toggleFullscreen, ordersQuery]);

  // ── Loading states ──────────────────────────────────────────────────────
  if (screenQuery.isLoading && !initialScreen) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", c.bg, c.text)}>
        <div className="flex items-center gap-3 text-primary">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-xl font-semibold">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", c.bg, c.text)}>
        <div className="text-center max-w-md">
          <div className="size-20 rounded-3xl bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto mb-4">
            <Monitor className="size-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t.kds.screenNotFound}</h1>
          <p className="text-muted-foreground mb-4">{t.kds.screenNotFoundDesc}</p>
          <code className={cn("px-3 py-1.5 rounded-lg text-sm font-mono", isDark ? "bg-zinc-800 text-amber-300" : "bg-accent text-primary")}>/kds/{slug}</code>
        </div>
      </div>
    );
  }

  if (!screen.isActive) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", c.bg, c.text)}>
        <div className="text-center max-w-md">
          <div className="size-20 rounded-3xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="size-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t.kds.screenOffline}</h1>
          <p className="text-muted-foreground">{t.kds.screenOfflineDesc}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", c.bg, c.text)}>
        <div className="flex items-center gap-3 text-primary">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-xl font-semibold">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  const isExpo = screen.screenType === "expo";
  const autoRefreshSec = screen.autoRefreshSec ?? 10;

  return (
    <div
      ref={containerRef}
      dir={isRTL ? "rtl" : "ltr"}
      className={cn("min-h-screen flex flex-col", c.bg, c.text)}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className={cn("sticky top-0 z-20 backdrop-blur border-b", c.header, c.border)}>
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* Left: screen name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="size-10 sm:size-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: stations[0]?.color ? `${stations[0].color}25` : "rgba(245,158,11,0.15)",
              }}
            >
              <ChefHat className={cn("size-5 sm:size-6", c.accent)} style={{ color: stations[0]?.color || "#f59e0b" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-black tracking-tight leading-tight truncate">
                {screen.name}
              </h1>
              <div className={cn("flex items-center gap-2 text-xs sm:text-sm", c.muted)}>
                <span className={cn("inline-flex items-center gap-1 font-medium", socketConnected ? "text-emerald-500" : "text-red-500")}>
                  {socketConnected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                  {socketConnected ? t.kds.connected : t.kds.disconnected}
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span>{isExpo ? t.kds.expo : t.kds.prep}</span>
                {screenStationSlugs.length > 0 ? (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate">{stations.map((s) => s.name).join(" · ") || screenStationSlugs.join(", ")}</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{t.kds.allStations}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              aria-label="Toggle theme"
              className={cn(
                "size-11 sm:size-12 rounded-xl flex items-center justify-center transition-colors border shadow-sm",
                c.btnBg, c.text, c.border, c.btnHover
              )}
            >
              {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <button
              onClick={() => setSoundOverride((v) => !(v ?? soundOn))}
              aria-label={soundOn ? t.kds.mute : t.kds.unmute}
              className={cn(
                "size-11 sm:size-12 rounded-xl flex items-center justify-center transition-colors border shadow-sm",
                soundOn
                  ? "bg-primary text-primary-foreground border-primary"
                  : cn(c.btnBg, c.text, c.border, c.btnHover)
              )}
            >
              {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t.kds.exitFullscreen : t.kds.fullscreen}
              className={cn(
                "size-11 sm:size-12 rounded-xl flex items-center justify-center transition-colors border shadow-sm",
                c.btnBg, c.text, c.border, c.btnHover
              )}
            >
              {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-3 sm:px-5 pb-3">
          <KdsStatsBar
            orders={orders}
            settings={settings}
            totalToday={totalToday}
            connected={socketConnected}
            isDark={isDark}
          />
        </div>
      </header>

      {/* ── Main content: tickets grid + all-day sidebar ─────────────────── */}
      <main className="flex-1 px-3 sm:px-5 py-3 sm:py-4">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 h-full">
          {/* Tickets */}
          <section className="flex-1 min-w-0">
            {orders.length === 0 ? (
              <EmptyState label={t.kds.noOrders} desc={t.kds.noOrdersDesc} isDark={isDark} />
            ) : (
              <div
                className={cn(
                  "grid gap-3 sm:gap-4",
                  screen.layoutType === "compact"
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                )}
              >
                {orders
                  .slice(0, screen.maxOrders > 0 ? screen.maxOrders : undefined)
                  .map((order, idx) => (
                    <KdsTicket
                      key={order.id}
                      order={order}
                      settings={settings}
                      isNew={newOrderIds.has(order.id)}
                      selected={selectedId === order.id}
                      onSelect={setSelectedId}
                      stationLabel={
                        screenStationSlugs.length > 0
                          ? stations.find((s) => s.slug === order.items[0]?.stationSlug)?.name
                          : undefined
                      }
                      onMutated={() => ordersQuery.refetch()}
                      index={idx}
                      isDark={isDark}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* All-day sidebar */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <KdsAllDay items={allDay} isDark={isDark} />
          </div>
        </div>
      </main>

      {/* ── Footer hint ─────────────────────────────────────────────────── */}
      <footer className={cn("px-3 sm:px-5 py-2 text-[11px] sm:text-xs border-t flex items-center justify-between gap-2", c.border, c.muted)}>
        <span className="flex items-center gap-2">
          <Utensils className="size-3.5" />
          {isRTL ? "اختصارات: 1-9 اختيار · Enter إنهاء · F ملء الشاشة · M كتم" : "Shortcuts: 1-9 select · Enter bump · F fullscreen · M mute"}
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5">
          {isRTL ? "تحديث كل" : "Refresh every"}
          <span className="font-mono font-semibold">{autoRefreshSec}s</span>
        </span>
      </footer>
    </div>
  );
}

function EmptyState({ label, desc, isDark }: { label: string; desc: string; isDark: boolean }) {
  return (
    <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-center gap-3">
      <div className={cn("size-20 rounded-3xl flex items-center justify-center", isDark ? "bg-emerald-500/10" : "bg-emerald-100")}>
        <ChefHat className={cn("size-10", isDark ? "text-emerald-400" : "text-emerald-500")} />
      </div>
      <h2 className={cn("text-3xl font-black", isDark ? "text-zinc-200" : "text-zinc-700")}>{label}</h2>
      <p className="text-muted-foreground max-w-sm">{desc}</p>
    </div>
  );
}
