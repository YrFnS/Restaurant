"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Snowflake, Flame, AlertCircle, Check, CheckCircle2, Zap,
  UtensilsCrossed, Bike, Car, Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { StationTimer } from "./StationTimer";

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

function getUrgencyLevel(seconds: number): "fresh" | "normal" | "warning" | "urgent" | "critical" {
  const minutes = seconds / 60;
  if (minutes < 5) return "fresh";
  if (minutes < 10) return "normal";
  if (minutes < 15) return "warning";
  if (minutes < 20) return "urgent";
  return "critical";
}

function getUrgencyColors(level: ReturnType<typeof getUrgencyLevel>) {
  switch (level) {
    case "fresh": return { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", ring: "#10b981", light: "bg-emerald-500/10" };
    case "normal": return { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", ring: "#f59e0b", light: "bg-amber-500/10" };
    case "warning": return { bg: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", ring: "#f97316", light: "bg-orange-500/10" };
    case "urgent": return { bg: "bg-red-500", text: "text-red-600 dark:text-red-400", ring: "#ef4444", light: "bg-red-500/10" };
    case "critical": return { bg: "bg-red-600", text: "text-red-700 dark:text-red-400", ring: "#dc2626", light: "bg-red-600/10" };
  }
}

function getStatusInfo(status: string, t?: { pending: string; fired: string; preparing: string; ready: string; served: string; cancelled: string }): { label: string; color: string; bg: string } {
  const labels = t ? { pending: t.pending, fired: t.fired, preparing: t.preparing, ready: t.ready, served: t.served, cancelled: t.cancelled } : { pending: "Pending", fired: "Fired", preparing: "Prepping", ready: "Ready", served: "Served", cancelled: "Cancelled" };
  switch (status) {
    case "pending": return { label: labels.pending, color: "text-muted-foreground", bg: "bg-muted" };
    case "fired": return { label: labels.fired, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" };
    case "preparing": return { label: labels.preparing, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" };
    case "ready": return { label: labels.ready, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" };
    case "served": return { label: labels.served, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-600/15" };
    case "cancelled": return { label: labels.cancelled, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15" };
    default: return { label: status, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

function getOrderTypeIcon(type: string, labels?: { takeout: string; delivery: string; driveThru: string; dineIn: string }): { icon: React.ReactNode; label: string; color: string; bg: string } {
  const l = labels || { takeout: "Takeout", delivery: "Delivery", driveThru: "Drive-Thru", dineIn: "Dine-In" };
  switch (type) {
    case "takeout": return { icon: <UtensilsCrossed className="size-3.5" />, label: l.takeout, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" };
    case "delivery": return { icon: <Bike className="size-3.5" />, label: l.delivery, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" };
    case "drive_thru": return { icon: <Car className="size-3.5" />, label: l.driveThru, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10" };
    default: return { icon: <Users className="size-3.5" />, label: l.dineIn, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" };
  }
}

function OrderItemCard({ item, stationColor, onBump, onFire }: {
  item: OrderItemData; stationColor: string; onBump: (id: string) => void; onFire: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const statusInfo = getStatusInfo(item.status, { pending: t.staff.pending, fired: t.staff.fired, preparing: t.staff.preparing, ready: t.staff.ready, served: t.staff.served, cancelled: t.staff.cancelled });
  const isHeld = item.hold;
  const isReady = item.status === "ready" || item.status === "served";
  const isCancelled = item.status === "cancelled";

  let modifiers: string[] = [];
  try { if (item.modifiers) modifiers = JSON.parse(item.modifiers); } catch { if (item.modifiers) modifiers = [item.modifiers]; }

  return (
    <div className={`py-2 px-3 rounded-lg border transition-all ${
      isHeld ? "border-amber-500/40 bg-amber-500/5 border-dashed" :
      isReady ? "border-emerald-500/30 bg-emerald-500/5" :
      isCancelled ? "border-red-500/20 bg-red-500/5 opacity-50" :
      "border-border bg-muted/30"
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ backgroundColor: `${stationColor}20`, color: stationColor }}>
          {item.quantity}×
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold ${isReady ? "text-emerald-600 dark:text-emerald-400 line-through" : "text-foreground"}`}>
              {locale === "ar" && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName}
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
                  {typeof mod === "string" ? mod : mod.name || ""}
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

interface StationOrderCardProps {
  order: OrderData;
  stationSlug: string;
  stationColor: string;
  onBump: (id: string) => void;
  onFire: (id: string) => void;
  onBumpAll: (order: OrderData) => void;
  orderIndex: number;
}

export function StationOrderCard({ order, stationSlug, stationColor, onBump, onFire, onBumpAll, orderIndex }: StationOrderCardProps) {
  const { t } = useI18n();

  const filteredItems = useMemo(() => {
    if (stationSlug === "all") return order.items;
    return order.items.filter((item) => item.station?.toLowerCase() === stationSlug.toLowerCase());
  }, [order.items, stationSlug]);

  const heldItems = filteredItems.filter((item) => item.hold);
  const activeItems = filteredItems.filter((item) => !item.hold);
  const hasBumpableItems = filteredItems.some((item) => !["ready", "served", "cancelled"].includes(item.status));
  const allReady = filteredItems.filter((item) => item.status !== "cancelled").every((item) => ["ready", "served"].includes(item.status));

  const elapsedSeconds = getElapsedSeconds(order.createdAt);
  const level = getUrgencyLevel(elapsedSeconds);
  const colors = getUrgencyColors(level);
  const orderTypeInfo = getOrderTypeIcon(order.type, { takeout: t.staff.takeout, delivery: t.staff.delivery, driveThru: t.staff.driveThru, dineIn: t.staff.dineIn });
  const isPriority = level === "urgent" || level === "critical";

  if (filteredItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: orderIndex * 0.04 }}
      layout
    >
      <Card className={`bg-card border-border overflow-hidden transition-all hover:shadow-xl ${isPriority ? "ring-1" : ""}`}
        style={isPriority ? { "--tw-ring-color": `${colors.ring}40`, borderColor: `${colors.ring}30` } as React.CSSProperties : {}}>

        <div className={`h-1.5 ${colors.bg} ${level === "critical" ? "animate-pulse" : ""}`} />

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
              <StationTimer createdAt={order.createdAt} compact />
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
              <Button size="sm" className={`w-full font-bold text-sm h-10 tracking-wide ${isPriority ? "bg-red-600 hover:bg-red-500 animate-pulse" : "bg-emerald-600 hover:bg-emerald-500"} text-white`}
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
