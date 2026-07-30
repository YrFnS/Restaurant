"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle,
  CheckCircle2,
  ChefHat,
  Circle,
  Clock,
  Download,
  Home as HomeIcon,
  KeyRound,
  Loader2,
  Package,
  Printer,
  Search,
  ShoppingBag,
  Timer,
  Truck,
  Utensils,
  XCircle,
} from "lucide-react";

type StatusVisual = {
  icon: ElementType;
  color: string;
  bg: string;
};

const statusConfig: Record<string, StatusVisual> = {
  pending: { icon: Package, color: "text-slate-600", bg: "bg-slate-500" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-500" },
  preparing: { icon: ChefHat, color: "text-amber-600", bg: "bg-amber-500" },
  ready: { icon: Bell, color: "text-green-600", bg: "bg-green-500" },
  completed: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500" },
  cancelled: { icon: XCircle, color: "text-red-600", bg: "bg-red-500" },
};

function normalizedOrderNumber(value: string): string {
  return value.replace(/^#/, "").trim();
}

export default function OrderTrackingPage() {
  const { t, isRTL, fmtCurrency, fmtTime, fmtRelative } = useI18n();
  const params = useParams<{ orderNumber: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const recentOrders = useRestaurantStore((state) => state.recentOrders);
  const rememberOrderAccess = useRestaurantStore(
    (state) => state.rememberOrderAccess
  );

  const routeOrderNumber = useMemo(() => {
    const raw = Array.isArray(params.orderNumber)
      ? params.orderNumber[0]
      : params.orderNumber;
    return normalizedOrderNumber(decodeURIComponent(raw || ""));
  }, [params.orderNumber]);
  const tokenFromUrl = searchParams.get("token") || "";
  const savedToken =
    recentOrders.find(
      (recent) =>
        normalizedOrderNumber(recent.orderNumber) === routeOrderNumber
    )?.accessToken || "";
  const accessToken = tokenFromUrl || savedToken;

  const [inputNumber, setInputNumber] = useState(routeOrderNumber);
  const [inputToken, setInputToken] = useState(accessToken);

  useEffect(() => {
    setInputNumber(routeOrderNumber);
    setInputToken(accessToken);
  }, [accessToken, routeOrderNumber]);

  useEffect(() => {
    if (routeOrderNumber && tokenFromUrl) {
      rememberOrderAccess(`#${routeOrderNumber}`, tokenFromUrl);
    }
  }, [rememberOrderAccess, routeOrderNumber, tokenFromUrl]);

  const orderQuery = useQuery({
    queryKey: ["track-order", routeOrderNumber, accessToken],
    enabled: Boolean(routeOrderNumber),
    retry: false,
    refetchInterval: 5_000,
    queryFn: async () => {
      const tokenQuery = accessToken
        ? `?token=${encodeURIComponent(accessToken)}`
        : "";
      const response = await fetch(
        `/api/orders/track/${encodeURIComponent(routeOrderNumber)}${tokenQuery}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order) {
        throw new Error(data?.error || "Order not found or access denied");
      }
      return data;
    },
  });

  const order = orderQuery.data?.order;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const trackNew = () => {
    const number = normalizedOrderNumber(inputNumber);
    const token = inputToken.trim();
    if (!number) return;

    router.push(
      `/track/${encodeURIComponent(number)}${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`
    );
  };

  const buildReceiptText = (currentOrder: any) => {
    const lines: string[] = [];
    lines.push("═══════════════════════════════");
    lines.push(isRTL ? "زعفران وبهارات" : "Saffron & Spice");
    lines.push("═══════════════════════════════");
    lines.push(`${isRTL ? "طلب" : "Order"}: ${currentOrder.orderNumber}`);
    lines.push(
      `${isRTL ? "النوع" : "Type"}: ${(t.track as any)[currentOrder.type] || currentOrder.type}`
    );
    if (currentOrder.table) {
      lines.push(
        `${isRTL ? "طاولة" : "Table"}: ${currentOrder.table.number}`
      );
    }
    if (currentOrder.serverName) {
      lines.push(
        `${isRTL ? "النادل" : "Server"}: ${currentOrder.serverName}`
      );
    }
    lines.push(
      `${isRTL ? "التاريخ" : "Date"}: ${new Date(
        currentOrder.createdAt
      ).toLocaleString()}`
    );
    lines.push("───────────────────────────────");
    lines.push(isRTL ? "الأصناف:" : "ITEMS:");
    currentOrder.items.forEach((item: any) => {
      const name = isRTL ? item.menuItem?.nameAr : item.menuItem?.nameEn;
      lines.push(
        `  ${item.quantity}× ${name}  ${fmtCurrency(item.totalPrice)}`
      );
      if (item.notes) lines.push(`     ${item.notes}`);
    });
    lines.push("───────────────────────────────");
    lines.push(
      `${isRTL ? "المجموع الفرعي" : "Subtotal"}: ${fmtCurrency(
        currentOrder.subtotal
      )}`
    );
    if (currentOrder.discountAmount > 0) {
      lines.push(
        `${isRTL ? "الخصم" : "Discount"}: -${fmtCurrency(
          currentOrder.discountAmount
        )}`
      );
    }
    lines.push(
      `${isRTL ? "الضريبة" : "Tax"}: ${fmtCurrency(
        currentOrder.taxAmount
      )}`
    );
    if (currentOrder.deliveryFee > 0) {
      lines.push(
        `${isRTL ? "التوصيل" : "Delivery"}: ${fmtCurrency(
          currentOrder.deliveryFee
        )}`
      );
    }
    if (currentOrder.tipAmount > 0) {
      lines.push(
        `${isRTL ? "البقشيش" : "Tip"}: ${fmtCurrency(
          currentOrder.tipAmount
        )}`
      );
    }
    lines.push("───────────────────────────────");
    lines.push(
      `${isRTL ? "الإجمالي" : "TOTAL"}: ${fmtCurrency(currentOrder.total)}`
    );
    lines.push("═══════════════════════════════");
    lines.push(isRTL ? "شكراً لزيارتكم!" : "Thank you for visiting!");
    return lines.join("\n");
  };

  const downloadReceipt = (currentOrder: any) => {
    const blob = new Blob([buildReceiptText(currentOrder)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `receipt-${normalizedOrderNumber(
      currentOrder.orderNumber
    )}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? "تم تحميل الإيصال" : "Receipt downloaded");
  };

  const printReceipt = (currentOrder: any) => {
    const printWindow = window.open("", "_blank", "width=500,height=700");
    if (!printWindow) {
      toast.error(
        isRTL ? "الرجاء السماح بالنوافذ المنبثقة" : "Please allow popups"
      );
      return;
    }

    printWindow.document.write(`<!doctype html><html dir="${
      isRTL ? "rtl" : "ltr"
    }"><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;line-height:1.5}pre{white-space:pre-wrap}@media print{body{padding:0}}</style></head><body><pre id="receipt"></pre></body></html>`);
    printWindow.document.close();
    const receipt = printWindow.document.getElementById("receipt");
    if (receipt) receipt.textContent = buildReceiptText(currentOrder);
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (
      !window.confirm(
        isRTL
          ? "هل أنت متأكد من إلغاء هذا الطلب؟"
          : "Are you sure you want to cancel this order?"
      )
    ) {
      return;
    }

    try {
      const customerCancellation = Boolean(accessToken);
      const endpoint = customerCancellation
        ? `/api/orders/track/${encodeURIComponent(
            routeOrderNumber
          )}/cancel?token=${encodeURIComponent(accessToken)}`
        : `/api/orders/${order.id}`;
      const response = await fetch(endpoint, {
        method: customerCancellation ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: customerCancellation
          ? undefined
          : JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || t.common.error);
        return;
      }
      toast.success(isRTL ? "تم إلغاء الطلب" : "Order cancelled");
      await orderQuery.refetch();
    } catch {
      toast.error(t.common.error);
    }
  };

  const currentStatus = order?.status || "pending";
  const statusOrder = ["confirmed", "preparing", "ready", "completed"];
  const currentStep = statusOrder.indexOf(currentStatus);
  const visual = statusConfig[currentStatus] || statusConfig.pending;
  const StatusIcon = visual.icon;

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-background via-accent/20 to-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌶️</span>
            <span className="font-bold text-primary">
              {isRTL ? "زعفران وبهارات" : "Saffron & Spice"}
            </span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <HomeIcon className="size-4" />
              {t.track.backToHome}
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 md:py-10">
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
                <Input
                  aria-label={isRTL ? "رقم الطلب" : "Order number"}
                  placeholder={t.track.orderNumberPlaceholder}
                  value={inputNumber}
                  onChange={(event) => setInputNumber(event.target.value)}
                  className="ps-9"
                  onKeyDown={(event) => event.key === "Enter" && trackNew()}
                />
              </div>
              <Button onClick={trackNew} className="gap-1.5">
                <Search className="size-4" />
                {t.track.track}
              </Button>
            </div>
            <div className="relative">
              <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                aria-label={isRTL ? "رمز الوصول" : "Order access code"}
                placeholder={
                  isRTL
                    ? "رمز الوصول من رابط تأكيد الطلب"
                    : "Access code from the order confirmation link"
                }
                value={inputToken}
                onChange={(event) => setInputToken(event.target.value)}
                className="ps-9 font-mono text-xs"
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {orderQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {!orderQuery.isLoading && orderQuery.isError && (
          <Card className="text-center py-12">
            <CardContent className="p-8">
              <div className="size-20 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
                <XCircle className="size-10 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">
                {t.track.orderNotFound}
              </h2>
              <p className="text-muted-foreground">
                {isRTL
                  ? "تحقق من رقم الطلب ورمز الوصول الموجود في رابط التأكيد."
                  : "Check the order number and the access code from your confirmation link."}
              </p>
            </CardContent>
          </Card>
        )}

        {order && (
          <motion.div
            key={`${order.id}-${order.status}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="overflow-hidden border-0 shadow-lg">
              <div className={`${visual.bg} p-6 text-white relative overflow-hidden`}>
                <div className="absolute -top-8 -end-8 size-32 rounded-full bg-white/10" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white/80 text-sm">
                      {isRTL ? "رقم الطلب" : "Order Number"}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {order.orderNumber}
                    </p>
                    <p className="mt-2 text-sm text-white/90">
                      {(t.track as any)[
                        `status${currentStatus.charAt(0).toUpperCase()}${currentStatus.slice(1)}`
                      ] || currentStatus}
                    </p>
                  </div>
                  <div className="size-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <StatusIcon className="size-8" />
                  </div>
                </div>
              </div>
              {currentStatus !== "cancelled" && (
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    {statusOrder.map((status, index) => {
                      const StepIcon = statusConfig[status].icon;
                      const done = index <= currentStep;
                      return (
                        <div
                          key={status}
                          className="flex flex-col items-center flex-1 relative"
                        >
                          {index > 0 && (
                            <div
                              className={`absolute end-1/2 top-5 h-1 w-full ${
                                index <= currentStep ? "bg-primary" : "bg-muted"
                              }`}
                            />
                          )}
                          <div
                            className={`relative size-10 rounded-full flex items-center justify-center z-10 ${
                              done
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <StepIcon className="size-5" />
                          </div>
                          <span className="text-[10px] mt-1.5 text-center">
                            {(t.track as any)[
                              `status${status.charAt(0).toUpperCase()}${status.slice(1)}`
                            ] || status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Timer className="size-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.track.elapsedTime}
                    </p>
                    <p className="font-bold">
                      {order.elapsedMin} {t.track.minutes}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="size-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t.track.estimatedReady}
                    </p>
                    <p className="font-bold">
                      {order.estimatedRemainingMin} {t.track.minutes}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t.track.orderType}
                    </p>
                    <Badge variant="secondary" className="gap-1">
                      {order.type === "dine_in" && <Utensils className="size-3" />}
                      {order.type === "takeout" && (
                        <ShoppingBag className="size-3" />
                      )}
                      {order.type === "delivery" && <Truck className="size-3" />}
                      {(t.track as any)[order.type] || order.type}
                    </Badge>
                  </div>
                  {order.table && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t.track.table}
                      </p>
                      <p className="font-semibold">#{order.table.number}</p>
                    </div>
                  )}
                  {order.serverName && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t.track.server}
                      </p>
                      <p className="font-semibold">{order.serverName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t.track.liveUpdate}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                      {t.track.connected}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  {t.track.timeline}
                </h3>
                <div className="space-y-4">
                  {order.timeline.map((event: any, index: number) => {
                    const EventIcon = statusConfig[event.status]?.icon || Circle;
                    return (
                      <div key={`${event.status}-${index}`} className="flex gap-3">
                        <div
                          className={`size-8 rounded-full flex items-center justify-center ${
                            statusConfig[event.status]?.bg || "bg-muted"
                          }`}
                        >
                          <EventIcon className="size-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{event.label}</p>
                          {event.time && (
                            <p className="text-xs text-muted-foreground">
                              {fmtTime(event.time)} · {fmtRelative(event.time)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold mb-3">{t.track.orderItems}</h3>
                <div className="space-y-2">
                  {order.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-accent/30"
                    >
                      <div className="size-12 rounded-lg overflow-hidden bg-accent shrink-0">
                        {item.menuItem?.image ? (
                          <img
                            src={item.menuItem.image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">
                            🍽️
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm">
                          {item.quantity}× {isRTL ? item.menuItem?.nameAr : item.menuItem?.nameEn}
                        </span>
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium shrink-0">
                        {fmtCurrency(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isRTL ? "المجموع الفرعي" : "Subtotal"}
                    </span>
                    <span>{fmtCurrency(order.subtotal)}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{isRTL ? "الخصم" : "Discount"}</span>
                      <span>-{fmtCurrency(order.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isRTL ? "الضريبة" : "Tax"}
                    </span>
                    <span>{fmtCurrency(order.taxAmount)}</span>
                  </div>
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {isRTL ? "التوصيل" : "Delivery"}
                      </span>
                      <span>{fmtCurrency(order.deliveryFee)}</span>
                    </div>
                  )}
                  {order.tipAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {isRTL ? "البقشيش" : "Tip"}
                      </span>
                      <span>{fmtCurrency(order.tipAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>{isRTL ? "الإجمالي" : "Total"}</span>
                    <span className="text-primary">{fmtCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => downloadReceipt(order)}
              >
                <Download className="size-4" />
                {isRTL ? "تحميل الإيصال" : "Download Receipt"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => printReceipt(order)}
              >
                <Printer className="size-4" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
            </div>

            {["confirmed", "pending"].includes(order.status) && (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={cancelOrder}
              >
                <XCircle className="size-4" />
                {isRTL ? "إلغاء الطلب" : "Cancel Order"}
              </Button>
            )}
          </motion.div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-card py-4">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {isRTL ? "زعفران وبهارات" : "Saffron & Spice"}
        </div>
      </footer>
    </div>
  );
}
