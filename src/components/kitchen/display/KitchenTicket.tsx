'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Flame, Zap, CheckCircle2, AlertCircle, Snowflake, Check,
  UtensilsCrossed, Bike, Car, Users,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { ElapsedTimer } from './KitchenTimer';
import { KitchenItemActions } from './KitchenActions';

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

// ============ HELPERS ============
function getElapsedSeconds(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
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

function getOrderTypeIcon(type: string, labels?: { takeout: string; delivery: string; driveThru: string; dineIn: string }): { icon: React.ReactNode; label: string; color: string } {
  const l = labels || { takeout: 'Takeout', delivery: 'Delivery', driveThru: 'Drive-Thru', dineIn: 'Dine-In' };
  switch (type) {
    case 'takeout': return { icon: <UtensilsCrossed className="size-3.5" />, label: l.takeout, color: 'text-orange-600 dark:text-orange-400' };
    case 'delivery': return { icon: <Bike className="size-3.5" />, label: l.delivery, color: 'text-purple-600 dark:text-purple-400' };
    case 'drive_thru': return { icon: <Car className="size-3.5" />, label: l.driveThru, color: 'text-cyan-600 dark:text-cyan-400' };
    default: return { icon: <Users className="size-3.5" />, label: l.dineIn, color: 'text-teal-600 dark:text-teal-400' };
  }
}

// ============ ORDER TICKET CARD ============
export function OrderTicketCard({ order, stationFilter, stationColor, onBump, onFire, onBumpAll, orderIndex, showCompleted }: {
  order: OrderData; stationFilter: string; stationColor: string;
  onBump: (id: string) => void; onFire: (id: string) => void;
  onBumpAll: (order: OrderData) => void; orderIndex: number;
  showCompleted: boolean;
}) {
  const { t } = useI18n();
  const filteredItems = useMemo(() => {
    if (stationFilter === 'all') return order.items;
    return order.items.filter((item) => item.station?.toLowerCase() === stationFilter.toLowerCase());
  }, [order.items, stationFilter]);

  const displayItems = useMemo(() => {
    if (showCompleted) return filteredItems;
    return filteredItems.filter((item) => !['ready', 'served', 'cancelled'].includes(item.status));
  }, [filteredItems, showCompleted]);

  const heldItems = displayItems.filter((item) => item.hold);
  const activeItems = displayItems.filter((item) => !item.hold);
  const hasBumpableItems = displayItems.some((item) => !['ready', 'served', 'cancelled'].includes(item.status));
  const allReady = displayItems.filter((item) => item.status !== 'cancelled').every((item) => ['ready', 'served'].includes(item.status));

  const elapsedSeconds = getElapsedSeconds(order.createdAt);
  const level = getUrgencyLevel(elapsedSeconds);
  const colors = getUrgencyColors(level);
  const orderTypeInfo = getOrderTypeIcon(order.type, { takeout: t.staff.takeout, delivery: t.staff.delivery, driveThru: t.staff.driveThru, dineIn: t.staff.dineIn });
  const isPriority = level === 'urgent' || level === 'critical';

  if (displayItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: orderIndex * 0.05 }}
      layout
    >
      <Card className={`bg-gradient-to-br from-card to-amber-50/40 dark:to-amber-950/15 border-border rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/5 hover:scale-[1.01] ${isPriority ? '' : ''}`}
        style={isPriority ? { boxShadow: `0 0 20px ${colors.ring}15`, borderColor: `${colors.ring}40` } : {}}>

        {/* Urgency color strip at top */}
        <div className={`h-2 ${colors.bg} ${level === 'critical' ? 'animate-pulse' : ''}`} />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-foreground tracking-tight">#{order.orderNumber}</span>
              {order.tableNumber ? (
                <Badge className="bg-teal-500/15 text-teal-600 dark:text-teal-400 border-0 text-xs font-bold px-2 py-0.5">
                  {t.staff.table} {order.tableNumber}
                </Badge>
              ) : (
                <Badge className={`text-xs font-bold px-2.5 py-1 border-0 flex items-center gap-1.5 rounded-md ${order.type === 'takeout' ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400 ring-1 ring-orange-500/20' : order.type === 'delivery' ? 'bg-purple-500/20 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500/20' : order.type === 'drive_thru' ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 ring-1 ring-cyan-500/20' : 'bg-teal-500/20 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/20'}`}>
                  {orderTypeInfo.icon} <span className="ms-1">{orderTypeInfo.label}</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPriority && (
                <Badge className="bg-red-500/15 text-red-500 border border-red-500/30 text-xs font-bold px-2 animate-pulse">
                  <Zap className="size-3 me-0.5" />{t.staff.priority}
                </Badge>
              )}
              <ElapsedTimer createdAt={order.createdAt} compact />
            </div>
          </div>
          {order.notes && (
            <div className="mt-2 px-3 py-1.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400 italic flex items-start gap-1.5 break-words">
                <AlertCircle className="size-3.5 flex-shrink-0 mt-0.5" />{order.notes}
              </p>
            </div>
          )}
        </CardHeader>
        <Separator className="bg-border" />
        {allReady && (
          <div className="mx-3 mt-2 mb-1 py-2 px-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-center">
            <span className="text-emerald-500 font-black text-sm tracking-wider flex items-center justify-center gap-1.5">
              <CheckCircle2 className="size-4" /> {t.staff.allReady}
            </span>
          </div>
        )}
        <CardContent className="pt-3 space-y-1.5">
          {activeItems.map((item) => (
            <KitchenItemActions key={item.id} item={item} stationColor={stationColor} onBump={onBump} onFire={onFire} />
          ))}
          {heldItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-amber-500/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Snowflake className="size-3.5 text-amber-500" />
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">{t.staff.onHold} ({heldItems.length})</span>
              </div>
              {heldItems.map((item) => (
                <KitchenItemActions key={item.id} item={item} stationColor={stationColor} onBump={onBump} onFire={onFire} />
              ))}
            </div>
          )}
          {hasBumpableItems && (
            <div className="pt-2">
              <Button size="sm" className={`w-full font-bold text-sm h-11 tracking-wide ${isPriority ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`} onClick={() => onBumpAll(order)}>
                <Check className="size-4 me-1.5" />{t.staff.bumpAll}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
