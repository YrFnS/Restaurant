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
  Plus, ArrowRight, Copy,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { ThemeToggle } from '@/components/staff/ThemeToggle';
import { LanguageToggle } from '@/components/staff/LanguageToggle';

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
    case 'fresh': return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: '#10b981', light: 'bg-emerald-500/10', border: 'border-emerald-500' };
    case 'normal': return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: '#f59e0b', light: 'bg-amber-500/10', border: 'border-amber-500' };
    case 'warning': return { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', ring: '#f97316', light: 'bg-orange-500/10', border: 'border-orange-500' };
    case 'urgent': return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: '#ef4444', light: 'bg-red-500/10', border: 'border-red-500' };
    case 'critical': return { bg: 'bg-red-600', text: 'text-red-700 dark:text-red-400', ring: '#dc2626', light: 'bg-red-600/10', border: 'border-red-600' };
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
        <div
          className={`h-full rounded-full transition-all duration-1000 ${colors.bg}`}
          style={{ width: `${progress * 100}%` }}
        />
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
        {/* Quantity badge */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ backgroundColor: `${stationColor}20`, color: stationColor }}>
          {item.quantity}×
        </div>
        {/* Item name + badges */}
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
          {/* Modifiers */}
          {modifiers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {modifiers.map((mod: string | { name?: string }, i: number) => (
                <span key={i} className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                  {typeof mod === 'string' ? mod : mod.name || ''}
                </span>
              ))}
            </div>
          )}
          {/* Notes */}
          {item.notes && (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-1 break-words">{item.notes}</p>
          )}
        </div>
        {/* Action button */}
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
    return order.items.filter((item) =>
      item.station?.toLowerCase() === stationSlug.toLowerCase()
    );
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
      <Card className={`bg-gradient-to-br from-card to-amber-50/40 dark:to-amber-950/15 border-border rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/5 hover:scale-[1.01] ${isPriority ? 'ring-1' : ''}`}
        style={isPriority ? { "--tw-ring-color": `${colors.ring}40`, borderColor: `${colors.ring}30` } as React.CSSProperties : {}}>

        {/* Urgency color strip at top */}
        <div className={`h-1.5 ${colors.bg} ${level === 'critical' ? 'animate-pulse' : ''}`} />

        <CardHeader className="pb-2 pt-3 px-4 gap-0">
          <div className="flex items-center justify-between gap-2">
            {/* Order number + type */}
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-foreground tracking-tight">#{order.orderNumber}</span>
              {order.tableNumber ? (
                <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-xs font-bold px-2 py-0.5">
                  {t.staff.table} {order.tableNumber}
                </Badge>
              ) : (
                <Badge className={`text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1.5 rounded-md ${orderTypeInfo.bg} ${orderTypeInfo.color} ring-1 ${order.type === 'takeout' ? 'ring-orange-500/20' : order.type === 'delivery' ? 'ring-purple-500/20' : order.type === 'drive_thru' ? 'ring-cyan-500/20' : 'ring-teal-500/20'}`}>
                  {orderTypeInfo.icon} <span className="ms-0.5">{orderTypeInfo.label}</span>
                </Badge>
              )}
            </div>
            {/* Priority + Timer */}
            <div className="flex items-center gap-2">
              {isPriority && (
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-bold px-2 animate-pulse">
                  <Zap className="size-3 me-0.5" />{t.staff.priority}
                </Badge>
              )}
              <ElapsedTimer createdAt={order.createdAt} compact />
            </div>
          </div>
          {/* Order notes */}
          {order.notes && (
            <div className="mt-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400 italic flex items-start gap-1.5 break-words">
                <AlertCircle className="size-3 flex-shrink-0 mt-0.5" />{order.notes}
              </p>
            </div>
          )}
        </CardHeader>
        <Separator className="bg-border" />
        {/* All Ready indicator */}
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

