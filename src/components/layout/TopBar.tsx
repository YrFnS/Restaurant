"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, ShoppingCart, Menu, ChefHat, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerProfileSheet } from "@/components/restaurant/CustomerProfileSheet";

export function TopBar() {
  const { locale, setLocale, t, isRTL } = useI18n();
  const { theme, setTheme } = useTheme();
  const cart = useRestaurantStore((s) => s.cart);
  const setIsCartOpen = useRestaurantStore((s) => s.setIsCartOpen);
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);
  const isMobile = useIsMobile();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const displayName = settings ? (locale === 'ar' ? settings.nameAr : settings.nameEn) : t.app.name;

  const toggleLanguage = () => {
    setLocale(locale === "en" ? "ar" : "en");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <header
        className="gradient-warm fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 shadow-md md:hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Start side: Logo & Name */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-white/20 backdrop-blur-sm">
            <ChefHat className="size-5 text-white" />
          </div>
          {!isMobile && (
            <h1 className="text-white font-bold text-lg tracking-tight">
              {displayName}
            </h1>
          )}
          {isMobile && (
            <h1 className="text-white font-semibold text-base">
              {displayName}
            </h1>
          )}
        </div>

        {/* End side: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Profile Icon */}
          <Button
            variant="ghost"
            size="icon"
            className={`text-white/90 hover:text-white hover:bg-white/15 size-8 relative ${customerPhone ? "ring-1 ring-white/30" : ""}`}
            onClick={() => setProfileOpen(true)}
            aria-label={t.profile.title}
          >
            <User className="size-4" />
            {customerPhone && (
              <span className="absolute -top-0.5 -end-0.5 size-2 rounded-full bg-green-400 ring-1 ring-white" />
            )}
          </Button>

          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="text-white/90 hover:text-white hover:bg-white/15 h-8 px-2.5 text-sm font-medium"
            aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            {locale === "en" ? "عربي" : "English"}
          </Button>

          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-white/90 hover:text-white hover:bg-white/15 size-8"
            aria-label={theme === "dark" ? t.common.lightMode : t.common.darkMode}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>

          {/* Cart Icon with Badge */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCartOpen(true)}
            className="text-white/90 hover:text-white hover:bg-white/15 size-8 relative"
            aria-label={t.nav.cart}
          >
            <ShoppingCart className="size-5" />
            {cartItemCount > 0 && (
              <Badge
                className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold bg-white text-amber-700 border-0 shadow-sm"
              >
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* Customer Profile Sheet */}
      <CustomerProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
