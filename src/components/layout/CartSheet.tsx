"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, cartSubtotal, type CartItem } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Gift, Sparkles } from "lucide-react";
import { useState } from "react";

export function CartSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<any>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [loyaltyLooking, setLoyaltyLooking] = useState(false);

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
  const loyaltyDisc = loyaltyDiscount;
  const deliveryFee = orderType === "delivery" ? deliveryFeeSetting : 0;
  const tipAmount = tipPercent > 0 ? (subtotal * tipPercent) / 100 : tipCustom;
  const total = Math.max(0, subtotal + tax + deliveryFee - discount - loyaltyDisc + tipAmount);

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

  const lookupLoyalty = async () => {
    if (!customerPhone) {
      toast.error(isRTL ? "أدخل رقم الهاتف أولاً" : "Enter phone number first");
      return;
    }
    setLoyaltyLooking(true);
    try {
      const r = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(customerPhone)}`);
      const data = await r.json();
      if (data.customer) {
        setLoyaltyCustomer(data.customer);
        toast.success(`${isRTL ? "أهلاً" : "Welcome"} ${data.customer.name} · ${data.customer.loyaltyPoints} ${isRTL ? "نقطة" : "pts"}`);
      } else {
        toast.error(isRTL ? "العميل غير موجود" : "Customer not found");
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoyaltyLooking(false);
    }
  };

  const redeemPoints = async (points: number, value: number) => {
    try {
      const r = await fetch("/api/customers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customerPhone, pointsToRedeem: points }),
      });
      const data = await r.json();
      if (r.ok) {
        setLoyaltyCustomer(data.customer);
        setLoyaltyDiscount(value);
        setLoyaltyPointsUsed(points);
        toast.success(`${isRTL ? "تم استبدال" : "Redeemed"} ${points} ${isRTL ? "نقطة" : "pts"} → ${fmtCurrency(value)}`);
      } else {
        toast.error(data.error || t.common.error);
      }
    } catch {
      toast.error(t.common.error);
    }
  };

  const clearLoyalty = () => {
    setLoyaltyDiscount(0);
    setLoyaltyPointsUsed(0);
    // Note: points are already deducted server-side; this just clears the UI discount
  };

  const placeOrder = async () => {
    if (orderType === "delivery" && subtotal < minDeliveryOrder) {
      toast.error(t.cart.minOrderNotMet.replace("{amount}", fmtCurrency(minDeliveryOrder)));
      return;
    }
    if (orderType === "delivery" && !deliveryAddress) {
      toast.error(t.cart.deliveryAddress);
      return;
    }
    if (orderType === "dine_in" && !tableNumber) {
      toast.error(t.cart.selectTable);
      return;
    }
    setPlacing(true);
    try {
      const items = cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        unitPrice: c.price,
        modifiers: c.modifiers,
        notes: c.notes,
        totalPrice: c.totalPrice,
        course: c.course,
        stationSlug: c.stationSlug || "",
      }));
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          customerName: customerName || "Guest",
          customerPhone,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
          notes: orderNotes,
          subtotal,
          taxAmount: tax,
          deliveryFee,
          discountAmount: discount + loyaltyDisc,
          tipAmount,
          total,
          paymentMethod: "cash",
          paymentStatus: "unpaid",
          items,
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          estimatedReady: new Date(Date.now() + avgPrepMin * 60 * 1000),
        }),
      });
      if (r.ok) {
        const { order } = await r.json();
        toast.success(`${t.cart.orderPlaced} ${order.orderNumber}`);
        clearCart();
        onOpenChange(false);
        // redirect to live order tracking page
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = `/track/${order.orderNumber.replace(/^#/, "")}`;
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setPlacing(false);
    }
  };

  const orderTypes = [
    { id: "dine_in" as const, icon: "🍽️", label: t.cart.dineIn },
    { id: "takeout" as const, icon: "🥡", label: t.cart.takeout },
    { id: "delivery" as const, icon: "🛵", label: t.cart.delivery },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            {t.cart.title}
            {cart.length > 0 && <Badge variant="secondary">{cart.reduce((s, i) => s + i.quantity, 0)}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="size-20 rounded-full bg-accent flex items-center justify-center text-4xl mb-4">🛒</div>
            <h3 className="font-semibold text-lg mb-1">{t.cart.empty}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.cart.emptyDesc}</p>
            <Button onClick={() => { onOpenChange(false); setActiveSection("menu"); }}>
              {t.cart.browseMenu}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scroll-thin">
              <div className="p-4 space-y-4">
                {/* Order type */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.cart.orderType}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {orderTypes.map((ot) => (
                      <button
                        key={ot.id}
                        onClick={() => setOrderType(ot.id)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          orderType === ot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="text-xl mb-1">{ot.icon}</div>
                        <div className="text-[11px] font-medium">{ot.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional fields */}
                {orderType === "dine_in" && (
                  <Input placeholder={t.cart.tableNumber} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
                )}
                {orderType === "delivery" && (
                  <Input placeholder={t.cart.addressPlaceholder} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} dir="auto" />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder={t.cart.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} dir="auto" />
                  <Input placeholder={t.cart.customerPhone} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" />
                </div>

                {/* Cart items */}
                <div className="space-y-2">
                  {cart.map((item) => (
                    <CartLine key={item.id} item={item} onUpdate={updateCartQty} onRemove={removeFromCart} />
                  ))}
                </div>

                {/* Notes */}
                <textarea
                  placeholder={t.cart.notesPlaceholder}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                  dir="auto"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />

                {/* Promo */}
                {promoCode ? (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                    <Tag className="size-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{promoCode}</span>
                    <span className="text-xs text-green-600">-{promoDiscount}%</span>
                    <button onClick={() => { clearPromo(); setPromoInput(""); }} className="ms-auto text-muted-foreground hover:text-foreground">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input placeholder={t.cart.promoCode} value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} className="uppercase" />
                    <Button variant="outline" onClick={applyPromo}>{t.cart.applyPromo}</Button>
                  </div>
                )}

                {/* Loyalty rewards */}
                {loyaltyCustomer ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="size-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{loyaltyCustomer.name}</span>
                      <span className="text-xs text-amber-600">· {loyaltyCustomer.loyaltyPoints} {isRTL ? "نقطة" : "pts"}</span>
                      <button onClick={() => { setLoyaltyCustomer(null); clearLoyalty(); }} className="ms-auto text-muted-foreground hover:text-foreground">
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {loyaltyDiscount > 0 ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="size-3 text-amber-600" />
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {isRTL ? `استُبدلت ${loyaltyPointsUsed} نقطة` : `Redeemed ${loyaltyPointsUsed} pts`}
                        </span>
                        <span className="text-amber-600">→ -{fmtCurrency(loyaltyDiscount)}</span>
                        <button onClick={clearLoyalty} className="ms-auto text-muted-foreground hover:text-foreground text-[10px] underline">
                          {isRTL ? "إلغاء" : "clear"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(loyaltyCustomer.redemptionOptions || []).map((r: any) => (
                          <button
                            key={r.points}
                            onClick={() => redeemPoints(r.points, r.value)}
                            className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                          >
                            {r.points} pts → ${r.value}
                          </button>
                        ))}
                        {loyaltyCustomer.loyaltyPoints < 100 && (
                          <span className="text-[11px] text-muted-foreground">
                            {isRTL ? `تحتاج 100 نقطة للاستبدال (لديك ${loyaltyCustomer.loyaltyPoints})` : `Need 100 pts to redeem (have ${loyaltyCustomer.loyaltyPoints})`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={lookupLoyalty}
                    disabled={loyaltyLooking || !customerPhone}
                    className="w-full flex items-center gap-2 p-2 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    <Gift className="size-4" />
                    {loyaltyLooking ? "..." : (isRTL ? "تحقق من نقاط المكافآت" : "Check loyalty points")}
                  </button>
                )}

                {/* Tip */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.cart.addTip}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {tipPresets.map((p) => (
                      <button
                        key={p}
                        onClick={() => setTip(p)}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                          tipPercent === p && p !== 0 ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                        }`}
                      >
                        {p === 0 ? t.cart.noTip : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary + checkout */}
            <SheetFooter className="border-t border-border p-4 space-y-2">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.subtotal}</span><span>{fmtCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tax}</span><span>{fmtCurrency(tax)}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.deliveryFee}</span><span>{fmtCurrency(deliveryFee)}</span></div>}
                {discount > 0 && <div className="flex justify-between text-green-600"><span>{t.cart.discount}</span><span>-{fmtCurrency(discount)}</span></div>}
                {loyaltyDisc > 0 && <div className="flex justify-between text-amber-600"><span className="flex items-center gap-1"><Gift className="size-3" />{isRTL ? "مكافآت" : "Loyalty"}</span><span>-{fmtCurrency(loyaltyDisc)}</span></div>}
                {tipAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tip}</span><span>{fmtCurrency(tipAmount)}</span></div>}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>{t.cart.total}</span><span className="text-primary">{fmtCurrency(total)}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { clearCart(); toast.success(t.cart.clearCart); }} className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
                <Button onClick={placeOrder} disabled={placing} className="flex-1 h-12">
                  {placing ? "..." : `${t.cart.placeOrder} · ${fmtCurrency(total)}`}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartLine({ item, onUpdate, onRemove }: { item: CartItem; onUpdate: (id: string, q: number) => void; onRemove: (id: string) => void }) {
  const { t, isRTL, fmtCurrency } = useI18n();
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-accent/50">
      <div className="size-14 rounded-lg bg-background overflow-hidden shrink-0">
        {item.image ? (
          <img src={item.image} alt={isRTL ? item.nameAr : item.nameEn} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight">{isRTL ? item.nameAr : item.nameEn}</h4>
          <button onClick={() => onRemove(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
            <Trash2 className="size-3.5" />
          </button>
        </div>
        {item.modifiers.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {item.modifiers.map((m) => isRTL ? m.nameAr : m.nameEn).join(", ")}
          </p>
        )}
        {item.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5">📝 {item.notes}</p>}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 border rounded-full p-0.5 bg-background">
            <button onClick={() => onUpdate(item.id, item.quantity - 1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center">
              <Minus className="size-3" />
            </button>
            <span className="w-5 text-center text-xs font-semibold">{item.quantity}</span>
            <button onClick={() => onUpdate(item.id, item.quantity + 1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center">
              <Plus className="size-3" />
            </button>
          </div>
          <span className="font-bold text-primary text-sm">{fmtCurrency(item.totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}