// ============ COMPLETED ORDER CARD ============
function CompletedOrderCard({ order }: { order: OrderData }) {
  const { t } = useI18n();
  const orderTypeInfo = getOrderTypeIcon(order.type, { takeout: t.staff.takeout, delivery: t.staff.delivery, driveThru: t.staff.driveThru, dineIn: t.staff.dineIn });
  return (
    <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-500/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between hover:shadow-lg hover:shadow-emerald-500/5 transition-all hover:border-emerald-500/30">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">#{order.orderNumber}</span>
        {order.tableNumber && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">T{order.tableNumber}</Badge>}
        <span className={`text-[10px] font-medium ${orderTypeInfo.color}`}>{orderTypeInfo.label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{order.items.length} {t.staff.items}</span>
    </div>
  );
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

        {/* ALL DAY Summary Bar */}
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

        {/* Stats Bar - Amber gradient with live active count */}
        <div className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500/90 to-orange-500/90 dark:from-amber-600/90 dark:to-orange-600/90">
          <div className="flex items-center gap-2 text-[11px] text-white/90 flex-wrap">
            <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-md backdrop-blur-sm"><Activity className="size-3" /><strong className="text-white">{stats.totalActive}</strong> {t.kitchen.activeOrders}</span>
            {allDaySummary.length > 0 && allDaySummary.slice(0, 4).map(([name, count]) => (
              <Badge key={name} className="text-[10px] font-bold whitespace-nowrap px-2 py-0 border-0 bg-white/15 text-white backdrop-blur-sm">
                {name} ×{count}
              </Badge>
            ))}
            <span className="ms-auto text-[10px] text-white/60">{t.kitchen.lastUpdated} {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ========== ORDER CARDS GRID ========== */}
      <div className="p-2 sm:p-4">
        <AnimatePresence mode="popLayout">
          {sortedOrders.length === 0 ? (
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
              <p className="text-sm text-muted-foreground max-w-xs text-center mb-6">{t.kitchen.noOrdersDesc}</p>
              <div className="flex items-center gap-3">
                <Link href="/pos">
                  <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-md shadow-amber-500/25">
                    <Plus className="size-4 me-1.5" />{t.kitchen.createOrder}
                  </Button>
                </Link>
                <Link href="/kitchen/all-stations">
                  <Button variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold">
                    <Monitor className="size-4 me-1.5" />{t.kitchen.kdsScreens}
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedOrders.map((order, idx) => (
                <OrderTicketCard key={order.id} order={order} stationSlug={activeStation} stationColor={stationColor} onBump={handleBump} onFire={handleFire} onBumpAll={handleBumpAll} orderIndex={idx} />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* ========== QUICK ACTIONS ========== */}
        <div className="mt-6 sm:mt-8 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
              <Zap className="size-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground tracking-tight">{t.kitchen.quickActions}</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/pos">
              <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Plus className="size-5 text-amber-600 dark:text-amber-400" /></div>
                  <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.createOrder}</span>
                </div>
              </motion.div>
            </Link>
            <Link href="/admin">
              <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Settings2 className="size-5 text-amber-600 dark:text-amber-400" /></div>
                  <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.manageMenu}</span>
                </div>
              </motion.div>
            </Link>
            <Link href="/kitchen/all-stations">
              <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
                <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
                  <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Monitor className="size-5 text-amber-600 dark:text-amber-400" /></div>
                  <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.kdsScreens}</span>
                </div>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* ========== KDS SCREENS ========== */}
        <div className="mt-2 sm:mt-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
              <Monitor className="size-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-foreground tracking-tight">{t.kitchen.kdsScreens}</h2>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">{kdsScreens.length}</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* All Stations card */}
            <Link href="/kitchen/all-stations">
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all cursor-pointer rounded-xl shadow-sm h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                          <Zap className="size-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="font-bold text-foreground text-sm">{t.kitchen.allStationsScreen}</span>
                      </div>
                      <ArrowRight className={`size-4 text-amber-600 dark:text-amber-400 ${isRTL ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t.kitchen.allStations}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-[10px]">{stats.totalActive} {t.kitchen.activeOrders}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            {/* KDS screen cards */}
            {kdsScreens.map((screen, index) => (
              <motion.div
                key={screen.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link href={`/kitchen/${screen.slug}`}>
                  <Card className={`bg-card border-border hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer rounded-xl shadow-sm group h-full ${!screen.isActive ? 'opacity-50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 bg-muted/60 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                            <Monitor className="size-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-sm truncate">{screen.name}</h3>
                            {screen.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{screen.description}</p>}
                          </div>
                        </div>
                        <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${screen.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {screen.isActive ? t.kitchen.screenActive : t.kitchen.screenInactive}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{screen.stationFilter || t.kitchen.allStations}</span>
                        <span>·</span>
                        <span>{screen.autoRefreshInterval}{t.kitchen.screenSeconds}</span>
                        {screen.maxOrders > 0 && (
                          <>
                            <span>·</span>
                            <span>{t.kitchen.maxOrders}: {screen.maxOrders}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-mono">/kitchen/{screen.slug}</span>
                        <ArrowRight className={`size-3 text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity ${isRTL ? 'rotate-180' : ''}`} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}

            {/* Create New Screen card */}
            <Link href="/admin" className="block">
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Card className="bg-card border-dashed border-2 border-muted hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer rounded-xl shadow-sm h-full">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
                    <div className="w-11 h-11 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl flex items-center justify-center mb-2">
                      <Plus className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="font-bold text-foreground text-sm">{t.kitchen.createScreenAdmin}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{t.kitchen.createScreenAdminDesc}</span>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Recently completed */}
        {completedOrders.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="size-4 text-white" />
              </div>
              <h2 className="text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{t.staff.recentlyCompleted}</h2>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">{completedOrders.length}</Badge>
              <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {completedOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <CompletedOrderCard order={order} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
