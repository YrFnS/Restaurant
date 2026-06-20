"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Clock, ChefHat, CheckCircle2, Package, Utensils,
  XCircle, ArrowLeft, ArrowRight, Truck, ShoppingBag, Timer,
  CheckCircle, Circle, Loader2, Bell, Home as HomeIcon, Download, Printer
} from "lucide-react";

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-500" },
  preparing: { icon: ChefHat, color: "text-amber-600", bg: "bg-amber-500" },
  ready: { icon: Bell, color: "text-green-600", bg: "bg-green-500" },
  completed: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500" },
  cancelled: { icon: XCircle, color: "text-red-600", bg: "bg-red-500" },
};

export default function OrderTrackingPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { t, isRTL, fmtCurrency, fmtTime, fmtRelative } = useI18n();
  const [orderNumber] = useState(() => {
    // unwrap params
    return params.then((p) => p.orderNumber);
  });
  const [resolvedNumber, setResolvedNumber] = useState<string>("");
  const [inputNumber, setInputNumber] = useState("");

  useEffect(() => {
    orderNumber.then((n) => {
      setResolvedNumber(n);
      setInputNumber(n.replace(/^#/, ""));
    });
  }, [orderNumber]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["track-order", resolvedNumber],
    queryFn: async () => {
      const r = await fetch(`/api/orders/track/${resolvedNumber}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!resolvedNumber,
    refetchInterval: 5000, // live update every 5s
  });

  const order = data?.order;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const trackNew = () => {
    if (inputNumber) {
      window.location.href = `/track/${inputNumber.replace(/^#/, "")}`;
    }
  };

  const buildReceiptText = (order: any) => {
    const lines: string[] = [];
    lines.push("═══════════════════════════════");
    lines.push(isRTL ? "زعفران وبهارات" : "Saffron & Spice");
    lines.push("═══════════════════════════════");
    lines.push(`${isRTL ? "طلب" : "Order"}: ${order.orderNumber}`);
    lines.push(`${isRTL ? "النوع" : "Type"}: ${(t.track as any)[order.type] || order.type}`);
    if (order.table) lines.push(`${isRTL ? "طاولة" : "Table"}: ${order.table.number}`);
    if (order.serverName) lines.push(`${isRTL ? "النادل" : "Server"}: ${order.serverName}`);
    lines.push(`${isRTL ? "التاريخ" : "Date"}: ${new Date(order.createdAt).toLocaleString()}`);
    lines.push("───────────────────────────────");
    lines.push(isRTL ? "الأصناف:" : "ITEMS:");
    order.items.forEach((it: any) => {
      const name = isRTL ? it.menuItem?.nameAr : it.menuItem?.nameEn;
      lines.push(`  ${it.quantity}× ${name}  ${fmtCurrency(it.totalPrice)}`);
      if (it.notes) lines.push(`     📝 ${it.notes}`);
    });
    lines.push("───────────────────────────────");
    lines.push(`${isRTL ? "المجموع الفرعي" : "Subtotal"}: ${fmtCurrency(order.subtotal)}`);
    lines.push(`${isRTL ? "الضريبة" : "Tax"}: ${fmtCurrency(order.taxAmount)}`);
    if (order.deliveryFee > 0) lines.push(`${isRTL ? "التوصيل" : "Delivery"}: ${fmtCurrency(order.deliveryFee)}`);
    if (order.discountAmount > 0) lines.push(`${isRTL ? "الخصم" : "Discount"}: -${fmtCurrency(order.discountAmount)}`);
    if (order.tipAmount > 0) lines.push(`${isRTL ? "البقشيش" : "Tip"}: ${fmtCurrency(order.tipAmount)}`);
    lines.push("───────────────────────────────");
    lines.push(`${isRTL ? "الإجمالي" : "TOTAL"}: ${fmtCurrency(order.total)}`);
    lines.push("═══════════════════════════════");
    lines.push(isRTL ? "شكراً لزيارتكم!" : "Thank you for visiting!");
    return lines.join("\n");
  };

  const downloadReceipt = (order: any) => {
    const text = buildReceiptText(order);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${order.orderNumber.replace(/^#/, "")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isRTL ? "تم تحميل الإيصال" : "Receipt downloaded");
  };

  const printReceipt = (order: any) => {
    const text = buildReceiptText(order);
    const printWin = window.open("", "_blank", "width=400,height=600");
    if (!printWin) {
      toast.error(isRTL ? "الرجاء السماح بالنوافذ المنبثقة" : "Please allow popups");
      return;
    }
    printWin.document.write(`
      <html dir="${isRTL ? "rtl" : "ltr"}">
        <head><title>Receipt ${order.orderNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; white-space: pre; line-height: 1.5; }
          @media print { body { padding: 0; } }
        </style></head>
        <body>${text}</body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 300);
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (!confirm(isRTL ? "هل أنت متأكد من إلغاء هذا الطلب؟" : "Are you sure you want to cancel this order?")) return;
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (r.ok) {
        toast.success(isRTL ? "تم إلغاء الطلب" : "Order cancelled");
        refetch();
      }
    } catch {
      toast.error(t.common.error);
    }
  };

  const currentStatus = order?.status || "confirmed";
  const statusOrder = ["confirmed", "preparing", "ready", "completed"];
  const currentStep = statusOrder.indexOf(currentStatus);
  const config = statusConfig[currentStatus];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-accent/20 to-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌶️</span>
            <span className="font-bold text-primary">{isRTL ? "زعفران وبهارات" : "Saffron & Spice"}</span>
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
        {/* Search */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
                <Input
                  placeholder={t.track.orderNumberPlaceholder}
                  value={inputNumber}
                  onChange={(e) => setInputNumber(e.target.value)}
                  className="ps-9"
                  onKeyDown={(e) => e.key === "Enter" && trackNew()}
                />
              </div>
              <Button onClick={trackNew} className="gap-1.5">
                <Search className="size-4" />
                {t.track.track}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && !order && (
          <Card className="text-center py-12">
            <CardContent className="p-8">
              <div className="size-20 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-4">
                <XCircle className="size-10 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t.track.orderNotFound}</h2>
              <p className="text-muted-foreground">{t.track.orderNotFoundDesc}</p>
            </CardContent>
          </Card>
        )}

        {order && (
          <AnimatePresence mode="wait">
            <motion.div
              key={order.id + order.status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Status hero */}
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className={`${config.bg} p-6 text-white relative overflow-hidden`}>
                  <div className="absolute -top-8 -end-8 size-32 rounded-full bg-white/10" />
                  <div className="absolute -bottom-12 -start-4 size-24 rounded-full bg-white/5" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white/80 text-sm">{isRTL ? "رقم الطلب" : "Order Number"}</p>
                        <p className="text-3xl font-bold">{order.orderNumber}</p>
                      </div>
                      <div className="size-16 rounded-2xl bg-white/20 flex items-center justify-center">
                        <config.icon className="size-8" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <span className="size-2 rounded-full bg-white animate-pulse" />
                      <span className="text-sm font-medium">
                        {(t.track as any)[`status${currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}`] || currentStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  {/* Progress steps */}
                  <div className="flex items-center justify-between mb-2">
                    {statusOrder.map((s, i) => {
                      const Icon = statusConfig[s].icon;
                      const done = i <= currentStep;
                      const active = i === currentStep && currentStatus !== "cancelled";
                      return (
                        <div key={s} className="flex flex-col items-center flex-1 relative">
                          {i > 0 && (
                            <div className={`absolute end-1/2 top-5 h-1 w-full ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
                          )}
                          <motion.div
                            initial={false}
                            animate={{ scale: active ? 1.15 : 1 }}
                            className={`relative size-10 rounded-full flex items-center justify-center z-10 ${
                              done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            } ${active ? "ring-4 ring-primary/20" : ""}`}
                          >
                            <Icon className="size-5" />
                            {active && (
                              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
                            )}
                          </motion.div>
                          <span className={`text-[10px] mt-1.5 text-center font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>
                            {(t.track as any)[`status${s.charAt(0).toUpperCase() + s.slice(1)}`] || s}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Time + info grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Timer className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.track.elapsedTime}</p>
                      <p className="font-bold text-lg">{order.elapsedMin} {t.track.minutes}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t.track.estimatedReady}</p>
                      <p className="font-bold text-lg">{order.estimatedRemainingMin} {t.track.minutes}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Order info */}
              <Card>
                <CardContent className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t.track.orderType}</p>
                      <Badge variant="secondary" className="gap-1">
                        {order.type === "dine_in" && <Utensils className="size-3" />}
                        {order.type === "takeout" && <ShoppingBag className="size-3" />}
                        {order.type === "delivery" && <Truck className="size-3" />}
                        {(t.track as any)[order.type] || order.type}
                      </Badge>
                    </div>
                    {order.table && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{t.track.table}</p>
                        <p className="font-semibold">#{order.table.number}</p>
                      </div>
                    )}
                    {order.serverName && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">{t.track.server}</p>
                        <p className="font-semibold">{order.serverName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">{t.track.liveUpdate}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                        {t.track.connected}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    {t.track.timeline}
                  </h3>
                  <div className="space-y-4">
                    {order.timeline.map((event: any, i: number) => {
                      const Icon = statusConfig[event.status]?.icon || Circle;
                      return (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`size-8 rounded-full flex items-center justify-center ${statusConfig[event.status]?.bg || "bg-muted"}`}>
                              <Icon className="size-4 text-white" />
                            </div>
                            {i < order.timeline.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="font-semibold text-sm">{event.label}</p>
                            {event.time && <p className="text-xs text-muted-foreground">{fmtTime(event.time)} · {fmtRelative(event.time)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Order items */}
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold mb-3">{t.track.orderItems}</h3>
                  <div className="space-y-2">
                    {order.items.map((it: any) => (
                      <div key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40">
                        <div className="size-12 rounded-lg overflow-hidden bg-accent shrink-0">
                          {it.menuItem?.image ? (
                            <img src={it.menuItem.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{it.quantity}×</span>
                            <span className="text-sm truncate">{isRTL ? it.menuItem?.nameAr : it.menuItem?.nameEn}</span>
                          </div>
                          {it.notes && <p className="text-[11px] text-muted-foreground">📝 {it.notes}</p>}
                        </div>
                        <span className="text-sm font-medium shrink-0">{fmtCurrency(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{isRTL ? "المجموع الفرعي" : "Subtotal"}</span><span>{fmtCurrency(order.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{isRTL ? "الضريبة" : "Tax"}</span><span>{fmtCurrency(order.taxAmount)}</span></div>
                    <div className="flex justify-between font-bold text-base pt-1"><span>{isRTL ? "الإجمالي" : "Total"}</span><span className="text-primary">{fmtCurrency(order.total)}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Receipt actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => downloadReceipt(order)}>
                  <Download className="size-4" />
                  {isRTL ? "تحميل الإيصال" : "Download Receipt"}
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => printReceipt(order)}>
                  <Printer className="size-4" />
                  {isRTL ? "طباعة" : "Print"}
                </Button>
              </div>

              {/* Cancel order (only if not yet preparing/ready/completed) */}
              {order && ["confirmed", "pending"].includes(order.status) && (
                <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={cancelOrder}>
                  <XCircle className="size-4" />
                  {isRTL ? "إلغاء الطلب" : "Cancel Order"}
                </Button>
              )}

              {/* Status messages */}
              {currentStatus === "preparing" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <ChefHat className="size-4 text-amber-500 animate-pulse" />
                    {t.track.preparingYourOrder}
                  </p>
                </motion.div>
              )}
              {currentStatus === "ready" && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
                  <p className="text-lg font-bold text-green-600 flex items-center justify-center gap-2">
                    <Bell className="size-5" />
                    {t.track.readyForPickup}
                  </p>
                </motion.div>
              )}
              {currentStatus === "completed" && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
                  <p className="text-lg font-bold text-emerald-600 flex items-center justify-center gap-2">
                    <CheckCircle className="size-5" />
                    {t.track.enjoyYourMeal}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
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
