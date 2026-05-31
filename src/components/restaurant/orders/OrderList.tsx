"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Search,
  Package,
  AlertCircle,
  ClipboardList,
  Phone,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { Order } from "./OrderStatusBadge";
import { OrderDetailsCard, TrackedOrderReorderButton } from "./OrderDetail";
import { OrderHistoryItem } from "./OrderCard";

/* ─── Loading Skeletons ─── */
export function OrderSkeleton() {
  return (
    <Card className="shadow-none border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="shadow-none border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Empty States ─── */
export function NoOrderFound() {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <AlertCircle className="size-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">{t.orders.orderNotFound}</h3>
      <p className="text-sm text-muted-foreground">{t.orders.orderNotFoundDesc}</p>
    </motion.div>
  );
}

export function NoHistoryState() {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ClipboardList className="size-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">{t.orders.noOrders}</h3>
    </motion.div>
  );
}

/* ─── Track Order Section ─── */
interface TrackOrderSectionProps {
  trackInput: string;
  onTrackInputChange: (val: string) => void;
  onTrack: () => void;
  trackingLoading: boolean;
  trackingError: boolean;
  trackingOrder: Order | null;
  statusChanged: boolean;
  currency: string;
  hasLastOrder: boolean;
}

export function TrackOrderSection({
  trackInput,
  onTrackInputChange,
  onTrack,
  trackingLoading,
  trackingError,
  trackingOrder,
  statusChanged,
  currency,
  hasLastOrder,
}: TrackOrderSectionProps) {
  const { t } = useI18n();

  return (
    <motion.div
      key="track"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Track Order Input */}
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t.orders.enterOrderNumber}
                value={trackInput}
                onChange={(e) => onTrackInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onTrack();
                }}
                className="text-sm ps-9"
              />
            </div>
            <Button
              onClick={onTrack}
              disabled={!trackInput.trim() || trackingLoading}
              className="shrink-0 gap-2"
            >
              {trackingLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              <span className="hidden sm:inline">{t.orders.track}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {trackingLoading && <OrderSkeleton />}

      {/* Error */}
      {trackingError && !trackingLoading && <NoOrderFound />}

      {/* Order Details */}
      {trackingOrder && !trackingLoading && !trackingError && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <OrderDetailsCard order={trackingOrder} statusChanged={statusChanged} currency={currency} />
          {/* Reorder button for completed tracked orders */}
          {trackingOrder.status === "completed" && (
            <TrackedOrderReorderButton order={trackingOrder} />
          )}
        </motion.div>
      )}

      {/* Initial state - no order loaded */}
      {!trackingOrder && !trackingLoading && !trackingError && !hasLastOrder && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-10 text-center"
        >
          <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="size-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">{t.orders.enterOrderNumber}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t.orders.subtitle}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── History Section ─── */
interface HistorySectionProps {
  historyPhone: string;
  onHistoryPhoneChange: (val: string) => void;
  onLookupHistory: () => void;
  historyLoading: boolean;
  historyLoaded: boolean;
  historyOrders: Order[];
  currency: string;
}

export function HistorySection({
  historyPhone,
  onHistoryPhoneChange,
  onLookupHistory,
  historyLoading,
  historyLoaded,
  historyOrders,
  currency,
}: HistorySectionProps) {
  const { t } = useI18n();

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Phone Lookup */}
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t.orders.enterPhone}
                value={historyPhone}
                onChange={(e) => onHistoryPhoneChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLookupHistory();
                }}
                className="text-sm ps-9"
              />
            </div>
            <Button
              onClick={onLookupHistory}
              disabled={!historyPhone.trim() || historyLoading}
              variant="outline"
              className="shrink-0 gap-2"
            >
              {historyLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              <span className="hidden sm:inline">
                {t.orders.orderHistory}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {historyLoading && <HistorySkeleton />}

      {/* History List */}
      {!historyLoading && historyLoaded && historyOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-muted-foreground">
            {historyOrders.length} {t.orders.items}
          </h3>
          {historyOrders.map((order) => (
            <OrderHistoryItem key={order.id} order={order} currency={currency} />
          ))}
        </motion.div>
      )}

      {/* No results */}
      {!historyLoading && historyLoaded && historyOrders.length === 0 && (
        <NoHistoryState />
      )}

      {/* Initial state */}
      {!historyLoaded && !historyLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-10 text-center"
        >
          <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="size-10 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">{t.orders.orderHistory}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t.orders.enterPhoneForHistory}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
