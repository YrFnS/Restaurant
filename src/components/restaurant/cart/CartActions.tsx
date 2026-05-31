"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed,
  Truck,
  ShoppingBasket,
  CalendarClock,
  Clock,
  CreditCard,
  Banknote,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Order Type Selector ─── */
export function OrderTypeSelector() {
  const { t } = useI18n();
  const orderType = useRestaurantStore((s) => s.orderType);
  const setOrderType = useRestaurantStore((s) => s.setOrderType);

  const types = [
    { value: "dine_in" as const, label: t.cart.dineIn, icon: UtensilsCrossed },
    { value: "takeout" as const, label: t.cart.takeout, icon: ShoppingBasket },
    { value: "delivery" as const, label: t.cart.delivery, icon: Truck },
  ];

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">{t.cart.orderType}</h3>
          <div className="grid grid-cols-3 gap-2">
            {types.map(({ value, label, icon: Icon }) => {
              const isActive = orderType === value;
              return (
                <button
                  key={value}
                  onClick={() => setOrderType(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-accent/50"
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Delivery Address ─── */
export function DeliveryAddressInput() {
  const { t } = useI18n();
  const deliveryAddress = useRestaurantStore((s) => s.deliveryAddress);
  const setDeliveryAddress = useRestaurantStore((s) => s.setDeliveryAddress);
  const orderType = useRestaurantStore((s) => s.orderType);
  const storeSettings = useRestaurantStore((s) => s.settings);
  const currency = storeSettings?.currencySymbol ?? "";
  const deliveryFee = storeSettings?.deliveryFee ?? 0;

  if (orderType !== "delivery") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t.cart.deliveryAddress}</h3>
          <Input
            placeholder={t.cart.enterAddress}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t.cart.deliveryFee}: {currency}
            {deliveryFee.toFixed(2)}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Schedule Order ─── */
export function ScheduleOrder() {
  const { t } = useI18n();
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledTime, setScheduledTime] = useState("");

  // Generate available time slots (from now + 1 hour, every 30 min)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const now = new Date();
    // Start from 1 hour from now
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);

    for (let i = 0; i < 12; i++) {
      const slot = new Date(start.getTime() + i * 30 * 60 * 1000);
      if (slot.getHours() >= 23) break;
      const hours = slot.getHours();
      const minutes = slot.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const hour12 = hours % 12 || 12;
      slots.push(`${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`);
    }
    return slots;
  }, []);

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t.cart.scheduleOrder}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setScheduleMode("now")}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                scheduleMode === "now"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              <Clock className="size-3.5" />
              {t.cart.scheduleNow}
            </button>
            <button
              onClick={() => setScheduleMode("later")}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                scheduleMode === "later"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              <CalendarClock className="size-3.5" />
              {t.cart.scheduleLater}
            </button>
          </div>

          <AnimatePresence>
            {scheduleMode === "later" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Select value={scheduledTime} onValueChange={setScheduledTime}>
                  <SelectTrigger className="w-full bg-muted/30 border-0">
                    <SelectValue placeholder={t.cart.selectTime} />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduledTime && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t.cart.scheduledFor} {scheduledTime}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Payment Method ─── */
export function PaymentMethodSection({
  paymentMethod,
  onPaymentMethodChange,
}: {
  paymentMethod: "cash" | "card";
  onPaymentMethodChange: (method: "cash" | "card") => void;
}) {
  const { t } = useI18n();

  return (
    <motion.div variants={sectionVariants} initial="initial" animate="animate">
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">{t.cart.paymentMethod}</h3>
          </div>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(val) => onPaymentMethodChange(val as "cash" | "card")}
            className="grid grid-cols-2 gap-2"
          >
            <Label
              htmlFor="pay-cash"
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === "cash"
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <RadioGroupItem value="cash" id="pay-cash" />
              <Banknote className="size-4" />
              <span className="text-sm font-medium">{t.cart.cash}</span>
            </Label>
            <Label
              htmlFor="pay-card"
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === "card"
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <RadioGroupItem value="card" id="pay-card" />
              <CreditCard className="size-4" />
              <span className="text-sm font-medium">{t.cart.card}</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Place Order Button ─── */
export function PlaceOrderButton({
  cartCount,
  total,
  currency,
  orderType,
  deliveryAddress,
  isSubmitting,
  submitError,
  onPlaceOrder,
}: {
  cartCount: number;
  total: number;
  currency: string;
  orderType: "dine_in" | "takeout" | "delivery";
  deliveryAddress: string;
  isSubmitting: boolean;
  submitError: string;
  onPlaceOrder: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      {/* Error */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2"
        >
          <XCircle className="size-4 shrink-0" />
          <span>{submitError}</span>
        </motion.div>
      )}

      {/* Place Order Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Button
          size="lg"
          className="w-full gap-2 h-14 text-base font-bold rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 active:scale-[0.98]"
          disabled={cartCount === 0 || isSubmitting || (orderType === "delivery" && !deliveryAddress.trim())}
          onClick={onPlaceOrder}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              {t.common.loading}
            </>
          ) : (
            <>
              {t.cart.placeOrder}
              <span className="ms-2 opacity-80">
                {currency}{total.toFixed(2)}
              </span>
            </>
          )}
        </Button>
      </motion.div>
    </>
  );
}
