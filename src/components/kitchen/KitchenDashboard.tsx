'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Flame, Clock, Check,
  RefreshCw, Volume2, VolumeX, Maximize, Minimize,
  Zap, Activity, Monitor, Settings2, ArrowUpDown,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { KitchenStatsBar, KitchenQuickActions, KitchenKdsScreens } from './dashboard/KitchenStats';
import { KitchenOrderQueue } from './dashboard/KitchenOrderQueue';

// ============ TYPES ============
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

type SortMode = 'time' | 'priority';

interface KitchenScreenData {
  id: string;
  name: string;
  slug: string;
  description: string;
  stationFilter: string;
  layoutType: string;
  autoRefreshInterval: number;
  showCompleted: boolean;
  maxOrders: number;
  sortOrder: number;
  isActive: boolean;
}

// ============ HELPERS ============
const getStationName = (name: string, locale: string) => {
  if (locale !== 'ar') return name;
  const map: Record<string, string> = {
    'Grill Station': 'محطة الشوي',
    'Prep Station': 'محطة التحضير',
    'Bar Station': 'محطة البار',
    'All Stations': 'جميع المحطات',
    'Grill': 'الشوي',
    'Prep': 'التحضير',
    'Bar': 'البار',
  };
  return map[name] || name;
};

function getElapsedSeconds(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getStationIcon(iconName: string, size: string = 'size-4'): React.ReactNode {
  const cls = size;
  const iconMap: Record<string, React.ReactNode> = {
    Flame: <Flame className={cls} />,
    ChefHat: <Flame className={cls} />,
    Snowflake: <Flame className={cls} />,
    Wine: <Flame className={cls} />,
    Eye: <Flame className={cls} />,
    Activity: <Activity className={cls} />,
    UtensilsCrossed: <Flame className={cls} />,
  };
  return iconMap[iconName] || <Flame className={cls} />;
}

function playDingSound() {
  try {
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, ctx.currentTime);
    osc1.frequency.setValueAtTime(1600, ctx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
  } catch { /* silent fail */ }
}

// ============ MAIN KITCHEN DASHBOARD ============
export default function KitchenDashboard() {
  const { t, locale, isRTL } = useI18n();
  const [stations, setStations] = useState<StationData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [kdsScreens, setKdsScreens] = useState<KitchenScreenData[]>([]);
  const prevOrderCountRef = useRef(0);

  // Fetch KDS screens
  useEffect(() => {
    const fetchScreens = async () => {
      try {
        const res = await fetch('/api/kitchen-screens');
        if (res.ok) {
          const data = await res.json();
          setKdsScreens(data.screens || []);
        }
      } catch (e) { console.error('Failed to fetch KDS screens:', e); }
    };
    fetchScreens();
  }, []);

  // Fetch stations and orders
  const fetchData = useCallback(async () => {
    try {
      const [stationsRes, ordersRes] = await Promise.all([
        fetch('/api/stations'),
        fetch('/api/orders?status=active'),
      ]);

      if (stationsRes.ok) {
        const stationsData = await stationsRes.json();
        setStations(stationsData.stations || []);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const mapped: OrderData[] = (ordersData.orders || ordersData || []).map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          status: o.status,
          customerName: o.customerName || '',
          notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt,
          items: (o.items as OrderItemData[] || []).map((item: OrderItemData) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            menuItemName: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameEn || t.kitchen.unknownItem,
            menuItemNameAr: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameAr || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            modifiers: item.modifiers,
            notes: item.notes,
            totalPrice: item.totalPrice,
            status: item.status || 'pending',
            station: item.station || 'prep',
            hold: item.hold || false,
            seatNumber: item.seatNumber,
          })),
        }));

        if (soundEnabled && mapped.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
          playDingSound();
        }
        prevOrderCountRef.current = mapped.length;
        setOrders(mapped);
      }

      // Fetch completed orders
      const compRes = await fetch('/api/orders?status=completed');
      if (compRes.ok) {
        const compData = await compRes.json();
        const completed: OrderData[] = (compData.orders || compData || []).slice(0, 5).map((o: Record<string, unknown>) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          status: o.status,
          customerName: o.customerName || '',
          notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt,
          items: (o.items as OrderItemData[] || []),
        }));
        setCompletedOrders(completed);
      }
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
    setLastUpdated(new Date());
    setLoading(false);
  }, [soundEnabled, t]);

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await fetchData(); };
    load();
    const interval = setInterval(() => { if (mounted) fetchData(); }, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchData]);

  // Handlers
  const handleBump = async (itemId: string) => {
    try {
      await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) });
      fetchData();
    } catch (e) { console.error('Failed to bump item:', e); }
  };

  const handleFire = async (itemId: string) => {
    try {
      await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hold: false, status: 'fired' }) });
      fetchData();
    } catch (e) { console.error('Failed to fire item:', e); }
  };

  const handleBumpAll = async (order: OrderData) => {
    try {
      const itemsToBump = activeStation === 'all'
        ? order.items
        : order.items.filter((item) => item.station?.toLowerCase() === activeStation.toLowerCase());
      await Promise.all(
        itemsToBump
          .filter((item) => !['ready', 'served', 'cancelled'].includes(item.status))
          .map((item) => fetch(`/api/orders/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) }))
      );
      fetchData();
    } catch (e) { console.error('Failed to bump all:', e); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  // Computed values
  const stationColor = activeStation === 'all'
    ? '#f59e0b'
    : stations.find(s => s.slug === activeStation)?.color || '#f59e0b';

  const stationItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stations.forEach(s => { counts[s.slug] = 0; });
    orders.forEach(order => {
      order.items.forEach(item => {
        if (['ready', 'served', 'cancelled'].includes(item.status)) return;
        const station = stations.find(s => s.slug.toLowerCase() === item.station?.toLowerCase() || s.name.toLowerCase() === item.station?.toLowerCase());
        if (station && counts[station.slug] !== undefined) counts[station.slug] += item.quantity;
      });
    });
    return counts;
  }, [orders, stations]);

  const stationPriorityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stations.forEach(s => { counts[s.slug] = 0; });
    orders.forEach(order => {
      if (getElapsedSeconds(order.createdAt) <= 15 * 60) return;
      order.items.forEach(item => {
        if (['ready', 'served', 'cancelled'].includes(item.status)) return;
        const station = stations.find(s => s.slug.toLowerCase() === item.station?.toLowerCase() || s.name.toLowerCase() === item.station?.toLowerCase());
        if (station && counts[station.slug] !== undefined) counts[station.slug] += 1;
      });
    });
    return counts;
  }, [orders, stations]);

  const allDaySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (['ready', 'served', 'cancelled'].includes(item.status)) return;
        const stationMatch = activeStation === 'all' || item.station?.toLowerCase() === activeStation.toLowerCase();
        if (stationMatch) {
          const name = locale === 'ar' && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName;
          counts[name] = (counts[name] || 0) + item.quantity;
        }
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders, activeStation, locale]);

  const stats = useMemo(() => {
    const allItems = orders.flatMap((o) => o.items);
    const stationItems = activeStation === 'all' ? allItems : allItems.filter((i) => i.station?.toLowerCase() === activeStation.toLowerCase());
    const completedItems = stationItems.filter((i) => ['ready', 'served'].includes(i.status));
    const avgWait = orders.length > 0 ? orders.reduce((sum, o) => sum + getElapsedSeconds(o.createdAt), 0) / orders.length : 0;
    const priorityCount = orders.filter((o) => getElapsedSeconds(o.createdAt) > 15 * 60).length;
    return { totalActive: orders.length, avgWait, completedItems: completedItems.length, totalItems: stationItems.length, priorityCount };
  }, [orders, activeStation]);

  const filteredOrders = useMemo(() => {
    if (activeStation === 'all') return orders;
    return orders.filter(order => order.items.some(item => item.station?.toLowerCase() === activeStation.toLowerCase()));
  }, [orders, activeStation]);

  const sortedOrders = useMemo(() => {
    if (sortMode === 'priority') {
      return [...filteredOrders].sort((a, b) => getElapsedSeconds(b.createdAt) - getElapsedSeconds(a.createdAt));
    }
    return filteredOrders;
  }, [filteredOrders, sortMode]);

  const totalActiveItems = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.items.filter(i => !['ready', 'served', 'cancelled'].includes(i.status)).length, 0);
  }, [orders]);

  const totalPriorityAlerts = useMemo(() => {
    return Object.values(stationPriorityCounts).reduce((a, b) => a + b, 0);
  }, [stationPriorityCounts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="relative">
            <RefreshCw className="size-8 animate-spin text-amber-500" />
          </div>
          <span className="text-sm">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-amber-50/10 to-amber-50/20 dark:via-amber-950/5 dark:to-amber-950/10 text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ========== GRADIENT HERO HEADER ========== */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 px-4 sm:px-6 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/20 border border-white/10">
            <Flame className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white leading-tight flex items-center gap-2">
              {t.kitchen.title}
              {stats.totalActive > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
                  <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span><span className="relative inline-flex rounded-full size-2 bg-emerald-300"></span></span>
                  {t.staff.live}
                </span>
              )}
            </h1>
            <p className="text-[11px] text-white/70 font-medium">{t.kitchen.lastUpdated} {lastUpdated.toLocaleTimeString()}</p>
          </div>
        </div>
        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs font-semibold border border-white/10"><Clock className="size-3.5" />{t.staff.avg} <strong className="text-white">{formatElapsed(stats.avgWait)}</strong></span>
          <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs font-semibold border border-white/10"><Check className="size-3.5" />{t.staff.done} <strong className="text-white">{stats.completedItems}/{stats.totalItems}</strong></span>
          {stats.priorityCount > 0 && (
            <span className="flex items-center gap-1.5 bg-red-500/30 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white text-xs font-bold animate-pulse border border-red-400/30"><Zap className="size-3.5" />{stats.priorityCount} {t.staff.alert}</span>
          )}
        </div>
      </div>

      {/* ========== HEADER ========== */}
      <div className="sticky top-12 z-40 bg-card/95 backdrop-blur-md border-b border-amber-500/20 shadow-sm">
        {/* Row 1: Title + Nav + Station tabs + Controls */}
        <div className="px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Station label */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm shadow-amber-500/20">
                <Flame className="size-4 text-white" />
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider hidden sm:inline">
                {activeStation === 'all' ? getStationName(t.kitchen.allStations, locale) : stations.find(s => s.slug === activeStation)?.name || activeStation}
              </span>
            </div>

            {/* Center: Station pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 justify-center">
              <Button variant={activeStation === 'all' ? 'default' : 'ghost'} size="sm"
                className={`h-8 px-3 text-xs gap-1 flex-shrink-0 ${activeStation === 'all' ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                onClick={() => setActiveStation('all')}>
                <Monitor className="size-3.5" />
                <span className="hidden sm:inline">{getStationName(t.kitchen.allStations, locale)}</span>
                <Badge variant="secondary" className={`text-[10px] px-1 py-0 h-4 min-w-[16px] ${activeStation === 'all' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {totalActiveItems}
                </Badge>
                {totalPriorityAlerts > 0 && (
                  <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4 min-w-[16px] animate-pulse">{totalPriorityAlerts}</Badge>
                )}
              </Button>

              {stations.filter(s => s.isActive).map((station) => {
                const itemCount = stationItemCounts[station.slug] || 0;
                const priorityCount = stationPriorityCounts[station.slug] || 0;
                return (
                  <Button key={station.id} variant={activeStation === station.slug ? 'default' : 'ghost'} size="sm"
                    className={`h-8 px-3 text-xs gap-1 flex-shrink-0 ${activeStation === station.slug ? 'text-white hover:opacity-90' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    style={activeStation === station.slug ? { backgroundColor: station.color } : undefined}
                    onClick={() => setActiveStation(station.slug)}>
                    {getStationIcon(station.icon, 'size-3.5')}
                    <span className="hidden sm:inline">{getStationName(station.name, locale)}</span>
                    {itemCount > 0 && (
                      <Badge variant="secondary" className={`text-[10px] px-1 py-0 h-4 min-w-[16px] ${activeStation === station.slug ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {itemCount}
                      </Badge>
                    )}
                    {priorityCount > 0 && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1 py-0 h-4 min-w-[16px] animate-pulse">{priorityCount}</Badge>
                    )}
                  </Button>
                );
              })}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={fetchData}>
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={() => setSortMode(sortMode === 'time' ? 'priority' : 'time')}>
                <ArrowUpDown className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={() => setSoundEnabled(!soundEnabled)}>
                {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </Button>

              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground sm:hidden" onClick={() => setShowMobileControls(!showMobileControls)}>
                <Settings2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile expandable controls */}
        {showMobileControls && (
          <div className="sm:hidden px-3 py-2 border-t border-border bg-muted/30">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={sortMode === 'priority' ? 'default' : 'ghost'} size="sm"
                className={`h-8 px-3 text-xs gap-1 ${sortMode === 'priority' ? 'bg-red-600 hover:bg-red-500 text-white' : 'text-muted-foreground'}`}
                onClick={() => setSortMode(sortMode === 'time' ? 'priority' : 'time')}>
                <ArrowUpDown className="size-3" />{sortMode === 'priority' ? t.staff.priority : t.staff.sortTime}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground" onClick={() => setSoundEnabled(!soundEnabled)}>
                {soundEnabled ? <Volume2 className="size-4 me-1" /> : <VolumeX className="size-4 me-1" />}
                {soundEnabled ? t.staff.soundOn : t.staff.soundOff}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="size-4 me-1" /> : <Maximize className="size-4 me-1" />}
                {t.staff.fullscreen}
              </Button>

            </div>
          </div>
        )}

        {/* Stats bar with all-day summary */}
        <KitchenStatsBar
          stats={stats}
          lastUpdated={lastUpdated}
          stationColor={stationColor}
          allDaySummary={allDaySummary}
        />
      </div>

      {/* ========== ORDER CARDS GRID ========== */}
      <KitchenOrderQueue
        sortedOrders={sortedOrders}
        activeStation={activeStation}
        stationColor={stationColor}
        onBump={handleBump}
        onFire={handleFire}
        onBumpAll={handleBumpAll}
        completedOrders={completedOrders}
      />

      {/* ========== QUICK ACTIONS ========== */}
      <div className="px-2 sm:px-4">
        <KitchenQuickActions />
      </div>

      {/* ========== KDS SCREENS ========== */}
      <div className="px-2 sm:px-4">
        <KitchenKdsScreens
          kdsScreens={kdsScreens}
          stats={stats}
          isRTL={isRTL}
        />
      </div>
    </div>
  );
}
