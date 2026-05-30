"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  ClipboardList,
  MoreHorizontal,
  CalendarDays,
  Users,
  Gift,
  Phone,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type ActiveSection } from "@/lib/store";

interface NavTab {
  id: ActiveSection;
  icon: React.ElementType;
  labelKey: "home" | "menu" | "cart" | "orders";
  showBadge?: boolean;
}

const mainTabs: NavTab[] = [
  { id: "home", icon: Home, labelKey: "home" },
  { id: "menu", icon: UtensilsCrossed, labelKey: "menu" },
  { id: "cart", icon: ShoppingCart, labelKey: "cart", showBadge: true },
  { id: "orders", icon: ClipboardList, labelKey: "orders" },
];

interface MoreNavItem {
  id: ActiveSection;
  icon: React.ElementType;
  labelKey: "reservations" | "waitlist" | "rewards" | "contact";
}

const moreNavItems: MoreNavItem[] = [
  { id: "reservations", icon: CalendarDays, labelKey: "reservations" },
  { id: "waitlist", icon: Users, labelKey: "waitlist" },
  { id: "rewards", icon: Gift, labelKey: "rewards" },
  { id: "contact", icon: Phone, labelKey: "contact" },
];

export function BottomNav() {
  const { t, isRTL } = useI18n();
  const activeSection = useRestaurantStore((s) => s.activeSection);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const cart = useRestaurantStore((s) => s.cart);
  const settings = useRestaurantStore((s) => s.settings);
  const [moreOpen, setMoreOpen] = useState(false);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const currencySymbol = settings?.currencySymbol ?? '';

  const isMoreActive = ["reservations", "waitlist", "rewards", "contact"].includes(
    activeSection
  );

  const handleTabClick = (id: ActiveSection) => {
    setActiveSection(id);
  };

  const handleMoreItemClick = (id: ActiveSection) => {
    setActiveSection(id);
    setMoreOpen(false);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border pb-safe md:hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => {
            const isActive = activeSection === tab.id;
            const Icon = tab.icon;

            return (
              <motion.button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full group"
                aria-label={t.nav[tab.labelKey]}
                aria-current={isActive ? "page" : undefined}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute top-0 inset-x-3 h-1 bg-primary rounded-full"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={`size-5 transition-colors duration-200 ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  {tab.showBadge && cartItemCount > 0 && (
                    <span className="absolute -top-1.5 -end-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {t.nav[tab.labelKey]}
                </span>
                {/* Cart total below label */}
                {tab.showBadge && cartItemCount > 0 && (
                  <span className="text-[8px] text-primary font-semibold -mt-0.5">
                    {currencySymbol}{cartTotal.toFixed(0)}
                  </span>
                )}
              </motion.button>
            );
          })}

          {/* More Button */}
          <motion.button
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full group"
            aria-label={t.nav.more}
            aria-current={isMoreActive ? "page" : undefined}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {isMoreActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute top-0 inset-x-3 h-1 bg-primary rounded-full"
                transition={{
                  type: "spring",
                  stiffness: 350,
                  damping: 30,
                }}
              />
            )}
            <MoreHorizontal
              className={`size-5 transition-colors duration-200 ${
                isMoreActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            />
            <span
              className={`text-[10px] font-medium transition-colors duration-200 ${
                isMoreActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {t.nav.more}
            </span>
          </motion.button>
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className="w-72"
        >
          <SheetHeader>
            <SheetTitle className="text-start">
              {t.nav.more}
            </SheetTitle>
            <SheetDescription className="text-start">
              {t.nav.moreDesc}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 p-4 pt-0">
            {moreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleMoreItemClick(item.id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors duration-200 w-full text-start ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="font-medium text-sm">
                    {t.nav[item.labelKey]}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
