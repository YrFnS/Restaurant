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
interface OrderSummaryProps {
  subtotal: number;
  tax: number;
  taxRatePercent: number;
  deliveryFee: number;
  discount: number;
  tip: number;
  total: number;
  estimatedPrepTime: number;
  currency: string;
}

export function OrderSummary({
  subtotal,
  tax,
  taxRatePercent,
  deliveryFee,
  discount,
  tip,
  total,
  estimatedPrepTime,
  currency,
}: OrderSummaryProps) {
  const { t } = useI18n();
  const orderType = useRestaurantStore((s) => s.orderType);

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
            <span className="text-muted-foreground">{t.cart.tax} ({taxRatePercent}%)</span>
            <span className="font-medium">{currency}{tax.toFixed(2)}</span>
          </div>

          {orderType === "delivery" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.deliveryFee}</span>
              <span className="font-medium">{currency}{deliveryFee.toFixed(2)}</span>
            </div>
          )}

          {discount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">{t.cart.discount}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -{currency}{discount.toFixed(2)}
              </span>
            </div>
          )}

          {tip > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.cart.tip}</span>
              <span className="font-medium">{currency}{tip.toFixed(2)}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <span className="font-bold text-base">{t.cart.total}</span>
            <span className="font-bold text-lg text-primary">
              {currency}{total.toFixed(2)}
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
