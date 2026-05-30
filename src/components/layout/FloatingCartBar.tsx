"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

export function FloatingCartBar() {
  const { t, isRTL } = useI18n();
  const cart = useRestaurantStore((s) => s.cart);
  const activeSection = useRestaurantStore((s) => s.activeSection);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const setIsCartOpen = useRestaurantStore((s) => s.setIsCartOpen);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const settings = useRestaurantStore((s) => s.settings);
  const currency = settings?.currencySymbol ?? "";

  // Don't show when on cart page or when cart is empty
  const isVisible = cartItemCount > 0 && activeSection !== "cart";

  const handleViewCart = () => {
    setActiveSection("cart");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2 md:hidden"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/25 p-3 flex items-center gap-3">
            {/* Cart icon with count */}
            <div className="relative shrink-0">
              <div className="size-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShoppingCart className="size-5" />
              </div>
              <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-primary text-[9px] font-bold leading-none">
                {cartItemCount}
              </span>
            </div>

            {/* Cart info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {cartItemCount} {cartItemCount === 1 ? t.cart.item : t.cart.items}
              </p>
              <p className="text-xs text-primary-foreground/80 font-medium">
                {currency}{cartTotal.toFixed(2)}
              </p>
            </div>

            {/* View Cart button */}
            <Button
              size="sm"
              className="bg-white text-primary hover:bg-white/90 gap-1.5 shrink-0 font-semibold"
              onClick={handleViewCart}
            >
              {t.nav.cart}
              <ArrowRight className={`size-3.5 ${isRTL ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
