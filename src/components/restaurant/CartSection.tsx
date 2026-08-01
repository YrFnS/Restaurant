"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, cartSubtotal } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function CartSection() {
  const { t, isRTL, fmtCurrency } = useI18n();
  const {
    cart,
    updateCartQty,
    removeFromCart,
    clearCart,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    deliveryAddress,
    setDeliveryAddress,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    promoCode,
    promoDiscount,
    setPromo,
    clearPromo,
    tipPercent,
    tipCustom,
    setTip,
    orderNotes,
    setOrderNotes,
    setActiveSection,
    rememberOrderAccess,
  } = useRestaurantStore();

  const [promoInput, setPromoInput] = useState("");
  const [placing, setPlacing] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const settings = settingsData?.settings;
  const taxRate = settings?.taxRate ?? 0;
  const deliveryFeeSetting = settings?.deliveryFee ?? 0;
  const minDeliveryOrder = settings?.minDeliveryOrder ?? 0;
  const configuredTipPresets = settings?.tipPresets
    ? settings.tipPresets.split(",").map(Number)
    : [0, 10, 15, 20];
  const tipPresets = Array.from(
    new Set(
      [0, ...configuredTipPresets].filter(
        (value) => Number.isFinite(value) && value >= 0 && value <= 100
      )
    )
  ).slice(0, 4);

  const orderPayload = useMemo(
    () => ({
      type: orderType,
      customerName: customerName || "",
      customerPhone,
      deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
      tableNumber: orderType === "dine_in" ? tableNumber : undefined,
      notes: orderNotes || null,
      promoCode: promoCode || null,
      tip:
        tipPercent > 0
          ? { mode: "percent" as const, value: tipPercent }
          : tipCustom > 0
            ? { mode: "amount" as const, value: tipCustom }
            : { mode: "none" as const },
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierOptionIds: item.modifiers.map((modifier) => modifier.id),
        notes: item.notes || null,
        course: item.course,
      })),
    }),
    [
      cart,
      customerName,
      customerPhone,
      deliveryAddress,
      orderNotes,
      orderType,
      promoCode,
      tableNumber,
      tipCustom,
      tipPercent,
    ]
  );
  const orderFingerprint = useMemo(
    () => JSON.stringify(orderPayload),
    [orderPayload]
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [orderFingerprint]);

  const quoteReady =
    cart.length > 0 &&
    (orderType !== "dine_in" || Boolean(tableNumber)) &&
    (orderType !== "delivery" ||
      (Boolean(deliveryAddress) && Boolean(customerPhone)));
  const quoteQuery = useQuery({
    queryKey: ["order-quote", orderFingerprint],
    enabled: quoteReady,
    retry: false,
    staleTime: 5_000,
    queryFn: async () => {
      const response = await fetch("/api/orders/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || t.common.error);
      }
      return data;
    },
  });
  const quote = quoteQuery.data?.quote;

  const estimatedSubtotal = cartSubtotal(cart);
  const estimatedDiscount = (estimatedSubtotal * promoDiscount) / 100;
  const discountedSubtotal = Math.max(
    0,
    estimatedSubtotal - estimatedDiscount
  );
  const estimatedTax = discountedSubtotal * taxRate;
  const estimatedDeliveryFee =
    orderType === "delivery" ? deliveryFeeSetting : 0;
  const estimatedTip =
    tipPercent > 0
      ? (discountedSubtotal * tipPercent) / 100
      : tipCustom;
  const estimatedTotal =
    discountedSubtotal +
    estimatedTax +
    estimatedDeliveryFee +
    estimatedTip;

  const subtotal = quote?.subtotal ?? estimatedSubtotal;
  const discount = quote?.discountAmount ?? estimatedDiscount;
  const tax = quote?.taxAmount ?? estimatedTax;
  const deliveryFee = quote?.deliveryFee ?? estimatedDeliveryFee;
  const tipAmount = quote?.tipAmount ?? estimatedTip;
  const total = quote?.total ?? estimatedTotal;
  const effectiveMinimumDelivery =
    quote?.minimumDeliveryOrder ?? minDeliveryOrder;
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const applyPromo = async () => {
    if (!promoInput) return;
    try {
      const response = await fetch(
        `/api/promo?code=${encodeURIComponent(promoInput.trim().toUpperCase())}`
      );
      const data = await response.json().catch(() => null);
      if (response.ok && data?.valid) {
        setPromo(data.code, data.discount);
        toast.success(t.cart.promoApplied);
      } else {
        toast.error(t.cart.promoInvalid);
      }
    } catch {
      toast.error(t.common.error);
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (
      orderType === "delivery" &&
      estimatedSubtotal < effectiveMinimumDelivery
    ) {
      toast.error(
        t.cart.minOrderNotMet.replace(
          "{amount}",
          fmtCurrency(effectiveMinimumDelivery)
        )
      );
      return;
    }
    if (orderType === "dine_in" && !tableNumber) {
      toast.error(t.cart.selectTable);
      return;
    }
    if (orderType === "delivery" && !deliveryAddress) {
      toast.error(t.cart.deliveryAddress);
      return;
    }
    if (orderType === "delivery" && !customerPhone) {
      toast.error(t.cart.customerPhone);
      return;
    }

    setPlacing(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(orderPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order || !data?.accessToken) {
        toast.error(data?.error || t.common.error);
        return;
      }

      const { order, accessToken } = data;
      rememberOrderAccess(order.orderNumber, accessToken);
      toast.success(`${t.cart.orderPlaced} ${order.orderNumber}`);
      clearCart();
      idempotencyKeyRef.current = null;

      const orderNumber = order.orderNumber.replace(/^#/, "");
      window.location.assign(
        `/track/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(
          accessToken
        )}`
      );
    } catch {
      toast.error(t.common.error);
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="size-24 rounded-full bg-accent flex items-center justify-center text-5xl mb-4">
          🛒
        </div>
        <h2 className="text-xl font-bold mb-2">{t.cart.empty}</h2>
        <p className="text-muted-foreground mb-4">{t.cart.emptyDesc}</p>
        <Button onClick={() => setActiveSection("menu")}>
          {t.cart.browseMenu}
        </Button>
      </div>
    );
  }

  const orderTypes = [
    { id: "dine_in" as const, icon: "🍽️", label: t.cart.dineIn },
    { id: "takeout" as const, icon: "🥡", label: t.cart.takeout },
    { id: "delivery" as const, icon: "🛵", label: t.cart.delivery },
  ];

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveSection("menu")}
        >
          <Arrow className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="size-6 text-primary" />
          {t.cart.title}
        </h1>
        <Badge variant="secondary" className="ms-auto">
          {cart.reduce((sum, item) => sum + item.quantity, 0)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                {t.cart.orderType}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {orderTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setOrderType(type.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      orderType === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="text-xl mb-1">{type.icon}</div>
                    <div className="text-xs font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
              {orderType === "dine_in" && (
                <Input
                  inputMode="numeric"
                  placeholder={t.cart.tableNumber}
                  value={tableNumber}
                  onChange={(event) =>
                    setTableNumber(event.target.value.replace(/\D/g, ""))
                  }
                  className="mt-3"
                />
              )}
              {orderType === "delivery" && (
                <Input
                  placeholder={t.cart.addressPlaceholder}
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  dir="auto"
                  className="mt-3"
                />
              )}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Input
                  placeholder={t.cart.customerName}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  dir="auto"
                />
                <Input
                  placeholder={t.cart.customerPhone}
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-xl bg-accent/40"
                >
                  <div className="size-14 rounded-lg bg-background flex items-center justify-center text-2xl shrink-0">
                    🍽️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm">
                        {isRTL ? item.nameAr : item.nameEn}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        aria-label={isRTL ? "حذف الصنف" : "Remove item"}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {item.modifiers.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {item.modifiers
                          .map((modifier) =>
                            isRTL ? modifier.nameAr : modifier.nameEn
                          )
                          .join(", ")}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-muted-foreground italic">
                        📝 {item.notes}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 border rounded-full p-0.5 bg-background">
                        <button
                          onClick={() =>
                            updateCartQty(item.id, item.quantity - 1)
                          }
                          aria-label={isRTL ? "تقليل الكمية" : "Decrease quantity"}
                          className="size-6 rounded-full hover:bg-accent flex items-center justify-center"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateCartQty(item.id, item.quantity + 1)
                          }
                          aria-label={isRTL ? "زيادة الكمية" : "Increase quantity"}
                          className="size-6 rounded-full hover:bg-accent flex items-center justify-center"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span className="font-bold text-primary text-sm">
                        {fmtCurrency(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <textarea
                placeholder={t.cart.notesPlaceholder}
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                rows={2}
                dir="auto"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{t.cart.title}</h3>
                {quote && (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    {isRTL ? "محسوب من الخادم" : "Server verified"}
                  </span>
                )}
              </div>

              {promoCode ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                  <Tag className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {promoCode}
                  </span>
                  <span className="text-xs text-green-600">
                    -{quote?.promoDiscountPercent ?? promoDiscount}%
                  </span>
                  <button
                    onClick={() => {
                      clearPromo();
                      setPromoInput("");
                    }}
                    aria-label={isRTL ? "إزالة الرمز" : "Remove promo code"}
                    className="ms-auto"
                  >
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder={t.cart.promoCode}
                    value={promoInput}
                    onChange={(event) =>
                      setPromoInput(event.target.value.toUpperCase())
                    }
                    className="uppercase"
                  />
                  <Button variant="outline" size="sm" onClick={applyPromo}>
                    {t.cart.applyPromo}
                  </Button>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                  {t.cart.addTip}
                </label>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${tipPresets.length}, minmax(0, 1fr))` }}
                >
                  {tipPresets.map((percent) => (
                    <button
                      key={percent}
                      onClick={() => setTip(percent)}
                      className={`py-2 rounded-lg text-xs font-medium ${
                        tipPercent === percent
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent"
                      }`}
                    >
                      {percent === 0 ? t.cart.noTip : `${percent}%`}
                    </button>
                  ))}
                </div>
              </div>

              {quote?.activePricingRules?.length > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                  <span className="font-medium">
                    {isRTL ? "تسعير نشط:" : "Active pricing:"}
                  </span>{" "}
                  {quote.activePricingRules
                    .map((rule: { nameEn: string; nameAr: string }) =>
                      isRTL ? rule.nameAr : rule.nameEn
                    )
                    .join(", ")}
                </div>
              )}

              <div className="space-y-1 text-sm pt-2 border-t border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.cart.subtotal}</span>
                  <span>{fmtCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t.cart.discount}</span>
                    <span>-{fmtCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.cart.tax}</span>
                  <span>{fmtCurrency(tax)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t.cart.deliveryFee}
                    </span>
                    <span>{fmtCurrency(deliveryFee)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.cart.tip}</span>
                    <span>{fmtCurrency(tipAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span>{t.cart.total}</span>
                  <span className="text-primary">{fmtCurrency(total)}</span>
                </div>
              </div>

              {quoteReady && quoteQuery.isError && (
                <p className="text-xs text-destructive">
                  {quoteQuery.error instanceof Error
                    ? quoteQuery.error.message
                    : t.common.error}
                </p>
              )}

              <Button
                onClick={placeOrder}
                disabled={placing}
                className="w-full h-12"
              >
                {placing
                  ? "..."
                  : `${t.cart.placeOrder} · ${fmtCurrency(total)}`}
              </Button>
              <Button
                variant="ghost"
                onClick={clearCart}
                className="w-full text-destructive text-xs"
              >
                {t.cart.clearCart}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
