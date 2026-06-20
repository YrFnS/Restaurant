"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type ActiveSection } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Home, Utensils, CalendarDays, ClipboardList, Hourglass,
  Gift, Phone, ShoppingCart, Languages, LayoutDashboard, Monitor,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartSheet } from "./CartSheet";

export function DesktopSidebar() {
  const { t, isRTL, toggleLocale, locale } = useI18n();
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const restaurantName = isRTL ? settingsData?.settings?.nameAr : settingsData?.settings?.nameEn;
  const { activeSection, setActiveSection, cart } = useRestaurantStore();
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const navItems: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t.nav.home, icon: <Home className="size-[18px]" /> },
    { id: "menu", label: t.nav.menu, icon: <Utensils className="size-[18px]" /> },
    { id: "reservations", label: t.nav.reservations, icon: <CalendarDays className="size-[18px]" /> },
    { id: "orders", label: t.nav.orders, icon: <ClipboardList className="size-[18px]" /> },
    { id: "waitlist", label: t.nav.waitlist, icon: <Hourglass className="size-[18px]" /> },
    { id: "rewards", label: t.nav.rewards, icon: <Gift className="size-[18px]" /> },
    { id: "contact", label: t.nav.contact, icon: <Phone className="size-[18px]" /> },
  ];

  return (
    <>
      <aside className="hidden md:flex fixed inset-y-0 start-0 z-30 w-64 flex-col bg-sidebar border-e border-sidebar-border">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
          <span className="text-2xl">🌶️</span>
          <div className="leading-tight">
            <div className="font-bold text-sidebar-foreground text-sm">
              {restaurantName || (isRTL ? "زعفران وبهارات" : "Saffron & Spice")}
            </div>
            <div className="text-[10px] text-muted-foreground">{t.app.tagline}</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scroll-thin">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === "menu" && cartCount > 0 && (
                  <span className="ms-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Cart button */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
          <Button
            onClick={() => setCartOpen(true)}
            className="w-full justify-start gap-3"
            variant="secondary"
          >
            <ShoppingCart className="size-[18px]" />
            <span>{t.nav.cart}</span>
            {cartCount > 0 && (
              <span className="ms-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {cartCount}
              </span>
            )}
          </Button>

          {/* Staff links */}
          <div className="flex gap-2">
            <Link href="/admin" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <LayoutDashboard className="size-4" />
                <span className="text-xs">{t.nav.admin}</span>
              </Button>
            </Link>
            <Link href="/pos" className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Monitor className="size-4" />
                <span className="text-xs">{t.nav.pos}</span>
              </Button>
            </Link>
          </div>

          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent text-sm text-sidebar-foreground transition-colors"
          >
            <Languages className="size-4" />
            <span>{locale === "en" ? "العربية" : "English"}</span>
          </button>
        </div>
      </aside>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
