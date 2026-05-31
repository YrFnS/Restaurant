'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Flame, Check, Snowflake } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

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

export function KitchenItemActions({
  item,
  stationColor,
  onBump,
  onFire,
}: {
  item: OrderItemData;
  stationColor: string;
  onBump: (id: string) => void;
  onFire: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const statusInfo = getStatusInfo(item.status, { pending: t.staff.pending, fired: t.staff.fired, preparing: t.staff.preparing, ready: t.staff.ready, served: t.staff.served, cancelled: t.staff.cancelled });
  const isHeld = item.hold;
  const isReady = item.status === 'ready' || item.status === 'served';
  const isCancelled = item.status === 'cancelled';

  let modifiers: string[] = [];
  try { if (item.modifiers) modifiers = JSON.parse(item.modifiers); } catch { if (item.modifiers) modifiers = [item.modifiers]; }

  return (
    <div className={`py-2.5 px-3 rounded-lg border transition-colors ${
      isHeld ? 'border-amber-500/40 bg-amber-500/5 border-dashed' :
      isReady ? 'border-emerald-500/30 bg-emerald-500/5' :
      isCancelled ? 'border-red-500/20 bg-red-500/5 opacity-50' :
      'border-border bg-muted/30'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ backgroundColor: `${stationColor}20`, color: stationColor }}>
          {item.quantity}×
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-bold ${isReady ? 'text-emerald-600 dark:text-emerald-400 line-through' : 'text-foreground'}`}>
              {locale === 'ar' && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName}
            </span>
            {item.seatNumber && (
              <span className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-medium">
                {t.staff.seat} {item.seatNumber}
              </span>
            )}
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {isHeld && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 animate-pulse flex items-center gap-0.5">
                <Snowflake className="size-2.5" />{t.staff.hold}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {isHeld && !isReady && !isCancelled && (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-9 min-w-[72px] px-2.5" onClick={() => onFire(item.id)}>
              <Flame className="size-3.5 me-1" />{t.staff.fire}
            </Button>
          )}
          {!isReady && !isCancelled && !isHeld && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 min-w-[72px] px-2.5" onClick={() => onBump(item.id)}>
              <Check className="size-3.5 me-1" />{t.staff.bump}
            </Button>
          )}
          {isReady && (
            <div className="flex items-center justify-center h-9 w-9 bg-emerald-500/15 rounded-lg">
              <Check className="size-4 text-emerald-500" />
            </div>
          )}
        </div>
      </div>
      {modifiers.length > 0 && (
        <div className="mt-1.5 ms-[52px] flex flex-wrap items-center gap-1">
          {modifiers.map((mod: string | { name?: string }, i: number) => (
            <span key={i} className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              {typeof mod === 'string' ? mod : mod.name || ''}
            </span>
          ))}
        </div>
      )}
      {item.notes && (
        <div className="mt-1.5 ms-[52px]">
          <span className="text-xs text-amber-600 dark:text-amber-400 italic break-words">{item.notes}</span>
        </div>
      )}
    </div>
  );
}
