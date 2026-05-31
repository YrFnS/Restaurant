'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Flame, ChefHat, RefreshCw, Volume2, VolumeX, Maximize, Minimize,
  Zap, Activity, Monitor, ChevronDown,
  ArrowUpDown, Settings2, Clock, Check, BarChart3,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OrderTicketCard } from './display/KitchenTicket';

// ============ TYPES ============
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

interface StationData {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

interface ScreenConfig {
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

interface KitchenDisplayProps {
  screenSlug?: string;
}

type SortMode = 'time' | 'priority';

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

// ============ MAIN KITCHEN DISPLAY ============
export default function KitchenDisplay({ screenSlug }: KitchenDisplayProps) {
  const { t, locale, isRTL } = useI18n();
  const router = useRouter();
  const [stations, setStations] = useState<StationData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [activeStation, setActiveStation] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [showMobileControls, setShowMobileControls] = useState(false);
  const prevOrderCountRef = useRef(0);

  // Screen config state
  const [screenConfig, setScreenConfig] = useState<ScreenConfig | null>(null);
  const [allScreens, setAllScreens] = useState<ScreenConfig[]>([]);
  const [screenDropdownOpen, setScreenDropdownOpen] = useState(false);
  const screenDropdownRef = useRef<HTMLDivElement>(null);

  // Derived screen settings
  const autoRefreshInterval = screenConfig?.autoRefreshInterval ?? 10;
  const showCompleted = screenConfig?.showCompleted ?? false;
  const maxOrders = screenConfig?.maxOrders ?? 0;
  const headerTitle = screenConfig?.name ?? t.kitchen.title;

  // Fetch screen config when screenSlug is provided
  useEffect(() => {
    let cancelled = false;
    const fetchScreenConfig = async () => {
      if (!screenSlug) {
        if (!cancelled) {
          setScreenConfig(null);
          setActiveStation('all');
        }
        return;
      }
      try {
        const res = await fetch(`/api/kitchen-screens/${screenSlug}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const screen = data.screen as ScreenConfig;
          setScreenConfig(screen);
          if (screen.stationFilter) {
            setActiveStation(screen.stationFilter.toLowerCase());
          } else {
            setActiveStation('all');
          }
        } else if (!cancelled) {
          setScreenConfig(null);
        }
      } catch (e) {
        console.error('Failed to fetch screen config:', e);
        if (!cancelled) setScreenConfig(null);
      }
    };
    requestAnimationFrame(() => { fetchScreenConfig(); });
    return () => { cancelled = true; };
  }, [screenSlug]);

  // Fetch all screens
  useEffect(() => {
    const fetchAllScreens = async () => {
      try {
        const res = await fetch('/api/kitchen-screens');
        if (res.ok) {
          const data = await res.json();
          setAllScreens(data.screens || []);
        }
      } catch (e) {
        console.error('Failed to fetch screens:', e);
      }
    };
    fetchAllScreens();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (screenDropdownRef.current && !screenDropdownRef.current.contains(e.target as Node)) {
        setScreenDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch stations
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/api/stations');
        if (res.ok) {
          const data = await res.json();
          setStations(data.stations || []);
        }
      } catch (e) {
        console.error('Failed to fetch stations:', e);
      }
    };
    fetchStations();
  }, []);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=active');
      if (res.ok) {
        const data = await res.json();
        const mapped: OrderData[] = (data.orders || data || []).map((o: Record<string, unknown>) => ({
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
        setOrders(mapped);

        if (soundEnabled && mapped.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
          playDingSound();
        }
        prevOrderCountRef.current = mapped.length;
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
    setLastUpdated(new Date());
    setLoading(false);
  }, [soundEnabled, t]);

  useEffect(() => {
    let mounted = true;
    const load = async () => { if (mounted) await fetchOrders(); };
    load();
    const interval = setInterval(() => { if (mounted) fetchOrders(); }, autoRefreshInterval * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchOrders, autoRefreshInterval]);

  // Handlers
  const handleBump = async (itemId: string) => {
    try {
      await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) });
      fetchOrders();
    } catch (e) { console.error('Failed to bump item:', e); }
  };

  const handleFire = async (itemId: string) => {
    try {
      await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hold: false, status: 'fired' }) });
      fetchOrders();
    } catch (e) { console.error('Failed to fire item:', e); }
  };

  const handleBumpAll = async (order: OrderData) => {
    try {
      await Promise.all(
        order.items
          .filter((item) => !['ready', 'served', 'cancelled'].includes(item.status))
          .map((item) => fetch(`/api/orders/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) }))
      );
      fetchOrders();
    } catch (e) { console.error('Failed to bump all:', e); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const navigateToScreen = (slug: string) => {
    setScreenDropdownOpen(false);
    router.push(`/kitchen/${slug}`);
  };

  // Station color
  const stationColor = activeStation === 'all'
    ? '#f59e0b'
    : stations.find(s => s.slug === activeStation)?.color || '#f59e0b';

  // Station item counts
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

  // Stats
  const stats = useMemo(() => {
    const totalItems = orders.reduce((sum, o) => sum + o.items.filter((i) => i.status !== 'cancelled').length, 0);
    const completedItems = orders.reduce((sum, o) => sum + o.items.filter((i) => ['ready', 'served'].includes(i.status)).length, 0);
    const avgWait = orders.length > 0 ? orders.reduce((sum, o) => sum + getElapsedSeconds(o.createdAt), 0) / orders.length : 0;
    const priorityAlerts = orders.filter((o) => getElapsedSeconds(o.createdAt) > 15 * 60).length;
    return { totalActive: orders.length, avgWait, completedItems, totalItems, priorityAlerts };
  }, [orders]);

  // ALL DAY summary
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

  // Displayed orders
  const displayedOrders = useMemo(() => {
    let filtered = orders;
    if (activeStation !== 'all') {
      filtered = filtered.filter(o => o.items.some(item => item.station?.toLowerCase() === activeStation.toLowerCase()));
    }
    if (maxOrders > 0) filtered = filtered.slice(0, maxOrders);
    if (sortMode === 'priority') {
      filtered = [...filtered].sort((a, b) => getElapsedSeconds(b.createdAt) - getElapsedSeconds(a.createdAt));
    }
    return filtered;
  }, [orders, activeStation, maxOrders, sortMode]);

  // Total active items for "All" tab badge
  const totalActiveItems = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.items.filter(i => !['ready', 'served', 'cancelled'].includes(i.status)).length, 0);
  }, [orders]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-amber-50/10 to-amber-50/20 dark:via-amber-950/5 dark:to-amber-950/10 text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ========== HEADER ========== */}
      <div className="sticky top-12 z-40 bg-card/95 backdrop-blur-md border-b border-amber-500/20 shadow-sm">
        {/* Row 1: Title + Nav + Station tabs + Controls */}
        <div className="px-3 sm:px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Title + Screen selector */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/25">
                <Flame className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-foreground leading-tight">{headerTitle}</h1>
              </div>

              {/* Screen selector dropdown */}
              {allScreens.length > 0 && (
                <div className="relative hidden sm:block" ref={screenDropdownRef}>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2 gap-1" onClick={() => setScreenDropdownOpen(!screenDropdownOpen)}>
                    <Monitor className="size-4" />
                    <ChevronDown className={`size-3 transition-transform ${screenDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  <AnimatePresence>
                    {screenDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-full mt-1 ${isRTL ? 'end-0' : 'start-0'} w-64 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden`}
                      >
                        <button
                          className={`w-full px-3 py-2.5 text-start text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors ${!screenConfig ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
                          onClick={() => navigateToScreen('all-stations')}
                        >
                          <Zap className="size-4" />
                          <span className="font-medium">{t.kitchen.allStationsScreen}</span>
                        </button>
                        <div className="h-px bg-border" />
                        <div className="max-h-64 overflow-y-auto">
                          {allScreens.map((screen) => (
                            <button key={screen.id}
                              className={`w-full px-3 py-2.5 text-start text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors ${screenConfig?.id === screen.id ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-foreground'}`}
                              onClick={() => navigateToScreen(screen.slug)}
                            >
                              <Monitor className="size-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{screen.name}</div>
                                {screen.stationFilter && <div className="text-xs text-muted-foreground">{screen.stationFilter}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 hidden sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse me-1" />
                <Activity className="size-3 me-1" />{stats.totalActive} {t.kitchen.activeOrders}
              </Badge>
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
              </Button>

              {stations.filter(s => s.isActive).map((station) => {
                const itemCount = stationItemCounts[station.slug] || 0;
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
                  </Button>
                );
              })}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={fetchOrders}>
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

        {/* ALL DAY Summary Bar */}
        {allDaySummary.length > 0 && (
          <div className="px-3 sm:px-4 py-1.5 bg-muted/30 border-t border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold whitespace-nowrap flex items-center gap-1">
                <BarChart3 className="size-3" /> {t.staff.allDay}:
              </span>
              {allDaySummary.map(([name, count]) => (
                <Badge key={name} className="text-[11px] font-bold whitespace-nowrap px-2 py-0 border-0"
                  style={{ backgroundColor: `${stationColor}15`, color: stationColor }}>
                  {name} ×{count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Stats Bar - Amber gradient */}
        <div className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500/90 to-orange-500/90 dark:from-amber-600/90 dark:to-orange-600/90">
          <div className="flex items-center gap-2 text-[11px] text-white/90 flex-wrap">
            <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-md backdrop-blur-sm"><Clock className="size-3" />{t.staff.avg} <strong className="text-white">{formatElapsed(stats.avgWait)}</strong></span>
            <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-md backdrop-blur-sm"><Check className="size-3" />{t.staff.done} <strong className="text-white">{stats.completedItems}/{stats.totalItems}</strong></span>
            {stats.priorityAlerts > 0 && (
              <span className="flex items-center gap-1.5 bg-red-500/30 px-2.5 py-0.5 rounded-md backdrop-blur-sm text-white font-bold animate-pulse border border-red-400/30"><Zap className="size-3" />{stats.priorityAlerts} {t.staff.alert}</span>
            )}
            <span className="ms-auto text-[10px] text-white/60">{t.kitchen.lastUpdated} {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ========== ORDER GRID ========== */}
      <div className="p-2 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin me-2" /> {t.common.loading}
          </div>
        ) : displayedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground"
          >
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="mb-6"
            >
              <div className="size-28 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200/60 dark:border-amber-700/40 flex items-center justify-center shadow-xl shadow-amber-500/15">
                <ChefHat className="size-14 text-amber-500/60" />
              </div>
            </motion.div>
            <p className="text-xl font-bold text-foreground mb-2">{t.kitchen.noOrders}</p>
            <p className="text-sm text-muted-foreground max-w-xs text-center">{t.kitchen.noOrdersDesc}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence mode="popLayout">
              {displayedOrders.map((order, index) => (
                <OrderTicketCard
                  key={order.id}
                  order={order}
                  stationFilter={activeStation}
                  stationColor={stationColor}
                  onBump={handleBump}
                  onFire={handleFire}
                  onBumpAll={handleBumpAll}
                  orderIndex={index}
                  showCompleted={showCompleted}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
