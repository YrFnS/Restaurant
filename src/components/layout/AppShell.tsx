"use client";

import React, { Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { Footer } from "./Footer";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type ActiveSection } from "@/lib/store";
import { HomeSection } from "@/components/restaurant/HomeSection";
import { MenuSection } from "@/components/restaurant/MenuSection";
import { CartSection } from "@/components/restaurant/CartSection";
import { OrdersSection } from "@/components/restaurant/OrdersSection";
import { ReservationsSection } from "@/components/restaurant/ReservationsSection";
import { WaitlistSection } from "@/components/restaurant/WaitlistSection";
import { RewardsSection } from "@/components/restaurant/RewardsSection";
import { ContactSection } from "@/components/restaurant/ContactSection";
import { Loader2 } from "lucide-react";

const sectionComponents: Record<ActiveSection, React.ComponentType> = {
  home: HomeSection,
  menu: MenuSection,
  cart: CartSection,
  reservations: ReservationsSection,
  orders: OrdersSection,
  waitlist: WaitlistSection,
  rewards: RewardsSection,
  contact: ContactSection,
};

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

export function AppShell() {
  const { isRTL } = useI18n();
  const activeSection = useRestaurantStore((s) => s.activeSection);
  const SectionComponent = sectionComponents[activeSection];

  // scroll to top on section change
  React.useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <DesktopSidebar />
      <TopBar />

      <main className="flex-1 pt-14 md:pt-0 pb-16 md:pb-0 md:ms-64 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 flex flex-col"
          >
            <Suspense fallback={<SectionLoader />}>
              <SectionComponent />
            </Suspense>
          </motion.div>
        </AnimatePresence>
        <Footer />
      </main>
    </div>
  );
}
