"use client";

import React from "react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ChefHat,
  UtensilsCrossed,
  Truck,
  Package,
  CheckCircle2,
  ClipboardList,
  XCircle,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { Order } from "./types";

/* ─── Status Steps ─── */
const STATUS_STEPS = [
  { key: "pending", icon: ClipboardList },
  { key: "confirmed", icon: CheckCircle2 },
  { key: "preparing", icon: ChefHat },
  { key: "ready", icon: UtensilsCrossed },
  { key: "completed", icon: Package },
] as const;

/* ─── Countdown Timer ─── */
function EstimatedReadyCountdown({ estimatedReady, status }: { estimatedReady: string | null; status: string }) {
  const { t, locale } = useI18n();
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!estimatedReady || status === "completed" || status === "cancelled") return;

    const updateTime = () => {
      const now = new Date();
      const ready = new Date(estimatedReady);
      const diff = ready.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(t.home.justNow || "Now");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [estimatedReady, status, locale]);

  if (!timeLeft || status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
      <Clock className="size-3.5 animate-pulse" />
      <span>{t.orders.estimatedReady}: {timeLeft}</span>
    </div>
  );
}

/* ─── Progress Tracker ─── */
function OrderProgressTracker({ status, statusChanged }: { status: string; statusChanged?: boolean }) {
  const { t } = useI18n();
  const currentIdx = status === "cancelled" ? 0 : STATUS_STEPS.findIndex((s) => s.key === status);
  const effectiveIdx = currentIdx >= 0 ? currentIdx : 0;
  const isCancelled = status === "cancelled";

  const visibleSteps = isCancelled
    ? STATUS_STEPS.slice(0, 1)
    : STATUS_STEPS;

  return (
    <div className="py-4">
      {isCancelled && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
          <XCircle className="size-5 text-red-500" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            {t.orders.status.cancelled}
          </span>
        </div>
      )}

      {/* Animated progress bar */}
      {!isCancelled && (
        <div className="mb-4 h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-500 rounded-full progress-glow"
            initial={{ width: "0%" }}
            animate={{ width: `${(effectiveIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
        </div>
      )}

      <div className="flex items-center justify-between relative">
        {/* Timeline connecting line */}
        <div className="absolute top-5 start-6 end-6 h-0.5 bg-muted z-0" />
        {!isCancelled && effectiveIdx > 0 && (
          <motion.div
            className="absolute top-5 start-6 h-0.5 bg-primary z-0"
            initial={{ width: 0 }}
            animate={{
              width: `calc(${(effectiveIdx / (STATUS_STEPS.length - 1)) * 100}% - 24px)`,
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}

        {visibleSteps.map((step, idx) => {
          const isCompleted = idx <= effectiveIdx && !isCancelled;
          const isCurrent = idx === effectiveIdx && !isCancelled;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="flex flex-col items-center relative z-10"
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`size-10 rounded-full flex items-center justify-center border-2 ${
                  isCurrent
                    ? "border-primary ring-4 ring-primary/20"
                    : isCompleted
                    ? "border-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {isCompleted && idx < effectiveIdx ? (
                  <CheckCircle2 className="size-5 text-primary-foreground" />
                ) : (
                  <Icon
                    className={`size-5 ${
                      isCompleted
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  />
                )}
                {/* Pulsing dot for current step */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  />
                )}
              </motion.div>
              <span
                className={`text-[10px] sm:text-xs mt-1.5 font-medium text-center max-w-[60px] leading-tight ${
                  isCurrent
                    ? "text-primary font-bold"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t.orders.status[step.key as keyof typeof t.orders.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Order Details Card ─── */
interface OrderDetailsCardProps {
  order: Order;
  statusChanged?: boolean;
  currency: string;
}

export function OrderDetailsCard({ order, statusChanged, currency }: OrderDetailsCardProps) {
  const { t, locale } = useI18n();
  const typeIcons: Record<string, React.ElementType> = {
    dine_in: UtensilsCrossed,
    takeout: ShoppingBag,
    delivery: Truck,
  };
  const TypeIcon = typeIcons[order.type] || ShoppingBag;

  const typeLabels: Record<string, string> = {
    dine_in: t.cart.dineIn,
    takeout: t.cart.takeout,
    delivery: t.cart.delivery,
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatEstimated = (dateStr: string | null) => {
    if (!dateStr) return "--:--";
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="shadow-none border-border/60 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Order Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TypeIcon className="size-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {typeLabels[order.type] || order.type}
              </span>
            </div>
            <h3 className="text-lg font-bold">
              #{order.orderNumber}
            </h3>
          </div>
          <OrderStatusBadge status={order.status} statusChanged={statusChanged} />
        </div>

        {/* Date & Estimated Time with Countdown */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              <span>{formatDate(order.createdAt)}</span>
            </div>
          </div>
          {/* Countdown for preparing/confirmed orders */}
          {(order.status === "preparing" || order.status === "confirmed") && order.estimatedReady && (
            <EstimatedReadyCountdown estimatedReady={order.estimatedReady} status={order.status} />
          )}
          {order.estimatedReady && order.status !== "preparing" && order.status !== "confirmed" && order.status !== "completed" && order.status !== "cancelled" && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChefHat className="size-3.5" />
              <span>
                {t.orders.estimatedReady}: {formatEstimated(order.estimatedReady)}
              </span>
            </div>
          )}
        </div>

        {/* Progress Tracker */}
        {order.status !== "cancelled" && order.status !== "completed" && (
          <OrderProgressTracker status={order.status} statusChanged={statusChanged} />
        )}

        <Separator />

        {/* Items */}
        <div>
          <h4 className="text-sm font-semibold mb-2">{t.orders.items}</h4>
          <div className="space-y-2">
            {order.items.map((item) => {
              const itemName =
                locale === "ar" ? item.menuItem.nameAr : item.menuItem.nameEn;
              let parsedMods: { nameEn: string; nameAr: string }[] = [];
              try {
                parsedMods = JSON.parse(item.modifiers || "[]");
              } catch {
                // ignore
              }

              return (
                <div key={item.id} className="flex items-center gap-3">
                  {item.menuItem.image && (
                    <div className="size-10 rounded-md overflow-hidden shrink-0 bg-muted">
                      <img
                        src={item.menuItem.image}
                        alt={itemName}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {itemName}
                        <span className="text-muted-foreground ms-1">x{item.quantity}</span>
                      </span>
                      <span className="text-sm font-semibold shrink-0">
                        {currency}{item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                    {parsedMods.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {parsedMods
                          .map((m) => (locale === "ar" ? m.nameAr : m.nameEn))
                          .join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground/70 italic truncate">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.cart.subtotal}</span>
            <span>{currency}{order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.cart.tax}</span>
            <span>{currency}{order.taxAmount.toFixed(2)}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.deliveryFee}</span>
              <span>{currency}{order.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600">{t.cart.discount}</span>
              <span className="text-emerald-600">
                -{currency}{order.discountAmount.toFixed(2)}
              </span>
            </div>
          )}
          {order.tipAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.tip}</span>
              <span>{currency}{order.tipAmount.toFixed(2)}</span>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between font-bold">
            <span>{t.cart.total}</span>
            <span className="text-primary text-lg">
              {currency}{order.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Receipt className="size-3.5" />
          <span>
            {order.paymentMethod === "card" ? t.cart.card : t.cart.cash}
            {" · "}
            {order.paymentStatus === "paid" ? "✓" : "○"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
