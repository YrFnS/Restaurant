"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Tag, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Promo Code Section ─── */
export function CartPromo() {
  const { t } = useI18n();
  const notifications = useNotifications();
  const promoCode = useRestaurantStore((s) => s.promoCode);
  const setPromoCode = useRestaurantStore((s) => s.setPromoCode);
  const promoDiscount = useRestaurantStore((s) => s.promoDiscount);
  const setPromoDiscount = useRestaurantStore((s) => s.setPromoDiscount);

  const [inputValue, setInputValue] = useState(promoCode);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSparkle, setShowSparkle] = useState(false);

  const handleApply = useCallback(async () => {
    const code = inputValue.trim().toUpperCase();
    if (!code) {
      setError("");
      setSuccess(false);
      setPromoCode("");
      setPromoDiscount(0);
      return;
    }
    // Validate promo code via API
    try {
      const res = await fetch(`/api/promo?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.valid && data.discountPercent) {
        setPromoCode(code);
        setPromoDiscount(data.discountPercent);
        setSuccess(true);
        setError("");
        setShowSparkle(true);
        setTimeout(() => setShowSparkle(false), 1500);
        notifications.promoApplied(code, data.discountPercent);
      } else {
        setPromoCode("");
        setPromoDiscount(0);
        setSuccess(false);
        setError(data.error || "Invalid code");
      }
    } catch {
      setPromoCode("");
      setPromoDiscount(0);
      setSuccess(false);
      setError("Failed to validate code");
    }
  }, [inputValue, setPromoCode, setPromoDiscount, notifications]);

  const handleRemove = () => {
    setInputValue("");
    setPromoCode("");
    setPromoDiscount(0);
    setSuccess(false);
    setError("");
  };

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t.cart.promoCode}</h3>
          </div>

          {success && promoDiscount > 0 ? (
            <div className="relative flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span className="font-medium">
                  {promoCode} ({promoDiscount}% {t.cart.discount})
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={handleRemove}
              >
                <XCircle className="size-4" />
              </Button>
              {/* Sparkle effect on success */}
              {showSparkle && (
                <>
                  <motion.span
                    className="absolute -top-2 start-4 text-lg pointer-events-none"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 1.5, opacity: 0, y: -15 }}
                    transition={{ duration: 0.8 }}
                  >✨</motion.span>
                  <motion.span
                    className="absolute -top-1 end-8 text-sm pointer-events-none"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 1.3, opacity: 0, y: -12 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                  >⭐</motion.span>
                  <motion.span
                    className="absolute top-0 end-4 text-xs pointer-events-none"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 1.2, opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >✨</motion.span>
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder={t.cart.promoCode}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApply();
                }}
                className="text-sm uppercase"
                maxLength={20}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleApply}
                disabled={!inputValue.trim()}
                className="shrink-0"
              >
                {t.cart.applyCode}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive mt-1.5">{error}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
