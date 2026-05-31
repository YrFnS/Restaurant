'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Flame, Clock, ChefHat, Check, AlertCircle,
  RefreshCw, Volume2, VolumeX, Maximize, Minimize,
  Zap, CheckCircle2, BarChart3, Activity, UtensilsCrossed,
  Bike, Car, Snowflake, ArrowUpDown,
  Users, Wine, Eye, Monitor, Settings2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/staff/ThemeToggle';
import { LanguageToggle } from '@/components/staff/LanguageToggle';
import { useI18n } from '@/lib/i18n';

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

// ============ HELPERS ============
function getElapsedSeconds(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(createdAt: string, t?: { justNow: string; ago: string }): string {
  const seconds = getElapsedSeconds(createdAt);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return t?.justNow || 'Just now';
  if (minutes < 60) return `${minutes}m ${t?.ago || 'ago'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function getStationIcon(iconName: string, size: string = 'size-4'): React.ReactNode {
  const cls = size;
  const iconMap: Record<string, React.ReactNode> = {
    Flame: <Flame className={cls} />,
    ChefHat: <ChefHat className={cls} />,
    Snowflake: <Snowflake className={cls} />,
    Wine: <Wine className={cls} />,
    Eye: <Eye className={cls} />,
    Activity: <Activity className={cls} />,
    UtensilsCrossed: <UtensilsCrossed className={cls} />,
  };
  return iconMap[iconName] || <ChefHat className={cls} />;
}

function getUrgencyLevel(seconds: number): 'fresh' | 'normal' | 'warning' | 'urgent' | 'critical' {
  const minutes = seconds / 60;
  if (minutes < 5) return 'fresh';
  if (minutes < 10) return 'normal';
  if (minutes < 15) return 'warning';
  if (minutes < 20) return 'urgent';
  return 'critical';
}

function getUrgencyColors(level: ReturnType<typeof getUrgencyLevel>) {
  switch (level) {
    case 'fresh': return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: '#10b981', light: 'bg-emerald-500/10' };
    case 'normal': return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: '#f59e0b', light: 'bg-amber-500/10' };
    case 'warning': return { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', ring: '#f97316', light: 'bg-orange-500/10' };
    case 'urgent': return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: '#ef4444', light: 'bg-red-500/10' };
    case 'critical': return { bg: 'bg-red-600', text: 'text-red-700 dark:text-red-400', ring: '#dc2626', light: 'bg-red-600/10' };
  }
}

function getOrderTypeIcon(type: string, labels?: { takeout: string; delivery: string; driveThru: string; dineIn: string }): { icon: React.ReactNode; label: string; color: string; bg: string } {
  const l = labels || { takeout: 'Takeout', delivery: 'Delivery', driveThru: 'Drive-Thru', dineIn: 'Dine-In' };
  switch (type) {
    case 'takeout': return { icon: <UtensilsCrossed className="size-3.5" />, label: l.takeout, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' };
    case 'delivery': return { icon: <Bike className="size-3.5" />, label: l.delivery, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' };
    case 'drive_thru': return { icon: <Car className="size-3.5" />, label: l.driveThru, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10' };
    default: return { icon: <Users className="size-3.5" />, label: l.dineIn, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' };
  }
}

function getStatusInfo(status: string, t?: { pending: string; fired: string; preparing: string; ready: string; served: string; cancelled: string }): { label: string; color: string; bg: string } {
  const labels = t ? { pending: t.pending, fired: t.fired, preparing: t.preparing, ready: t.ready, served: t.served, cancelled: t.cancelled } : { pending: 'Pending', fired: 'Fired', preparing: 'Prepping', ready: 'Ready', served: 'Served', cancelled: 'Cancelled' };
  switch (status) {
    case 'pending': return { label: labels.pending, color: 'text-muted-foreground', bg: 'bg-muted' };
    case 'fired': return { label: labels.fired, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/15' };
    case 'preparing': return { label: labels.preparing, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15' };
    case 'ready': return { label: labels.ready, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15' };
    case 'served': return { label: labels.served, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-600/15' };
    case 'cancelled': return { label: labels.cancelled, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15' };
    default: return { label: status, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
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

// ============ ELAPSED TIMER ============
function ElapsedTimer({ createdAt, compact = false }: { createdAt: string; compact?: boolean }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(getElapsedSeconds(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setSeconds(getElapsedSeconds(createdAt)), 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const level = getUrgencyLevel(seconds);
  const colors = getUrgencyColors(level);
  const maxSeconds = 30 * 60;
  const progress = Math.min(seconds / maxSeconds, 1);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${colors.bg} ${level === 'critical' || level === 'urgent' ? 'animate-pulse' : ''}`} />
        <span className={`font-mono text-sm font-bold tabular-nums ${colors.text}`}>
          {formatElapsed(seconds)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${colors.bg} ${level === 'critical' || level === 'urgent' ? 'animate-pulse' : ''}`} />
        <span className={`font-mono text-base font-black tabular-nums ${colors.text}`}>
          {formatElapsed(seconds)}
        </span>
      </div>
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
        <div className={`h-full rounded-full transition-all duration-1000 ${colors.bg}`} style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(createdAt, { justNow: t.staff.justNow, ago: t.kitchen.ago })}</span>
    </div>
  );
}

// ============ ORDER ITEM CARD ============
function OrderItemCard({ item, stationColor, onBump, onFire }: {
  item: OrderItemData; stationColor: string; onBump: (id: string) => void; onFire: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const statusInfo = getStatusInfo(item.status, { pending: t.staff.pending, fired: t.staff.fired, preparing: t.staff.preparing, ready: t.staff.ready, served: t.staff.served, cancelled: t.staff.cancelled });
  const isHeld = item.hold;
  const isReady = item.status === 'ready' || item.status === 'served';
  const isCancelled = item.status === 'cancelled';

  let modifiers: string[] = [];
  try { if (item.modifiers) modifiers = JSON.parse(item.modifiers); } catch { if (item.modifiers) modifiers = [item.modifiers]; }

  return (
    <div className={`py-2 px-3 rounded-lg border transition-all ${
      isHeld ? 'border-amber-500/40 bg-amber-500/5 border-dashed' :
      isReady ? 'border-emerald-500/30 bg-emerald-500/5' :
      isCancelled ? 'border-red-500/20 bg-red-500/5 opacity-50' :
      'border-border bg-muted/30'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ backgroundColor: `${stationColor}20`, color: stationColor }}>
          {item.quantity}×
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold ${isReady ? 'text-emerald-600 dark:text-emerald-400 line-through' : 'text-foreground'}`}>
              {locale === 'ar' && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName}
            </span>
            {item.seatNumber && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                {t.staff.seat} {item.seatNumber}
              </span>
            )}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {isHeld && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse flex items-center gap-0.5">
                <Snowflake className="size-2.5" />{t.staff.hold}
              </span>
            )}
          </div>
          {modifiers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {modifiers.map((mod: string | { name?: string }, i: number) => (
                <span key={i} className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                  {typeof mod === 'string' ? mod : mod.name || ''}
                </span>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-1 break-words">{item.notes}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {isHeld && !isReady && !isCancelled && (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-8 min-w-[64px] px-2" onClick={() => onFire(item.id)}>
              <Flame className="size-3 me-1" />{t.staff.fire}
            </Button>
          )}
          {!isReady && !isCancelled && !isHeld && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 min-w-[64px] px-2" onClick={() => onBump(item.id)}>
              <Check className="size-3 me-1" />{t.staff.bump}
            </Button>
          )}
          {isReady && (
            <div className="flex items-center justify-center h-8 w-8 bg-emerald-500/15 rounded-lg">
              <Check className="size-4 text-emerald-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ ORDER TICKET CARD ============
function OrderTicketCard({ order, stationSlug, stationColor, onBump, onFire, onBumpAll, orderIndex }: {
  order: OrderData; stationSlug: string; stationColor: string;
  onBump: (id: string) => void; onFire: (id: string) => void;
  onBumpAll: (order: OrderData) => void; orderIndex: number;
}) {
  const { t } = useI18n();
  const filteredItems = useMemo(() => {
    if (stationSlug === 'all') return order.items;
    return order.items.filter((item) => item.station?.toLowerCase() === stationSlug.toLowerCase());
  }, [order.items, stationSlug]);

  const heldItems = filteredItems.filter((item) => item.hold);
  const activeItems = filteredItems.filter((item) => !item.hold);
  const hasBumpableItems = filteredItems.some((item) => !['ready', 'served', 'cancelled'].includes(item.status));
  const allReady = filteredItems.filter((item) => item.status !== 'cancelled').every((item) => ['ready', 'served'].includes(item.status));

  const elapsedSeconds = getElapsedSeconds(order.createdAt);
  const level = getUrgencyLevel(elapsedSeconds);
  const colors = getUrgencyColors(level);
  const orderTypeInfo = getOrderTypeIcon(order.type, { takeout: t.staff.takeout, delivery: t.staff.delivery, driveThru: t.staff.driveThru, dineIn: t.staff.dineIn });
  const isPriority = level === 'urgent' || level === 'critical';

  if (filteredItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: orderIndex * 0.04 }}
      layout
    >
      <Card className={`bg-card border-border overflow-hidden transition-all hover:shadow-xl ${isPriority ? 'ring-1' : ''}`}
        style={isPriority ? { "--tw-ring-color": `${colors.ring}40`, borderColor: `${colors.ring}30` } as React.CSSProperties : {}}>

        <div className={`h-1.5 ${colors.bg} ${level === 'critical' ? 'animate-pulse' : ''}`} />

        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-foreground tracking-tight">#{order.orderNumber}</span>
              {order.tableNumber ? (
                <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-xs font-bold px-2 py-0.5">
                  {t.staff.table} {order.tableNumber}
                </Badge>
              ) : (
                <Badge className={`text-xs font-bold px-2 py-0.5 border-0 flex items-center gap-1 ${orderTypeInfo.bg} ${orderTypeInfo.color}`}>
                  {orderTypeInfo.icon} <span className="ms-0.5">{orderTypeInfo.label}</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPriority && (
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-bold px-2 animate-pulse">
                  <Zap className="size-3 me-0.5" />{t.staff.priority}
                </Badge>
              )}
              <ElapsedTimer createdAt={order.createdAt} compact />
            </div>
          </div>
          {order.notes && (
            <div className="mt-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400 italic flex items-start gap-1.5 break-words">
                <AlertCircle className="size-3 flex-shrink-0 mt-0.5" />{order.notes}
              </p>
            </div>
          )}
        </CardHeader>
        <Separator className="bg-border" />
        {allReady && (
          <div className="mx-3 mt-2 mb-1 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-1.5">
              <CheckCircle2 className="size-4" />{t.staff.allReady}
            </span>
          </div>
        )}
        <CardContent className="pt-2 pb-3 px-3 space-y-1.5">
          {activeItems.map((item) => (
            <OrderItemCard key={item.id} item={item} stationColor={stationColor} onBump={onBump} onFire={onFire} />
          ))}
          {heldItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-amber-500/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Snowflake className="size-3 text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t.staff.onHold} ({heldItems.length})</span>
              </div>
              {heldItems.map((item) => (
                <OrderItemCard key={item.id} item={item} stationColor={stationColor} onBump={onBump} onFire={onFire} />
              ))}
            </div>
          )}
          {hasBumpableItems && !allReady && (
            <div className="pt-2">
              <Button size="sm" className={`w-full font-bold text-sm h-10 tracking-wide ${isPriority ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}
                onClick={() => onBumpAll(order)}>
                <Check className="size-4 me-1.5" />{t.staff.bumpAll}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN STATION DISPLAY ============
export default function StationDisplay({ stationSlug }: { stationSlug: Promise<{ station: string }> }) {
  const { t, locale, isRTL } = useI18n();
  const [slug, setSlug] = useState<string>('');
  const [station, setStation] = useState<StationData | null>(null);
  const [stations, setStations] = useState<StationData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderData[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('time');
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
        const res = await fetch('/api/stations');
        if (res.ok) {
          const data = await res.json();
          const allStations = data.stations || [];
          setStations(allStations);
          if (slug !== 'all') {
            const found = allStations.find((s: StationData) => s.slug.toLowerCase() === slug.toLowerCase());
            setStation(found || null);
          }
        }
      } catch (e) { console.error('Failed to fetch station:', e); }
    };
    fetchStation();
  }, [slug]);

  const fetchOrders = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch('/api/orders?status=active');
      if (res.ok) {
        const data = await res.json();
        const mapped: OrderData[] = (data.orders || data || []).map((o: Record<string, unknown>) => ({
          id: o.id, orderNumber: o.orderNumber, type: o.type, status: o.status,
          customerName: o.customerName || '', notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt,
          items: (o.items as OrderItemData[] || []).map((item: OrderItemData) => ({
            id: item.id, menuItemId: item.menuItemId,
            menuItemName: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameEn || t.kitchen.unknownItem,
            menuItemNameAr: (item as { menuItem?: { nameEn?: string; nameAr?: string } }).menuItem?.nameAr || '',
            quantity: item.quantity, unitPrice: item.unitPrice, modifiers: item.modifiers,
            notes: item.notes, totalPrice: item.totalPrice, status: item.status || 'pending',
            station: item.station || 'prep', hold: item.hold || false, seatNumber: item.seatNumber,
          })),
        }));
        const stationOrders = slug === 'all' ? mapped : mapped.filter((order) => order.items.some((item) => item.station?.toLowerCase() === slug.toLowerCase()));
        setOrders(stationOrders);
        if (soundEnabled && stationOrders.length > prevOrderCountRef.current && prevOrderCountRef.current > 0) playDingSound();
        prevOrderCountRef.current = stationOrders.length;
      }
      const compRes = await fetch('/api/orders?status=completed');
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompletedOrders((compData.orders || compData || []).slice(0, 5).map((o: Record<string, unknown>) => ({
          id: o.id, orderNumber: o.orderNumber, type: o.type, status: o.status,
          customerName: o.customerName || '', notes: o.notes || null,
          tableNumber: (o.table as { number: number } | null)?.number || null,
          createdAt: o.createdAt, items: (o.items as OrderItemData[] || []),
        })));
      }
    } catch (e) { console.error('Failed to fetch orders:', e); }
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
    try { await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) }); fetchOrders(); }
    catch (e) { console.error('Failed to bump item:', e); }
  };
  const handleFire = async (itemId: string) => {
    try { await fetch(`/api/orders/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hold: false, status: 'fired' }) }); fetchOrders(); }
    catch (e) { console.error('Failed to fire item:', e); }
  };
  const handleBumpAll = async (order: OrderData) => {
    try {
      const itemsToBump = slug === 'all' ? order.items : order.items.filter((item) => item.station?.toLowerCase() === slug.toLowerCase());
      await Promise.all(itemsToBump.filter((item) => !['ready', 'served', 'cancelled'].includes(item.status)).map((item) => fetch(`/api/orders/items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) })));
      fetchOrders();
    } catch (e) { console.error('Failed to bump all:', e); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const allDaySummary = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((order) => { order.items.forEach((item) => {
      if (['ready', 'served', 'cancelled'].includes(item.status)) return;
      if (slug === 'all' || item.station?.toLowerCase() === slug.toLowerCase()) {
        const name = locale === 'ar' && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName;
        counts[name] = (counts[name] || 0) + item.quantity;
      }
    }); });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders, slug, locale]);

  const stats = useMemo(() => {
    const allItems = orders.flatMap((o) => o.items);
    const stationItems = slug === 'all' ? allItems : allItems.filter((i) => i.station?.toLowerCase() === slug.toLowerCase());
    const completedItems = stationItems.filter((i) => ['ready', 'served'].includes(i.status));
    const avgWait = orders.length > 0 ? orders.reduce((sum, o) => sum + getElapsedSeconds(o.createdAt), 0) / orders.length : 0;
    const priorityCount = orders.filter((o) => getElapsedSeconds(o.createdAt) > 15 * 60).length;
    const activeItems = stationItems.filter((i) => !['ready', 'served', 'cancelled'].includes(i.status));
    return { totalActive: orders.length, avgWait, completedItems: completedItems.length, totalItems: stationItems.length, activeItems: activeItems.length, priorityCount };
  }, [orders, slug]);

  const sortedOrders = useMemo(() => {
    if (sortMode === 'priority') return [...orders].sort((a, b) => getElapsedSeconds(b.createdAt) - getElapsedSeconds(a.createdAt));
    return orders;
  }, [orders, sortMode]);

  const stationColor = station?.color || '#f59e0b';
  const stationName = slug === 'all' ? t.staff.allStations : (station?.name || slug);

  if (!slug) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-12 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/kitchen" className="flex-shrink-0 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                <ArrowLeft className="size-5" />
              </Link>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stationColor}15` }}>
                  <span style={{ color: stationColor }}>
                    {slug === 'all' ? <Monitor className="size-4" /> : (station ? getStationIcon(station.icon, 'size-4') : <ChefHat className="size-4" />)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">{stationName}</h1>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="outline" className="text-[11px] font-bold" style={{ borderColor: `${stationColor}40`, color: stationColor }}>
                  {stats.activeItems}
                </Badge>
                {stats.priorityCount > 0 && (
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] px-1.5 font-bold animate-pulse">
                    !{stats.priorityCount}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={fetchOrders}>
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground sm:hidden" onClick={() => setShowControls(!showControls)}>
                <Settings2 className="size-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-0.5">
                <Button variant={sortMode === 'priority' ? 'default' : 'ghost'} size="sm"
                  className={`h-8 px-2 text-xs gap-1 ${sortMode === 'priority' ? 'bg-red-600 hover:bg-red-500 text-white' : 'text-muted-foreground'}`}
                  onClick={() => setSortMode(sortMode === 'time' ? 'priority' : 'time')}>
                  <ArrowUpDown className="size-3" />{sortMode === 'priority' ? t.staff.sortPriority : t.staff.sortTime}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => setSoundEnabled(!soundEnabled)}>
                  {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {showControls && (
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

        {allDaySummary.length > 0 && (
          <div className="px-3 sm:px-4 py-1.5 bg-muted/30 border-t border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold whitespace-nowrap flex items-center gap-1">
                <BarChart3 className="size-3" /> {t.staff.allDay}:
              </span>
              {allDaySummary.map(([name, count]) => (
                <Badge key={name} className="text-[10px] font-bold whitespace-nowrap px-2 py-0 border-0"
                  style={{ backgroundColor: `${stationColor}15`, color: stationColor }}>
                  {name} ×{count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="px-3 sm:px-4 py-1.5 bg-muted/20 border-t border-border">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Clock className="size-3" />{t.staff.avg} <strong className="text-foreground">{formatElapsed(stats.avgWait)}</strong></span>
            <span className="flex items-center gap-1"><Check className="size-3 text-emerald-500" />{t.staff.done} <strong className="text-foreground">{stats.completedItems}/{stats.totalItems}</strong></span>
            {stats.priorityCount > 0 && (
              <span className="text-red-600 dark:text-red-400 font-bold animate-pulse flex items-center gap-1"><Zap className="size-3" />{stats.priorityCount} {t.staff.alert}</span>
            )}
            <span className="ms-auto text-[10px]">{lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

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
              <OrderTicketCard key={order.id} order={order} stationSlug={slug} stationColor={stationColor} onBump={handleBump} onFire={handleFire} onBumpAll={handleBumpAll} orderIndex={idx} />
            ))}
          </div>
        )}

        {completedOrders.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <h2 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t.staff.recentlyCompleted}</h2>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">{completedOrders.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {completedOrders.map((order) => (
                <div key={order.id} className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">#{order.orderNumber}</span>
                    {order.tableNumber && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">T{order.tableNumber}</Badge>}
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
