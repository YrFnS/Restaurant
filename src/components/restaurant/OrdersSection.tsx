"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartModifier } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Clock,
  MapPin,
  MapPinned,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function parseModifiers(value: string): CartModifier[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (modifier) =>
          modifier &&
          typeof modifier.id === "string" &&
          typeof modifier.nameEn === "string" &&
          typeof modifier.nameAr === "string" &&
          typeof modifier.price === "number"
      )
      .map((modifier) => ({
        id: modifier.id,
        nameEn: modifier.nameEn,
        nameAr: modifier.nameAr,
        price: modifier.price,
        preset:
          typeof modifier.preset === "string" ? modifier.preset : undefined,
      }));
  } catch {
    return [];
  }
}

export function OrdersSection() {
  const { t, isRTL, fmtCurrency, fmtDate, fmtTime, fmtRelative } = useI18n();
  const {
    recentOrders,
    forgetOrderAccess,
    clearCart,
    addToCart,
    setOrderType,
    setActiveSection,
  } = useRestaurantStore();
  const [detail, setDetail] = useState<any>(null);
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const credentialsFingerprint = useMemo(
    () => JSON.stringify(recentOrders),
    [recentOrders]
  );
  const ordersQuery = useQuery({
    queryKey: ["recent-customer-orders", credentialsFingerprint],
    enabled: recentOrders.length > 0,
    retry: false,
    refetchInterval: 15_000,
    queryFn: async () => {
      const response = await fetch("/api/orders/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: recentOrders }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || t.common.error);
      }
      return data;
    },
  });
  const orders: any[] = ordersQuery.data?.orders || [];

  const tokenFor = (orderNumber: string) =>
    recentOrders.find(
      (recent) =>
        recent.orderNumber.replace(/^#/, "") === orderNumber.replace(/^#/, "")
    )?.accessToken || "";

  const reorder = (order: any) => {
    const availableItems = order.items.filter(
      (item: any) => item.menuItem?.isAvailable
    );
    if (availableItems.length === 0) {
      toast.error(
        isRTL
          ? "أصناف هذا الطلب لم تعد متاحة"
          : "The items in this order are no longer available"
      );
      return;
    }

    clearCart();
    availableItems.forEach((item: any, index: number) => {
      const modifiers = parseModifiers(item.modifiers || "[]");
      addToCart({
        id: `${item.menuItemId}_${Date.now()}_${index}`,
        menuItemId: item.menuItemId,
        nameEn: item.menuItem.nameEn,
        nameAr: item.menuItem.nameAr,
        price: item.unitPrice,
        basePrice: item.menuItem.price,
        quantity: item.quantity,
        image: item.menuItem.image || "",
        modifiers,
        notes: item.notes || "",
        course: item.course || 1,
        totalPrice: item.unitPrice * item.quantity,
      });
    });
    setOrderType(order.type);
    setActiveSection("cart");
    toast.success(isRTL ? "تمت إضافة الطلب إلى السلة" : "Order added to cart");
  };

  const removeFromHistory = (orderNumber: string) => {
    forgetOrderAccess(orderNumber);
    if (detail?.orderNumber === orderNumber) setDetail(null);
  };

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveSection("home")}
        >
          <Arrow className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="size-6 text-primary" />
          {t.orders.title}
        </h1>
      </div>

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {isRTL
            ? "تظهر هنا الطلبات التي تم إنشاؤها على هذا الجهاز أو التي فتحت رابط تأكيدها الآمن. لا نعرض الطلبات بالبحث عن رقم الهاتف لحماية خصوصيتك."
            : "This page shows orders created on this device or opened through their secure confirmation links. Phone-number lookup is disabled to protect customer privacy."}
        </CardContent>
      </Card>

      {recentOrders.length > 0 && ordersQuery.isLoading && (
        <p className="text-center text-muted-foreground py-8">
          {t.common.loading}
        </p>
      )}

      {ordersQuery.isError && (
        <Card className="mb-4">
          <CardContent className="p-4 text-sm text-destructive">
            {ordersQuery.error instanceof Error
              ? ordersQuery.error.message
              : t.common.error}
          </CardContent>
        </Card>
      )}

      {!ordersQuery.isLoading && orders.length === 0 && (
        <div className="text-center py-16">
          <div className="size-20 rounded-full bg-accent flex items-center justify-center text-4xl mb-4 mx-auto">
            📋
          </div>
          <h3 className="font-bold text-lg mb-1">{t.orders.noOrders}</h3>
          <p className="text-muted-foreground mb-4">
            {isRTL
              ? "أنشئ طلباً أو افتح رابط تأكيد طلب سابق على هذا الجهاز."
              : "Place an order or open a previous secure confirmation link on this device."}
          </p>
          <Button onClick={() => setActiveSection("menu")}>
            {t.cart.browseMenu}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order, index) => {
          const accessToken = tokenFor(order.orderNumber);
          const trackingHref = `/track/${encodeURIComponent(
            order.orderNumber.replace(/^#/, "")
          )}?token=${encodeURIComponent(accessToken)}`;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setDetail(order)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">
                          {order.orderNumber}
                        </span>
                        <Badge className={statusColors[order.status] || ""}>
                          {(t.orders as any)[order.status] || order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtRelative(order.createdAt)} · {fmtDate(order.createdAt)}{" "}
                        {fmtTime(order.createdAt)}
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      {fmtCurrency(order.total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                    <span>{(t.orders as any)[order.type] || order.type}</span>
                    {order.table && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {t.orders.table} {order.table.number}
                      </span>
                    )}
                    <span>
                      {order.items.length} {t.orders.items}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail(order);
                      }}
                      className="flex-1"
                    >
                      {t.orders.viewDetails}
                    </Button>
                    <Link href={trackingHref} onClick={(event) => event.stopPropagation()}>
                      <Button size="sm" className="gap-1.5">
                        <MapPinned className="size-3.5" />
                        {t.orders.trackOrder}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        reorder(order);
                      }}
                      className="gap-1.5"
                    >
                      <RotateCcw className="size-3.5" />
                      {t.orders.reorder}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={isRTL ? "إزالة من السجل" : "Remove from history"}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFromHistory(order.orderNumber);
                      }}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className="w-full sm:max-w-md overflow-y-auto"
        >
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.orderNumber}
                  <Badge className={statusColors[detail.status] || ""}>
                    {(t.orders as any)[detail.status] || detail.status}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" />
                    {fmtDate(detail.createdAt)} {fmtTime(detail.createdAt)}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-4" />
                    {detail.customerName}
                  </div>
                  {detail.table && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4" />
                      {t.orders.table} {detail.table.number}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-2">{t.orders.orderItems}</h4>
                  <div className="space-y-2">
                    {detail.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-2 p-2 rounded-lg bg-accent/40"
                      >
                        <div className="flex-1">
                          <span className="font-medium text-sm">
                            {item.quantity}×{" "}
                            {isRTL
                              ? item.menuItem.nameAr
                              : item.menuItem.nameEn}
                          </span>
                          {item.notes && (
                            <p className="text-[11px] text-muted-foreground">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {fmtCurrency(item.totalPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 text-sm pt-2 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.cart.subtotal}
                    </span>
                    <span>{fmtCurrency(detail.subtotal)}</span>
                  </div>
                  {detail.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t.cart.discount}</span>
                      <span>-{fmtCurrency(detail.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.cart.tax}</span>
                    <span>{fmtCurrency(detail.taxAmount)}</span>
                  </div>
                  {detail.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t.cart.deliveryFee}
                      </span>
                      <span>{fmtCurrency(detail.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                    <span>{t.cart.total}</span>
                    <span className="text-primary">
                      {fmtCurrency(detail.total)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
