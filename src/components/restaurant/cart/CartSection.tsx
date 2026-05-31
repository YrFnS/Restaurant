"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { EmptyCartState } from "./CartItems";
import { CartItemsList } from "./CartItems";
import { EstimatedPrepTime } from "./CartActions";
import { OrderTypeSelector } from "./CartActions";
import { DeliveryAddressInput } from "./CartActions";
import { ScheduleOrder } from "./CartActions";
import { OrderNotesSection } from "./CartActions";
import { TipSection } from "./CartActions";
import { PromoCodeSection } from "./CartPromo";
import { PaymentMethodSection } from "./CartActions";
import { OrderSummary } from "./CartSummary";
import { PlaceOrderButton, OrderSuccessDialog, SubmitError } from "./CartActions";

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
        <CartItemsList cart={cart} currency={currency} cartItemCount={cartItemCount} />

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
        <DeliveryAddressInput deliveryFee={deliveryFee} currency={currency} />

        {/* Table Number for Dine-in */}
        {/* <TableNumberInput /> */}

        {/* Order Notes */}
        <OrderNotesSection />

        {/* Tip */}
        <TipSection settingsTipPresets={storeSettings?.tipPresets} currency={currency} />

        {/* Promo Code */}
        <PromoCodeSection />

        {/* Payment Method */}
        <PaymentMethodSection
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
        />

        {/* Order Summary */}
        <OrderSummary
          subtotal={subtotal}
          tax={taxAmount}
          taxRatePercent={Math.round(taxRate * 100)}
          deliveryFee={deliveryFee}
          discount={discountAmount}
          tip={tipAmount}
          total={total}
          estimatedPrepTime={estimatedPrepTime}
          currency={currency}
        />

        {/* Error */}
        {submitError && <SubmitError error={submitError} />}

        {/* Place Order Button */}
        <PlaceOrderButton
          cartLength={cart.length}
          isSubmitting={isSubmitting}
          isDeliveryWithoutAddress={orderType === "delivery" && !deliveryAddress.trim()}
          total={total}
          currency={currency}
          shaking={shaking}
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
