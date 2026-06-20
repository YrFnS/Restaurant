"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu, ShoppingCart, Languages, UtensilsCrossed, Phone } from "lucide-react";
import { CartSheet } from "./CartSheet";
import { toast } from "sonner";
import Link from "next/link";

export function TopBar() {
  const { t, isRTL, toggleLocale, locale } = useI18n();
  const { cart, setActiveSection, activeSection } = useRestaurantStore();
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const restaurantName = isRTL ? settingsData?.settings?.nameAr : settingsData?.settings?.nameEn;
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const navItems = [
    { id: "home", label: t.nav.home, icon: "🏠" },
    { id: "menu", label: t.nav.menu, icon: "🍽️" },
    { id: "reservations", label: t.nav.reservations, icon: "📅" },
    { id: "orders", label: t.nav.orders, icon: "📋" },
    { id: "waitlist", label: t.nav.waitlist, icon: "⏳" },
    { id: "rewards", label: t.nav.rewards, icon: "🎁" },
    { id: "contact", label: t.nav.contact, icon: "📞" },
  ] as const;

  return (
    <>
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-background/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 -ms-2 rounded-lg hover:bg-accent transition-colors"
          aria-label="Menu"
        >
          <Menu className="size-5" />
        </button>
        <button
          onClick={() => setActiveSection("home")}
          className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2"
        >
          <span className="text-xl">🌶️</span>
          <span className="font-bold text-primary text-base">{restaurantName?.split(" ")[0] || (isRTL ? "زعفران" : "Saffron")}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLocale}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-xs font-semibold"
            aria-label="Switch language"
          >
            {locale === "en" ? "ع" : "EN"}
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 bg-primary text-primary-foreground text-[10px] font-bold size-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-2xl">🌶️</span>
              <span>{restaurantName || (isRTL ? "زعفران وبهارات" : "Saffron & Spice")}</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-6 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-start transition-colors ${
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-accent"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            <div className="pt-3 mt-3 border-t border-border space-y-1">
              <Link href="/pos" className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent text-start">
                <UtensilsCrossed className="size-5 text-muted-foreground" />
                <span>{t.nav.pos}</span>
              </Link>
              <Link href="/admin" className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent text-start">
                <Phone className="size-5 text-muted-foreground" />
                <span>{t.nav.admin}</span>
              </Link>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
