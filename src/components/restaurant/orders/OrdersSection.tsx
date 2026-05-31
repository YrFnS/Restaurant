"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Package,
  Search,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Order } from "./OrderStatusBadge";
import { TrackOrderSection, HistorySection } from "./OrderList";

/* ─── Main OrdersSection ─── */
export function OrdersSection() {
  const { t, isRTL, locale } = useI18n();
  const lastOrderNumber = useRestaurantStore((s) => s.lastOrderNumber);
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const settings = useRestaurantStore((s) => s.settings);
  const currency = settings?.currencySymbol ?? "";

  // Order tracking state
  const [trackInput, setTrackInput] = useState(lastOrderNumber || "");
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);

  // Previous status for change detection
  const prevStatusRef = useRef<string | null>(null);

  // Auto-load last order
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Order history state
  const [historyPhone, setHistoryPhone] = useState(customerPhone || "");
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"track" | "history">("track");

  // Fetch order by ID or order number
  const fetchOrder = useCallback(
    async (orderNumber: string) => {
      if (!orderNumber.trim()) return;
      setTrackingLoading(true);
      setTrackingError(false);

      try {
        const res = await fetch(
          `/api/orders?phone=${encodeURIComponent(orderNumber.trim())}`
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        const found = (data.orders as Order[]).find(
          (o: Order) =>
            o.orderNumber.toLowerCase() ===
            orderNumber.trim().toUpperCase().replace(/^#/, "")
        );

        if (found) {
          // Check if status changed
          if (prevStatusRef.current && prevStatusRef.current !== found.status) {
            setStatusChanged(true);
            setTimeout(() => setStatusChanged(false), 2000);
          }
          prevStatusRef.current = found.status;
          setTrackingOrder(found);
        } else if (data.orders && data.orders.length > 0) {
          if (prevStatusRef.current && prevStatusRef.current !== data.orders[0].status) {
            setStatusChanged(true);
            setTimeout(() => setStatusChanged(false), 2000);
          }
          prevStatusRef.current = data.orders[0].status;
          setTrackingOrder(data.orders[0]);
        } else {
          setTrackingError(true);
        }
      } catch {
        setTrackingError(true);
      } finally {
        setTrackingLoading(false);
      }
    },
    []
  );

  // Auto-load last placed order
  useEffect(() => {
    if (lastOrderNumber && !autoLoaded) {
      setTrackInput(lastOrderNumber);
      fetchOrder(lastOrderNumber);
      setAutoLoaded(true);
    }
  }, [lastOrderNumber, autoLoaded, fetchOrder]);

  // Fetch order history by phone
  const fetchHistory = useCallback(async () => {
    if (!historyPhone.trim()) return;
    setHistoryLoading(true);
    setHistoryLoaded(true);

    try {
      const res = await fetch(
        `/api/orders?phone=${encodeURIComponent(historyPhone.trim())}`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setHistoryOrders(data.orders || []);
    } catch {
      setHistoryOrders([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPhone]);

  // Poll for order status updates (every 15s for active orders)
  useEffect(() => {
    if (!trackingOrder) return;
    if (
      trackingOrder.status === "completed" ||
      trackingOrder.status === "cancelled"
    )
      return;

    const interval = setInterval(() => {
      fetchOrder(trackingOrder.orderNumber);
    }, 15000);

    return () => clearInterval(interval);
  }, [trackingOrder, fetchOrder]);

  // Also poll history orders every 15 seconds for active ones
  useEffect(() => {
    if (!historyLoaded || historyOrders.length === 0) return;
    const hasActiveOrders = historyOrders.some(
      (o) => o.status !== "completed" && o.status !== "cancelled"
    );
    if (!hasActiveOrders) return;

    const interval = setInterval(() => {
      fetchHistory();
    }, 15000);

    return () => clearInterval(interval);
  }, [historyOrders, historyLoaded, fetchHistory]);

  // Check if any tracked order is active (for Live indicator)
  const hasActiveOrder = trackingOrder
    ? trackingOrder.status !== "completed" && trackingOrder.status !== "cancelled"
    : false;

  const handleTrack = () => {
    fetchOrder(trackInput);
  };

  const handleLookupHistory = () => {
    fetchHistory();
  };

  const handleRefresh = () => {
    if (activeTab === "track" && trackingOrder) {
      fetchOrder(trackingOrder.orderNumber);
    } else if (activeTab === "history" && historyLoaded) {
      fetchHistory();
    }
  };

  return (
    <div className="min-h-screen pb-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-14 md:top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            <h1 className="text-lg font-bold">{t.orders.title}</h1>
            {/* Live indicator */}
            {hasActiveOrder && (
              <div className="live-ripple flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="size-2 rounded-full bg-green-500 pulse-dot" />
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                  {t.orders.live}
                </span>
              </div>
            )}
          </div>
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleRefresh}
          >
            <RefreshCw className="size-3.5" />
            <span className="text-xs">{t.orders.refresh}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t.orders.subtitle}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Tab Switcher */}
        <div className="flex p-1 rounded-xl bg-muted/50 border border-border/60">
          <button
            onClick={() => setActiveTab("track")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "track"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="size-4" />
            {t.orders.track}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="size-4" />
            {t.orders.orderHistory}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "track" ? (
            <TrackOrderSection
              trackInput={trackInput}
              onTrackInputChange={setTrackInput}
              onTrack={handleTrack}
              trackingLoading={trackingLoading}
              trackingError={trackingError}
              trackingOrder={trackingOrder}
              statusChanged={statusChanged}
              currency={currency}
              hasLastOrder={!!lastOrderNumber}
            />
          ) : (
            <HistorySection
              historyPhone={historyPhone}
              onHistoryPhoneChange={setHistoryPhone}
              onLookupHistory={handleLookupHistory}
              historyLoading={historyLoading}
              historyLoaded={historyLoaded}
              historyOrders={historyOrders}
              currency={currency}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
