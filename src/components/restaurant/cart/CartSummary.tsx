"use client";

import React from "react";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Order Summary ─── */
export function CartSummary() {
  const { t } = useI18n();
  const cart = useRestaurantStore((s) => s.cart);
  const orderType = useRestaurantStore((s) => s.orderType);
  const tipAmount = useRestaurantStore((s) => s.tipAmount);
  const promoDiscount = useRestaurantStore((s) => s.promoDiscount);
  const storeSettings = useRestaurantStore((s) => s.settings);
  const currency = storeSettings?.currencySymbol ?? "";

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxRate = storeSettings?.taxRate ?? 0;
  const deliveryFee = orderType === "delivery" ? (storeSettings?.deliveryFee ?? 0) : 0;
  const discountAmount = (subtotal * promoDiscount) / 100;
  const taxAmount = (subtotal - discountAmount) * taxRate;

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedPrepTime = Math.min((storeSettings?.avgPrepTime ?? 0) + cartItemCount * 3, 60);

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4 space-y-2.5">
          <h3 className="text-sm font-semibold mb-1">
            {t.cart.orderSummary}
          </h3>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.cart.subtotal}</span>
            <span className="font-medium">{currency}{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.cart.tax} ({Math.round(taxRate * 100)}%)</span>
            <span className="font-medium">{currency}{taxAmount.toFixed(2)}</span>
          </div>

          {orderType === "delivery" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.deliveryFee}</span>
              <span className="font-medium">{currency}{deliveryFee.toFixed(2)}</span>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">{t.cart.discount}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -{currency}{discountAmount.toFixed(2)}
              </span>
            </div>
          )}

          {tipAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.tip}</span>
              <span className="font-medium">{currency}{tipAmount.toFixed(2)}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="font-bold text-base">{t.cart.total}</span>
            <span className="font-bold text-lg text-primary">
              {currency}{(subtotal - discountAmount + taxAmount + deliveryFee + tipAmount).toFixed(2)}
            </span>
          </div>

          {/* Estimated Prep Time in Summary */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">{t.cart.estimatedPrepTime}</span>
            <span className="text-xs font-medium">
              ~{estimatedPrepTime} {t.common.minute}
            </span>
          </div>

          {/* Checkout progress indicator */}
          <div className="pt-2 space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t.cart.checkout}</span>
              <span>{t.cart.readyToOrder}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full progress-glow"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
