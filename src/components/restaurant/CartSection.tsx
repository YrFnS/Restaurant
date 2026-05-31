"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Clock,
  StickyNote,
  HandCoins,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartItem } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { CartItems } from "@/components/restaurant/cart/CartItems";
import { CartSummary } from "@/components/restaurant/cart/CartSummary";
import { CartPromo } from "@/components/restaurant/cart/CartPromo";
import {
  OrderTypeSelector,
  DeliveryAddressInput,
  ScheduleOrder,
  PaymentMethodSection,
  PlaceOrderButton,
} from "@/components/restaurant/cart/CartActions";

/* ─── Animation Variants ─── */
const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Empty Cart State ─── */
function EmptyCartState() {
  const { t } = useI18n();
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center"
    >
      {/* Animated empty cart visual */}
      <div className="relative mb-6">
        <div className="size-28 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center">
          <ShoppingBag className="size-14 text-amber-400 dark:text-amber-500" />
        </div>
        {/* Floating food items decoration */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute -top-2 -end-2 size-8 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-sm"
        >
          🍕
        </motion.div>
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.3 }}
          className="absolute -bottom-1 -start-3 size-7 rounded-full bg-orange-200 dark:bg-orange-800/50 flex items-center justify-center text-xs"
        >
          🥗
        </motion.div>
      </div>
      <h3 className="text-xl font-bold mb-2">{t.cart.empty}</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">{t.cart.emptyDesc}</p>
      <Button
        onClick={() => setActiveSection("menu")}
        size="lg"
        className="gap-2"
      >
        <ShoppingBag className="size-4" />
        {t.cart.browseMenu}
      </Button>
    </motion.div>
  );
}

/* ─── Estimated Prep Time ─── */
function EstimatedPrepTime({ cart, basePrepTime }: { cart: CartItem[]; basePrepTime?: number }) {
  const { t } = useI18n();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Estimate prep time: base from settings + ~3 min per item, capped at 60
  const estimatedMinutes = Math.min((basePrepTime ?? 0) + totalItems * 3, 60);

  if (cart.length === 0) return null;

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-amber-500/15 dark:bg-amber-500/25 flex items-center justify-center">
                <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t.cart.estimatedPrepTime}</p>
                <p className="text-xs text-muted-foreground">
                  {t.cart.scheduleOrderDesc}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm font-bold gap-1">
              <Clock className="size-3" />
              {estimatedMinutes} {t.common.minute}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Order Notes ─── */
