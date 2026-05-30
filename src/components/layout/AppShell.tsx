"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { CartSheet } from "./CartSheet";
import { FloatingCartBar } from "./FloatingCartBar";
import { DesktopSidebar } from "./DesktopSidebar";
import { BackToTopButton } from "./BackToTopButton";
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
import { AIAssistantButton } from "@/components/layout/AIAssistantButton";

/* ─── Section mapping ─── */
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

/* ─── Page transition variants (smooth fade + slight slide) ─── */
const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  enter: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
  },
};

const pageTransition = {
  type: "tween",
  ease: [0.25, 0.46, 0.45, 0.94],
  duration: 0.25,
};

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { isRTL } = useI18n();
  const activeSection = useRestaurantStore((s) => s.activeSection);

  const SectionComponent = sectionComponents[activeSection];

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Top Header Bar (mobile) */}
      <TopBar />

      {/* Main Content Area - offset for sidebar on desktop */}
      <main className="flex-1 pt-14 md:pt-0 pb-16 md:pb-0 md:ms-64 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={pageTransition}
            className="page-transition-container flex-1 flex flex-col"
          >
            <div className="flex-1">
              {children ?? <SectionComponent />}
            </div>
            {/* Footer inside the page content so it pushes down naturally */}
            <Footer />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation (mobile) */}
      <BottomNav />

      {/* Floating Cart Bar (mobile) */}
      <FloatingCartBar />

      {/* Cart Sheet (accessible from anywhere) */}
      <CartSheet />

      {/* AI Menu Assistant Button */}
      <AIAssistantButton />

      {/* Back to Top */}
      <BackToTopButton />
    </div>
  );
}
