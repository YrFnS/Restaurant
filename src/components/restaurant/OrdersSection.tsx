"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Package,
  CheckCircle2,
  Clock,
  ChefHat,
  UtensilsCrossed,
  Truck,
  RotateCcw,
  ChevronDown,
  Loader2,
  AlertCircle,
  ClipboardList,
  ShoppingBag,
  Phone,
  Receipt,
  XCircle,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartModifier } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";

/* ─── Types ─── */
interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: string;
  notes: string | null;
  menuItem: {
    id: string;
    nameEn: string;
    nameAr: string;
    image: string;
    price: number;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  estimatedReady: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

/* ─── Status Config ─── */
const STATUS_STEPS = [
  { key: "pending", icon: ClipboardList },
  { key: "confirmed", icon: CheckCircle2 },
  { key: "preparing", icon: ChefHat },
  { key: "ready", icon: UtensilsCrossed },
  { key: "completed", icon: Package },
] as const;

const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "completed"];

function getStatusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "confirmed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "preparing":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "ready":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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
  const currentIdx = getStatusIndex(status);
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
            animate={{ width: `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
        </div>
      )}

      <div className="flex items-center justify-between relative">
        {/* Timeline connecting line */}
        <div className="absolute top-5 start-6 end-6 h-0.5 bg-muted z-0" />
        {!isCancelled && currentIdx > 0 && (
          <motion.div
            className="absolute top-5 start-6 h-0.5 bg-primary z-0"
            initial={{ width: 0 }}
            animate={{
              width: `calc(${(currentIdx / (STATUS_STEPS.length - 1)) * 100}% - 24px)`,
            }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}

        {visibleSteps.map((step, idx) => {
          const isCompleted = idx <= currentIdx && !isCancelled;
          const isCurrent = idx === currentIdx && !isCancelled;
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
                {isCompleted && idx < currentIdx ? (
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
function OrderDetailsCard({ order, statusChanged, currency }: { order: Order; statusChanged?: boolean; currency: string }) {
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
          <motion.div
            animate={statusChanged ? { scale: [1, 1.2, 1], opacity: [1, 0.5, 1], backgroundColor: ["hsl(var(--primary))", "hsl(var(--primary) / 50%)", "hsl(var(--primary))"] } : { scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className={`${getStatusColor(order.status)} ${statusChanged ? "ring-2 ring-primary/40" : ""}`}>
              {t.orders.status[order.status as keyof typeof t.orders.status] || order.status}
            </Badge>
          </motion.div>
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

/* ─── Order History Item (Collapsible) ─── */
function OrderHistoryItem({ order, currency }: { order: Order; currency: string }) {
  const { t, locale } = useI18n();
  const addToCart = useRestaurantStore((s) => s.addToCart);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const notifications = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleReorder = () => {
    let addedCount = 0;
    order.items.forEach((item) => {
      let parsedMods: CartModifier[] = [];
      try {
        const raw = JSON.parse(item.modifiers || "[]");
        parsedMods = raw.map((m: { id?: string; nameEn?: string; nameAr?: string; price?: number; type?: string }) => ({
          id: m.id || "",
          nameEn: m.nameEn || "",
          nameAr: m.nameAr || "",
          price: m.price || 0,
          type: (m.type as "addon" | "variant") || "addon",
        }));
      } catch {
        // ignore
      }

      addToCart({
        id: `${item.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.menuItemId,
        nameEn: item.menuItem.nameEn,
        nameAr: item.menuItem.nameAr,
        price: item.unitPrice,
        quantity: item.quantity,
        image: item.menuItem.image,
        modifiers: parsedMods,
        notes: item.notes || "",
        totalPrice: item.totalPrice,
      });
      addedCount++;
    });

    if (addedCount > 0) {
      notifications.cartAdded(t.orders.reorderAdded);
    }
  };

  const itemSummary =
    order.items
      .map((item) =>
        locale === "ar" ? item.menuItem.nameAr : item.menuItem.nameEn
      )
      .join(", ") || "--";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-none border-border/60">
        <CollapsibleTrigger asChild>
          <button className="w-full text-start p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">#{order.orderNumber}</span>
                  <Badge
                    variant="secondary"
                    className={getStatusColor(order.status)}
                  >
                    {t.orders.status[
                      order.status as keyof typeof t.orders.status
                    ] || order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {itemSummary}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{formatDate(order.createdAt)}</span>
                  <span className="font-semibold text-foreground">
                    {currency}{order.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-4 text-muted-foreground" />
              </motion.div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <Separator className="mb-3" />
            <OrderDetailsCard order={order} currency={currency} />
            {order.status === "completed" && (
              <Button
                size="sm"
                className="w-full mt-3 gap-2"
                onClick={handleReorder}
              >
                <RotateCcw className="size-3.5" />
                {t.orders.reorder}
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ─── Loading Skeletons ─── */
function OrderSkeleton() {
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

function HistorySkeleton() {
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
function NoOrderFound() {
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

function NoHistoryState() {
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
                        onChange={(e) => setTrackInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleTrack();
                        }}
                        className="text-sm ps-9"
                      />
                    </div>
                    <Button
                      onClick={handleTrack}
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
              {!trackingOrder && !trackingLoading && !trackingError && !lastOrderNumber && (
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
          ) : (
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
                        onChange={(e) => setHistoryPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleLookupHistory();
                        }}
                        className="text-sm ps-9"
                      />
                    </div>
                    <Button
                      onClick={handleLookupHistory}
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Reorder Button for Tracked Orders ─── */
function TrackedOrderReorderButton({ order }: { order: Order }) {
  const { t } = useI18n();
  const addToCart = useRestaurantStore((s) => s.addToCart);
  const notifications = useNotifications();

  const handleReorder = () => {
    let addedCount = 0;
    order.items.forEach((item) => {
      let parsedMods: CartModifier[] = [];
      try {
        const raw = JSON.parse(item.modifiers || "[]");
        parsedMods = raw.map((m: { id?: string; nameEn?: string; nameAr?: string; price?: number; type?: string }) => ({
          id: m.id || "",
          nameEn: m.nameEn || "",
          nameAr: m.nameAr || "",
          price: m.price || 0,
          type: (m.type as "addon" | "variant") || "addon",
        }));
      } catch {
        // ignore
      }

      addToCart({
        id: `${item.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.menuItemId,
        nameEn: item.menuItem.nameEn,
        nameAr: item.menuItem.nameAr,
        price: item.unitPrice,
        quantity: item.quantity,
        image: item.menuItem.image,
        modifiers: parsedMods,
        notes: item.notes || "",
        totalPrice: item.totalPrice,
      });
      addedCount++;
    });

    if (addedCount > 0) {
      notifications.cartAdded(t.orders.reorderAdded);
    }
  };

  return (
    <Button
      className="w-full mt-3 gap-2"
      onClick={handleReorder}
    >
      <ShoppingCart className="size-4" />
      {t.orders.reorder}
    </Button>
  );
}
