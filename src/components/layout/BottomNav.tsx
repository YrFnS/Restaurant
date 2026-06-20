"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type ActiveSection } from "@/lib/store";
import { Home, Utensils, CalendarDays, ClipboardList, Gift } from "lucide-react";

export function BottomNav() {
  const { t, isRTL } = useI18n();
  const { activeSection, setActiveSection } = useRestaurantStore();

  const items: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t.nav.home, icon: <Home className="size-5" /> },
    { id: "menu", label: t.nav.menu, icon: <Utensils className="size-5" /> },
    { id: "reservations", label: t.nav.reservations, icon: <CalendarDays className="size-5" /> },
    { id: "orders", label: t.nav.orders, icon: <ClipboardList className="size-5" /> },
    { id: "rewards", label: t.nav.rewards, icon: <Gift className="size-5" /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 safe-area-bottom">
      {items.map((item) => {
        const active = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <span className={`transition-transform ${active ? "scale-110" : ""}`}>
              {item.icon}
            </span>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
            {active && <span className="absolute bottom-1 h-0.5 w-8 bg-primary rounded-full" />}
          </button>
        );
      })}
    </nav>
  );
}
