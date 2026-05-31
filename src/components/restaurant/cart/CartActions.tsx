"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed,
  Truck,
  ShoppingBasket,
  Tag,
  HandCoins,
  CreditCard,
  Banknote,
  StickyNote,
  Clock,
  CalendarClock,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Order Type Selector ─── */
interface OrderTypeSelectorProps {
  settingsMinDeliveryOrder?: number;
  subtotal?: number;
  deliveryFee?: number;
}

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
interface DeliveryAddressInputProps {
  deliveryFee: number;
  currency: string;
}

export function DeliveryAddressInput({ deliveryFee, currency }: DeliveryAddressInputProps) {
  const { t } = useI18n();
  const deliveryAddress = useRestaurantStore((s) => s.deliveryAddress);
  const setDeliveryAddress = useRestaurantStore((s) => s.setDeliveryAddress);
  const orderType = useRestaurantStore((s) => s.orderType);

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

/* ─── Table Number Input for Dine-in ─── */
export function TableNumberInput() {
  const { t } = useI18n();
  const orderType = useRestaurantStore((s) => s.orderType);
  const tableNumber = useRestaurantStore((s) => s.tableNumber);
  const setTableNumber = useRestaurantStore((s) => s.setTableNumber);

  if (orderType !== "dine_in") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="shadow-none border-border/60">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-amber-500" />
            {t.cart.tableNumber}
          </h3>
          <Input
            placeholder={t.cart.tableNumberPlaceholder}
            value={tableNumber || ""}
            onChange={(e) => setTableNumber(e.target.value)}
            className="text-sm"
            type="text"
            inputMode="numeric"
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Estimated Prep Time ─── */
interface EstimatedPrepTimeProps {
  cart: CartItem[];
  basePrepTime?: number;
}

export function EstimatedPrepTime({ cart, basePrepTime }: EstimatedPrepTimeProps) {
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

/* ─── Tip Section ─── */
interface TipSectionProps {
  settingsTipPresets?: string;
  currency: string;
}

export function TipSection({ settingsTipPresets, currency }: TipSectionProps) {
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
          <AnimatePresence>
            {showCustomInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex gap-2"
              >
                <div className="relative flex-1">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currency}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0.00"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="ps-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomTip();
                    }}
                  />
                </div>
                <Button size="sm" onClick={handleCustomTip}>
                  {t.common.confirm}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Order Notes ─── */
export function OrderNotesSection() {
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

/* ─── Payment Method ─── */
interface PaymentMethodSectionProps {
  paymentMethod: "cash" | "card";
  onPaymentMethodChange: (method: "cash" | "card") => void;
}

export function PaymentMethodSection({
  paymentMethod,
  onPaymentMethodChange,
}: PaymentMethodSectionProps) {
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
interface PlaceOrderButtonProps {
  cartLength: number;
  isSubmitting: boolean;
  isDeliveryWithoutAddress: boolean;
  total: number;
  currency: string;
  shaking: boolean;
  onPlaceOrder: () => void;
}

export function PlaceOrderButton({
  cartLength,
  isSubmitting,
  isDeliveryWithoutAddress,
  total,
  currency,
  shaking,
  onPlaceOrder,
}: PlaceOrderButtonProps) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <Button
        size="lg"
        className={`w-full gap-2 h-14 text-base font-bold rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-500 text-white shadow-lg shadow-orange-500/25 transition-all duration-200 active:scale-[0.98] ${shaking ? "animate-shake" : ""}`}
        disabled={cartLength === 0 || isSubmitting || isDeliveryWithoutAddress}
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
  );
}

/* ─── Success Dialog ─── */
interface OrderSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  estimatedDeliveryMin?: number;
}

export function OrderSuccessDialog({
  open,
  onClose,
  orderNumber,
  estimatedDeliveryMin,
}: OrderSuccessDialogProps) {
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

/* ─── Submit Error ─── */
interface SubmitErrorProps {
  error: string;
}

export function SubmitError({ error }: SubmitErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2"
    >
      <XCircle className="size-4 shrink-0" />
      <span>{error}</span>
    </motion.div>
  );
}
