"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  Home,
  UtensilsCrossed,
  ShoppingCart,
  CalendarDays,
  ClipboardList,
  Users,
  Gift,
  Phone,
  Sun,
  Moon,
  ChefHat,
  Languages,
  Heart,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type ActiveSection, type RestaurantSettings } from "@/lib/store";

/* ─── Sidebar Status Indicator ─── */
function SidebarStatusIndicator({ settings }: { settings: RestaurantSettings | null }) {
  const { t } = useI18n();

  let isOpen = false;
  if (settings?.openTime && settings?.closeTime) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = settings.openTime.split(":").map(Number);
    const [closeH, closeM] = settings.closeTime.split(":").map(Number);
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-1 border-t border-border/30">
      <span className={`size-2 rounded-full ${isOpen ? "bg-emerald-400 animate-pulse" : "bg-gray-400"}`} />
      <span className="text-[10px] text-muted-foreground font-medium">
        {isOpen ? t.home.openNow : t.home.closed}
      </span>
    </div>
  );
}

/* ─── Navigation section groups ─── */

interface NavItem {
  id: ActiveSection;
  icon: React.ElementType;
  labelKey: "home" | "menu" | "cart" | "reservations" | "orders" | "waitlist" | "rewards" | "contact";
  showBadge?: boolean;
}

interface NavGroup {
  labelKey: "main" | "ordering" | "services";
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: "main",
    items: [
      { id: "home", icon: Home, labelKey: "home" },
      { id: "menu", icon: UtensilsCrossed, labelKey: "menu" },
    ],
  },
  {
    labelKey: "ordering",
    items: [
      { id: "cart", icon: ShoppingCart, labelKey: "cart", showBadge: true },
      { id: "orders", icon: ClipboardList, labelKey: "orders" },
    ],
  },
  {
    labelKey: "services",
    items: [
      { id: "reservations", icon: CalendarDays, labelKey: "reservations" },
      { id: "waitlist", icon: Users, labelKey: "waitlist" },
      { id: "rewards", icon: Gift, labelKey: "rewards" },
      { id: "contact", icon: Phone, labelKey: "contact" },
    ],
  },
];

export function DesktopSidebar() {
  const { t, locale, setLocale, isRTL } = useI18n();
  const { theme, setTheme } = useTheme();
  const activeSection = useRestaurantStore((s) => s.activeSection);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const cart = useRestaurantStore((s) => s.cart);
  const favorites = useRestaurantStore((s) => s.favorites);

  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const toggleLanguage = () => {
    setLocale(locale === "en" ? "ar" : "en");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const year = new Date().getFullYear();

  // Use settings-based name/tagline or fallback to i18n
  const restaurantName =
    settings ? (locale === "ar" ? settings.nameAr : settings.nameEn) : t.app.name;
  const tagline =
    settings ? (locale === "ar" ? settings.taglineAr : settings.taglineEn) : t.app.tagline;

  return (
    <aside
      className="hidden md:flex flex-col fixed top-0 bottom-0 z-30 w-64 bg-card border-e border-border shadow-sm"
      dir={isRTL ? "rtl" : "ltr"}
      style={isRTL ? { left: "auto", right: 0 } : { left: 0, right: "auto" }}
    >
      {/* ─── Gradient Header with Restaurant Info ─── */}
      <div className="relative px-5 pt-5 pb-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-500/15 dark:via-orange-500/8 dark:to-transparent" />
        {/* Decorative circle */}
        <div className="absolute -top-6 -end-6 size-24 rounded-full bg-amber-500/8 dark:bg-amber-500/10" />
        <div className="absolute bottom-0 -start-4 size-16 rounded-full bg-orange-500/5 dark:bg-orange-500/8" />

        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center size-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/25">
            <ChefHat className="size-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-foreground leading-tight">
              {restaurantName}
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {tagline}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* ─── Navigation with Groups ─── */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 custom-scrollbar">
        {navGroups.map((group, groupIdx) => (
          <div key={group.labelKey} className={groupIdx > 0 ? "mt-3" : ""}>
            {/* Group label */}
            <div className="px-3 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t.nav[group.labelKey]}
              </span>
            </div>

            {/* Group items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`relative flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-start group ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`}
                    whileHover={{ x: isRTL ? -2 : 2 }}
                    whileTap={{ scale: 0.98 }}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebarIndicator"
                        className={`absolute top-1 bottom-1 w-1 rounded-full bg-primary ${
                          isRTL ? "right-0" : "left-0"
                        }`}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}

                    <Icon className={`size-[18px] shrink-0 transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
                    }`} />
                    <span className="truncate">{t.nav[item.labelKey]}</span>
                    {item.showBadge && cartItemCount > 0 && (
                      <Badge className="ms-auto bg-primary text-primary-foreground border-0 text-[10px] font-bold min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
                        {cartItemCount > 99 ? "99+" : cartItemCount}
                      </Badge>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Separator between groups */}
            {groupIdx < navGroups.length - 1 && (
              <Separator className="mt-3 opacity-50" />
            )}
          </div>
        ))}
      </nav>

      {/* ─── Quick Stats Mini Section ─── */}
      <div className="mx-4 mb-2 p-3 rounded-lg bg-muted/40 border border-border/40 space-y-2.5">
        <div className="flex items-center justify-around gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShoppingBag className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium">{cartItemCount}</span>
          </div>
          <div className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Heart className="size-3.5 text-rose-500 dark:text-rose-400" />
            <span className="text-xs font-medium">{favorites.length}</span>
          </div>
        </div>
        {/* Restaurant Status Indicator */}
        <SidebarStatusIndicator settings={settings} />
      </div>

      <Separator />

      {/* ─── Bottom Controls ─── */}
      <div className="p-3 space-y-1">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground h-8"
          aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
        >
          <Languages className="size-4 shrink-0" />
          <span className="text-xs">
            {locale === "en" ? "العربية" : "English"}
          </span>
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground h-8"
          aria-label={theme === "dark" ? t.common.lightMode : t.common.darkMode}
        >
          {theme === "dark" ? (
            <Sun className="size-4 shrink-0" />
          ) : (
            <Moon className="size-4 shrink-0" />
          )}
          <span className="text-xs">
            {theme === "dark" ? t.common.lightMode : t.common.darkMode}
          </span>
        </Button>

        {/* Copyright */}
        <div className="px-3 pt-1.5">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            © {year} {restaurantName}
          </p>
        </div>
      </div>
    </aside>
  );
}
