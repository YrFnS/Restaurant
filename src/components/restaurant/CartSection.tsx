"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, cartSubtotal } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

export function CartSection() {
  const { t, isRTL, fmtCurrency } = useI18n();
  const {
    cart, updateCartQty, removeFromCart, clearCart,
    orderType, setOrderType, tableNumber, setTableNumber,
    deliveryAddress, setDeliveryAddress, customerName, setCustomerName,
    customerPhone, setCustomerPhone, promoCode, promoDiscount,
    setPromo, clearPromo, tipPercent, tipCustom, setTip,
    orderNotes, setOrderNotes, setActiveSection,
  } = useRestaurantStore();

  const [promoInput, setPromoInput] = useState("");
  const [placing, setPlacing] = useState(false);

  // Fetch settings for tax rate, delivery fee, min order, prep time, tip presets
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const s = settingsData?.settings;
  const taxRate = s?.taxRate ?? 0.1;
  const deliveryFeeSetting = s?.deliveryFee ?? 4.99;
  const minDeliveryOrder = s?.minDeliveryOrder ?? 15;
  const avgPrepMin = s?.avgPrepTimeMin ?? 25;
  const tipPresets = s?.tipPresets ? s.tipPresets.split(",").map(Number) : [0, 15, 18, 20];

  const subtotal = cartSubtotal(cart);
  const tax = subtotal * taxRate;
  const discount = (subtotal * promoDiscount) / 100;
  const deliveryFee = orderType === "delivery" ? deliveryFeeSetting : 0;
  const tipAmount = tipPercent > 0 ? (subtotal * tipPercent) / 100 : tipCustom;
  const total = subtotal + tax + deliveryFee - discount + tipAmount;
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const applyPromo = async () => {
    if (!promoInput) return;
    const r = await fetch(`/api/promo?code=${encodeURIComponent(promoInput)}`);
    const data = await r.json();
    if (data.valid) {
      setPromo(data.code, data.discount);
      toast.success(t.cart.promoApplied);
    } else {
      toast.error(t.cart.promoInvalid);
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === "delivery" && subtotal < minDeliveryOrder) {
      toast.error(t.cart.minOrderNotMet.replace("{amount}", fmtCurrency(minDeliveryOrder)));
      return;
    }
    if (orderType === "dine_in" && !tableNumber) { toast.error(t.cart.selectTable); return; }
    if (orderType === "delivery" && !deliveryAddress) { toast.error(t.cart.deliveryAddress); return; }
    setPlacing(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType, customerName: customerName || "Guest", customerPhone,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
          notes: orderNotes, subtotal, taxAmount: tax, deliveryFee,
          discountAmount: discount, tipAmount, total,
          paymentMethod: "cash", paymentStatus: "unpaid",
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, unitPrice: c.price, modifiers: c.modifiers, notes: c.notes, totalPrice: c.totalPrice, course: c.course })),
          estimatedReady: new Date(Date.now() + avgPrepMin * 60 * 1000),
        }),
      });
      if (r.ok) {
        const { order } = await r.json();
        toast.success(`${t.cart.orderPlaced} ${order.orderNumber}`);
        clearCart();
        // redirect to live order tracking page
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = `/track/${order.orderNumber.replace(/^#/, "")}`;
      }
    } catch { toast.error(t.common.error); }
    finally { setPlacing(false); }
  };

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="size-24 rounded-full bg-accent flex items-center justify-center text-5xl mb-4">🛒</div>
        <h2 className="text-xl font-bold mb-2">{t.cart.empty}</h2>
        <p className="text-muted-foreground mb-4">{t.cart.emptyDesc}</p>
        <Button onClick={() => setActiveSection("menu")}>{t.cart.browseMenu}</Button>
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
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("menu")}>
          <Arrow className="size-5" />
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="size-6 text-primary" />
          {t.cart.title}
        </h1>
        <Badge variant="secondary" className="ms-auto">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items + form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order type */}
          <Card>
            <CardContent className="p-4">
              <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.cart.orderType}</label>
              <div className="grid grid-cols-3 gap-2">
                {orderTypes.map((ot) => (
                  <button key={ot.id} onClick={() => setOrderType(ot.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${orderType === ot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <div className="text-xl mb-1">{ot.icon}</div>
                    <div className="text-xs font-medium">{ot.label}</div>
                  </button>
                ))}
              </div>
              {orderType === "dine_in" && <Input placeholder={t.cart.tableNumber} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="mt-3" />}
              {orderType === "delivery" && <Input placeholder={t.cart.addressPlaceholder} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} dir="auto" className="mt-3" />}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Input placeholder={t.cart.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} dir="auto" />
                <Input placeholder={t.cart.customerPhone} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="p-4 space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-accent/40">
                  <div className="size-14 rounded-lg bg-background flex items-center justify-center text-2xl shrink-0">🍽️</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm">{isRTL ? item.nameAr : item.nameEn}</h4>
                      <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="size-3.5" /></button>
                    </div>
                    {item.modifiers.length > 0 && <p className="text-[11px] text-muted-foreground">{item.modifiers.map((m) => isRTL ? m.nameAr : m.nameEn).join(", ")}</p>}
                    {item.notes && <p className="text-[11px] text-muted-foreground italic">📝 {item.notes}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5 border rounded-full p-0.5 bg-background">
                        <button onClick={() => updateCartQty(item.id, item.quantity - 1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center"><Minus className="size-3" /></button>
                        <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, item.quantity + 1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center"><Plus className="size-3" /></button>
                      </div>
                      <span className="font-bold text-primary text-sm">{fmtCurrency(item.totalPrice)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <textarea placeholder={t.cart.notesPlaceholder} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows={2} dir="auto" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
            </CardContent>
          </Card>
        </div>

        {/* Right: summary */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-bold">{t.cart.title}</h3>
              {/* Promo */}
              {promoCode ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                  <Tag className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">{promoCode}</span>
                  <span className="text-xs text-green-600">-{promoDiscount}%</span>
                  <button onClick={() => { clearPromo(); setPromoInput(""); }} className="ms-auto"><X className="size-4 text-muted-foreground" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input placeholder={t.cart.promoCode} value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} className="uppercase" />
                  <Button variant="outline" size="sm" onClick={applyPromo}>{t.cart.applyPromo}</Button>
                </div>
              )}
              {/* Tip */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.cart.addTip}</label>
                <div className="grid grid-cols-4 gap-2">
                  {tipPresets.map((p) => (
                    <button key={p} onClick={() => setTip(p)} className={`py-2 rounded-lg text-xs font-medium ${tipPercent === p && p !== 0 ? "bg-primary text-primary-foreground" : "bg-accent"}`}>{p === 0 ? t.cart.noTip : `${p}%`}</button>
                  ))}
                </div>
              </div>
              {/* Totals */}
              <div className="space-y-1 text-sm pt-2 border-t border-border">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.subtotal}</span><span>{fmtCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tax}</span><span>{fmtCurrency(tax)}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.deliveryFee}</span><span>{fmtCurrency(deliveryFee)}</span></div>}
                {discount > 0 && <div className="flex justify-between text-green-600"><span>{t.cart.discount}</span><span>-{fmtCurrency(discount)}</span></div>}
                {tipAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tip}</span><span>{fmtCurrency(tipAmount)}</span></div>}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>{t.cart.total}</span><span className="text-primary">{fmtCurrency(total)}</span></div>
              </div>
              <Button onClick={placeOrder} disabled={placing} className="w-full h-12">
                {placing ? "..." : `${t.cart.placeOrder} · ${fmtCurrency(total)}`}
              </Button>
              <Button variant="ghost" onClick={clearCart} className="w-full text-destructive text-xs">{t.cart.clearCart}</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
