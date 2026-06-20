"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { ClipboardList, Clock, MapPin, Phone, User, ArrowLeft, ArrowRight, RotateCcw, MapPinned } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function OrdersSection() {
  const { t, isRTL, fmtCurrency, fmtDate, fmtTime, fmtRelative } = useI18n();
  const { customerPhone, setActiveSection } = useRestaurantStore();
  const [phone, setPhone] = useState(customerPhone || "");
  const [searched, setSearched] = useState(!!customerPhone);
  const [detail, setDetail] = useState<any>(null);
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders", phone],
    queryFn: async () => {
      const r = await fetch(`/api/orders?phone=${encodeURIComponent(phone)}&limit=20`);
      return r.json();
    },
    enabled: searched && !!phone,
  });
  const orders: any[] = data?.orders || [];

  const reorder = async (order: any) => {
    // create a new order with same items
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: order.type, customerName: order.customerName, customerPhone: order.customerPhone,
          subtotal: order.subtotal, taxAmount: order.taxAmount, total: order.total,
          paymentMethod: order.paymentMethod, paymentStatus: "unpaid",
          items: order.items.map((it: any) => ({ menuItemId: it.menuItemId, quantity: it.quantity, unitPrice: it.unitPrice, modifiers: JSON.parse(it.modifiers || "[]"), notes: it.notes, totalPrice: it.totalPrice })),
          estimatedReady: new Date(Date.now() + 25 * 60 * 1000),
        }),
      });
      if (r.ok) {
        const { order: newOrder } = await r.json();
        toast.success(`${t.cart.orderPlaced} ${newOrder.orderNumber}`);
        refetch();
      }
    } catch { toast.error(t.common.error); }
  };

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}>
          <Arrow className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="size-6 text-primary" />
          {t.orders.title}
        </h1>
      </div>

      {/* Phone search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.cart.customerPhone}</label>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.cart.customerPhone}
              dir="ltr"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && setSearched(true)}
            />
            <Button onClick={() => setSearched(true)}>{t.rewards.lookup}</Button>
          </div>
        </CardContent>
      </Card>

      {searched && isLoading && <p className="text-center text-muted-foreground py-8">{t.common.loading}</p>}

      {searched && !isLoading && orders.length === 0 && (
        <div className="text-center py-16">
          <div className="size-20 rounded-full bg-accent flex items-center justify-center text-4xl mb-4">📋</div>
          <h3 className="font-bold text-lg mb-1">{t.orders.noOrders}</h3>
          <p className="text-muted-foreground mb-4">{t.orders.noOrdersDesc}</p>
          <Button onClick={() => setActiveSection("menu")}>{t.cart.browseMenu}</Button>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetail(order)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{order.orderNumber}</span>
                      <Badge className={statusColors[order.status] || ""}>
                        {(t.orders as any)[order.status] || order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtRelative(order.createdAt)} · {fmtDate(order.createdAt)} {fmtTime(order.createdAt)}</p>
                  </div>
                  <span className="text-xl font-bold text-primary">{fmtCurrency(order.total)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                  <span className="flex items-center gap-1"><span>{(t.orders as any)[order.type] || order.type}</span></span>
                  {order.table && <span className="flex items-center gap-1"><MapPin className="size-3" />{t.orders.table} {order.table.number}</span>}
                  <span>{order.items.length} {t.orders.items}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDetail(order); }} className="flex-1">{t.orders.viewDetails}</Button>
                  <Link href={`/track/${order.orderNumber.replace(/^#/, "")}`} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="default" className="gap-1.5">
                      <MapPinned className="size-3.5" />{t.orders.trackOrder}
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); reorder(order); }} className="gap-1.5">
                    <RotateCcw className="size-3.5" />{t.orders.reorder}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Order detail */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.orderNumber}
                  <Badge className={statusColors[detail.status] || ""}>{(t.orders as any)[detail.status] || detail.status}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" />{fmtDate(detail.createdAt)} {fmtTime(detail.createdAt)}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="size-4" />{detail.customerName}</div>
                  {detail.customerPhone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="size-4" /><span dir="ltr">{detail.customerPhone}</span></div>}
                  {detail.table && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" />{t.orders.table} {detail.table.number}</div>}
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t.orders.orderItems}</h4>
                  <div className="space-y-2">
                    {detail.items.map((it: any) => (
                      <div key={it.id} className="flex justify-between gap-2 p-2 rounded-lg bg-accent/40">
                        <div className="flex-1">
                          <span className="font-medium text-sm">{it.quantity}× {isRTL ? it.menuItem.nameAr : it.menuItem.nameEn}</span>
                          {it.notes && <p className="text-[11px] text-muted-foreground">📝 {it.notes}</p>}
                        </div>
                        <span className="text-sm font-medium">{fmtCurrency(it.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 text-sm pt-2 border-t border-border">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.subtotal}</span><span>{fmtCurrency(detail.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tax}</span><span>{fmtCurrency(detail.taxAmount)}</span></div>
                  {detail.deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.deliveryFee}</span><span>{fmtCurrency(detail.deliveryFee)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>{t.cart.total}</span><span className="text-primary">{fmtCurrency(detail.total)}</span></div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