function OrderNotesSection() {
  const { t } = useI18n();
  const orderNotes = useRestaurantStore((s) => s.orderNotes);
  const setOrderNotes = useRestaurantStore((s) => s.setOrderNotes);

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t.cart.notes}</h3>
          </div>
          <Textarea
            placeholder={t.cart.notesPlaceholder}
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Tip Section ─── */
function TipSection({ settingsTipPresets }: { settingsTipPresets?: string }) {
  const { t } = useI18n();
  const tipAmount = useRestaurantStore((s) => s.tipAmount);
  const setTipAmount = useRestaurantStore((s) => s.setTipAmount);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const subtotal = useRestaurantStore((s) => s.cart).reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  // Parse tip presets from settings
  const presetPercentages = settingsTipPresets
    ? settingsTipPresets.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];

  const storeSettings = useRestaurantStore((s) => s.settings);
  const currency = storeSettings?.currencySymbol ?? "";

  const tipPresets = [
    { label: t.cart.noTip, value: 0 },
    ...presetPercentages.map((pct) => ({
      label: `${pct}%`,
      value: Math.round(subtotal * (pct / 100) * 100) / 100,
    })),
  ];

  const handleCustomTip = () => {
    const val = parseFloat(customValue);
    if (!isNaN(val) && val >= 0) {
      setTipAmount(Math.round(val * 100) / 100);
    }
  };

  const isPresetActive = (value: number) => {
    if (showCustomInput) return false;
    return tipAmount === value;
  };

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <HandCoins className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t.cart.addTip}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {tipPresets.map((preset) => (
              <Button
                key={preset.label}
                variant={isPresetActive(preset.value) ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => {
                  setTipAmount(preset.value);
                  setShowCustomInput(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant={showCustomInput ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => setShowCustomInput(!showCustomInput)}
            >
              {t.cart.customTip}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Success Dialog ─── */
function OrderSuccessDialog({
  open,
  onClose,
  orderNumber,
  estimatedDeliveryMin,
}: {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  estimatedDeliveryMin?: number;
}) {
  const { t } = useI18n();
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);

  const handleViewOrders = () => {
    onClose();
    setActiveSection("orders");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="size-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"
          >
            <CheckCircle2 className="size-10 text-emerald-500" />
          </motion.div>
          <DialogTitle className="text-xl">{t.cart.orderPlaced}</DialogTitle>
          <DialogDescription className="text-center">
            {t.cart.orderNumber}: <span className="font-bold text-foreground">#{orderNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            {t.cart.estimatedTime}: {estimatedDeliveryMin ?? 0}-{(estimatedDeliveryMin ?? 0) + 10} {t.common.minute}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleViewOrders} className="w-full gap-2">
            <ShoppingBag className="size-4" />
            {t.orders.title}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            {t.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main CartSection ─── */
export function CartSection() {
  const { t, isRTL } = useI18n();
  const cart = useRestaurantStore((s) => s.cart);
  const orderType = useRestaurantStore((s) => s.orderType);
  const tipAmount = useRestaurantStore((s) => s.tipAmount);
  const promoDiscount = useRestaurantStore((s) => s.promoDiscount);
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const deliveryAddress = useRestaurantStore((s) => s.deliveryAddress);
  const orderNotes = useRestaurantStore((s) => s.orderNotes);
  const clearCart = useRestaurantStore((s) => s.clearCart);
  const setLastOrderNumber = useRestaurantStore((s) => s.setLastOrderNumber);
  const notifications = useNotifications();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [shaking, setShaking] = useState(false);

  // Get settings from shared store
  const storeSettings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);
  const currency = storeSettings?.currencySymbol ?? "";

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxRate = storeSettings?.taxRate ?? 0;
  const deliveryFee = orderType === "delivery" ? (storeSettings?.deliveryFee ?? 0) : 0;
  const discountAmount = (subtotal * promoDiscount) / 100;
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const total = subtotal - discountAmount + taxAmount + deliveryFee + tipAmount;

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedPrepTime = Math.min((storeSettings?.avgPrepTime ?? 0) + cartItemCount * 3, 60);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      // Shake animation when trying to checkout with empty cart
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const orderData = {
        customerName: customerName || "",
        customerPhone: customerPhone || "",
        type: orderType,
        deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
        notes: orderNotes || undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: JSON.stringify(
            item.modifiers.map((m) => ({
              id: m.id,
              nameEn: m.nameEn,
              nameAr: m.nameAr,
              price: m.price,
              type: m.type,
            }))
          ),
          notes: item.notes || undefined,
          unitPrice: item.price,
          totalPrice: item.totalPrice,
        })),
        subtotal,
        taxAmount,
        deliveryFee,
        discountAmount,
        tipAmount,
        total,
        paymentMethod,
        paymentStatus: paymentMethod === "cash" ? "unpaid" : "paid",
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create order");
      }

      const data = await response.json();
      const orderNum = data.order?.orderNumber || "N/A";

      setLastOrderNumber(orderNum);
      setCreatedOrderNumber(orderNum);
      setShowSuccess(true);
      clearCart();
      notifications.orderPlaced(orderNum);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to place order"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0 && !showSuccess) {
    return <EmptyCartState />;
  }

  return (
    <div className={`min-h-screen pb-4 ${shaking ? "animate-shake" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <h1 className="text-lg font-bold">{t.cart.title}</h1>
          </div>
          {cartItemCount > 0 && (
            <Badge variant="secondary">
              {cartItemCount} {cartItemCount === 1 ? t.cart.item : t.cart.items}
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Cart Items */}
        <CartItems />

        {/* Estimated Prep Time */}
        <EstimatedPrepTime cart={cart} basePrepTime={storeSettings?.avgPrepTime} />

        {/* Free Delivery Progress */}
        {storeSettings && orderType === "delivery" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="shadow-none border-border/60 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (subtotal / storeSettings.minDeliveryOrder) * 100)}%`, transition: 'width 0.5s ease' }} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {subtotal >= storeSettings.minDeliveryOrder
                      ? t.home.freeDeliveryAchieved
                      : t.home.freeDeliveryProgress.replace("{{remaining}}", (storeSettings.minDeliveryOrder - subtotal).toFixed(2))
                    }
                  </span>
                  <span className="font-semibold text-primary">
                    {currency}{subtotal.toFixed(2)} / {currency}{storeSettings.minDeliveryOrder.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Schedule Order */}
        <ScheduleOrder />

        {/* Order Type */}
        <OrderTypeSelector />

        {/* Delivery Address */}
        <DeliveryAddressInput />

        {/* Table Number for Dine-in */}
        {/* <TableNumberInput /> */}

        {/* Order Notes */}
        <OrderNotesSection />

        {/* Tip */}
        <TipSection settingsTipPresets={storeSettings?.tipPresets} />

        {/* Promo Code */}
        <CartPromo />

        {/* Payment Method */}
        <PaymentMethodSection
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
        />

        {/* Order Summary */}
        <CartSummary />

        {/* Place Order Button */}
        <PlaceOrderButton
          cartCount={cart.length}
          total={total}
          currency={currency}
          orderType={orderType}
          deliveryAddress={deliveryAddress}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>

      {/* Success Dialog */}
      <OrderSuccessDialog
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        orderNumber={createdOrderNumber}
        estimatedDeliveryMin={storeSettings?.avgPrepTime}
      />
    </div>
  );
}
