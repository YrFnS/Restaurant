"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartItem } from "@/lib/store";

/* ─── Animation Variants ─── */
const itemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20, height: 0, marginBottom: 0 },
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

/* ─── Cart Items Section ─── */
export function CartItems() {
  const cart = useRestaurantStore((s) => s.cart);
  const storeSettings = useRestaurantStore((s) => s.settings);
  const currency = storeSettings?.currencySymbol ?? "";

  return (
    <AnimatePresence mode="popLayout">
      <div className="space-y-3">
        {cart.map((item) => (
          <CartItemCard key={item.id} item={item} currency={currency} />
        ))}
      </div>
    </AnimatePresence>
  );
}
