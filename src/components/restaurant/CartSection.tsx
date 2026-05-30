"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  UtensilsCrossed,
  Truck,
  ShoppingBasket,
  Tag,
  HandCoins,
  CreditCard,
  Banknote,
  Loader2,
  CheckCircle2,
  XCircle,
  StickyNote,
  Clock,
  CalendarClock,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartItem } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";

/* ─── Promo Codes ─── */
// Promo codes are validated server-side via /api/promo?code=XXX

/* ─── Animation Variants ─── */
const itemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20, height: 0, marginBottom: 0 },
};

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/* ─── Cart Item Card ─── */
function CartItemCard({ item, currency }: { item: CartItem; currency: string }) {
  const { t, locale } = useI18n();
  const removeFromCart = useRestaurantStore((s) => s.removeFromCart);
  const updateCartItemQuantity = useRestaurantStore((s) => s.updateCartItemQuantity);
  const [bouncingBtn, setBouncingBtn] = useState<string | null>(null);

  const name = locale === "ar" ? item.nameAr : item.nameEn;

  const handleQuantityChange = (direction: "up" | "down") => {
    setBouncingBtn(direction);
    setTimeout(() => setBouncingBtn(null), 300);
    if (direction === "up") {
      updateCartItemQuantity(item.id, item.quantity + 1);
    } else {
      updateCartItemQuantity(item.id, Math.max(1, item.quantity - 1));
    }
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="flex gap-3 p-3 rounded-xl bg-card border border-border/60 shadow-sm"
    >
      {/* Item Image */}
      {item.image && (
        <div className="size-16 rounded-lg overflow-hidden shrink-0 bg-muted">
          <img
            src={item.image}
            alt={name}
            className="size-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Name + Remove */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight truncate">{name}</h4>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive -mt-0.5 -me-1"
            onClick={() => removeFromCart(item.id)}
            aria-label={t.cart.remove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        {/* Modifiers */}
        {item.modifiers.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.modifiers
              .map((m) => (locale === "ar" ? m.nameAr : m.nameEn))
              .join(", ")}
          </p>
        )}

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 truncate italic">
            {item.notes}
          </p>
        )}

        {/* Quantity + Price */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <motion.div
              animate={bouncingBtn === "down" ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-md"
                onClick={() => handleQuantityChange("down")}
                disabled={item.quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-3" />
              </Button>
            </motion.div>
            <motion.span
              key={item.quantity}
              initial={{ scale: 1.2, color: "hsl(var(--primary))" }}
              animate={{ scale: 1, color: "hsl(var(--foreground))" }}
              transition={{ duration: 0.3 }}
              className="w-7 text-center text-sm font-semibold tabular-nums"
            >
              {item.quantity}
            </motion.span>
            <motion.div
              animate={bouncingBtn === "up" ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                variant="outline"
                size="icon"
                className="size-7 rounded-md"
                onClick={() => handleQuantityChange("up")}
                aria-label="Increase quantity"
              >
                <Plus className="size-3" />
              </Button>
            </motion.div>
          </div>
          <span className="font-bold text-sm text-primary">
            {currency}
            {item.totalPrice.toFixed(2)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

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
        <UtensilsCrossed className="size-4" />
        {t.cart.browseMenu}
      </Button>
    </motion.div>
  );
}

/* ─── Order Type Selector ─── */
function OrderTypeSelector() {
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
function DeliveryAddressInput({ deliveryFee, currency }: { deliveryFee: number; currency: string }) {
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
function TableNumberInput() {
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

/* ─── Schedule Order ─── */
function ScheduleOrder() {
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
function TipSection({ settingsTipPresets, currency }: { settingsTipPresets?: string; currency: string }) {
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

/* ─── Promo Code ─── */
function PromoCodeSection() {
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

/* ─── Payment Method ─── */
function PaymentMethodSection({
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

/* ─── Order Summary ─── */
function OrderSummary({
  subtotal,
  tax,
  taxRatePercent,
  deliveryFee,
  discount,
  tip,
  total,
  estimatedPrepTime,
  currency,
}: {
  subtotal: number;
  tax: number;
  taxRatePercent: number;
  deliveryFee: number;
  discount: number;
  tip: number;
  total: number;
  estimatedPrepTime: number;
  currency: string;
}) {
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
  const { t, isRTL, locale } = useI18n();
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
  const cartContainerRef = useRef<HTMLDivElement>(null);

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
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {cart.map((item) => (
              <CartItemCard key={item.id} item={item} currency={currency} />
            ))}
          </div>
        </AnimatePresence>

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
            disabled={cart.length === 0 || isSubmitting || (orderType === "delivery" && !deliveryAddress.trim())}
            onClick={handlePlaceOrder}
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
