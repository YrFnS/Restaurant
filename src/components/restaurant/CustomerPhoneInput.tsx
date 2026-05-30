"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Phone, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

export function CustomerPhoneInput() {
  const { t } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const [phoneInput, setPhoneInput] = useState(customerPhone);
  const [saveForFaster, setSaveForFaster] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSaved, setIsSaved] = useState(!!customerPhone);

  const validatePhone = useCallback((phone: string): boolean => {
    // Basic phone validation: at least 7 digits
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }, []);

  const handleSave = useCallback(() => {
    setIsValidating(true);
    setTimeout(() => {
      const valid = validatePhone(phoneInput);
      setIsValid(valid);
      setIsValidating(false);
      if (valid && saveForFaster) {
        setCustomerPhone(phoneInput);
        setIsSaved(true);
      } else if (valid) {
        setCustomerPhone(phoneInput);
        setIsSaved(true);
      }
    }, 300);
  }, [phoneInput, saveForFaster, validatePhone, setCustomerPhone]);

  const handleEdit = useCallback(() => {
    setIsSaved(false);
    setIsValid(null);
    setPhoneInput(customerPhone);
  }, [customerPhone]);

  if (isSaved && customerPhone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="shadow-none border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Phone className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t.cart.phoneForTracking}</p>
                  <p className="text-xs text-muted-foreground">{customerPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-emerald-500" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleEdit}
                >
                  {t.common.edit}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Phone className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t.cart.phoneForTracking}</h3>
              <p className="text-xs text-muted-foreground">{t.cart.phoneForTrackingDesc}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="tel"
                placeholder={t.cart.phonePlaceholder}
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setIsValid(null);
                }}
                className="ps-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!phoneInput.trim() || isValidating}
              className="shrink-0"
            >
              {isValidating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t.common.save
              )}
            </Button>
          </div>

          {isValid === false && (
            <p className="text-xs text-destructive">{t.cart.phoneInvalid}</p>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="save-faster"
              checked={saveForFaster}
              onCheckedChange={(checked) => setSaveForFaster(checked === true)}
            />
            <Label htmlFor="save-faster" className="text-xs text-muted-foreground cursor-pointer">
              {t.cart.saveForFaster}
            </Label>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
