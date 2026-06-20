"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, Armchair,
  CalendarCheck, Users, Boxes, BarChart3, MonitorSmartphone,
  Settings as SettingsIcon, LogOut, Menu, Languages, Bell, QrCode, MessageSquare, Timer, Award, Package, CalendarDays, TrendingUp, Grid3x3,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { DashboardTab } from "./tabs/DashboardTab";
import { MenuTab } from "./tabs/MenuTab";
import { OrdersTab } from "./tabs/OrdersTab";
import { TablesTab } from "./tabs/TablesTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { StaffTab } from "./tabs/StaffTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { KdsScreensTab } from "./tabs/KdsScreensTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type AdminTab =
  | "dashboard"
  | "menu"
  | "orders"
  | "tables"
  | "reservations"
  | "staff"
  | "inventory"
  | "reports"
  | "kds"
  | "settings";

const TAB_COMPONENTS: Record<AdminTab, React.ComponentType> = {
  dashboard: DashboardTab,
  menu: MenuTab,
  orders: OrdersTab,
  tables: TablesTab,
  reservations: ReservationsTab,
  staff: StaffTab,
  inventory: InventoryTab,
  reports: ReportsTab,
  kds: KdsScreensTab,
  settings: SettingsTab,
};

export function AdminShell() {
  const { t, isRTL, toggleLocale, locale } = useI18n();
  const { staffName, clearStaff } = useRestaurantStore();
  const [active, setActive] = useState<AdminTab>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pull restaurant settings for the top bar name
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const settings = settingsData?.settings;
  const restaurantName = (isRTL ? settings?.nameAr : settings?.nameEn) || t.app.name;

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: t.admin.dashboard, icon: <LayoutDashboard className="size-[18px]" /> },
    { id: "menu", label: t.admin.menu, icon: <UtensilsCrossed className="size-[18px]" /> },
    { id: "orders", label: t.admin.orders, icon: <ClipboardList className="size-[18px]" /> },
    { id: "tables", label: t.admin.tables, icon: <Armchair className="size-[18px]" /> },
    { id: "reservations", label: t.admin.reservations, icon: <CalendarCheck className="size-[18px]" /> },
    { id: "staff", label: t.admin.staff, icon: <Users className="size-[18px]" /> },
    { id: "inventory", label: t.admin.inventory, icon: <Boxes className="size-[18px]" /> },
    { id: "reports", label: t.admin.reports, icon: <BarChart3 className="size-[18px]" /> },
    { id: "kds", label: t.admin.kdsScreens, icon: <MonitorSmartphone className="size-[18px]" /> },
    { id: "settings", label: t.admin.settings, icon: <SettingsIcon className="size-[18px]" /> },
  ];

  const handleLogout = () => {
    clearStaff();
    toast.success(isRTL ? "تم تسجيل الخروج" : "Logged out");
  };

  const handleSelect = (id: AdminTab) => {
    setActive(id);
    setMobileOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const ActiveTab = TAB_COMPONENTS[active];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 z-30 w-64 flex-col bg-sidebar border-e border-sidebar-border">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
          <span className="text-2xl">🌶️</span>
          <div className="leading-tight flex-1 min-w-0">
            <div className="font-bold text-sidebar-foreground text-sm truncate">
              {restaurantName}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{t.admin.title}</div>
          </div>
        </div>
        <NavList navItems={navItems} active={active} onSelect={handleSelect} isRTL={isRTL} />
        <SidebarFooter t={t} isRTL={isRTL} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0 flex flex-col">
          <SheetHeader className="h-16 flex flex-row items-center gap-2.5 px-5 border-b border-sidebar-border m-0">
            <span className="text-2xl">🌶️</span>
            <SheetTitle className="text-sm font-bold">
              {restaurantName}
            </SheetTitle>
          </SheetHeader>
          <NavList navItems={navItems} active={active} onSelect={handleSelect} isRTL={isRTL} />
          <SidebarFooter t={t} isRTL={isRTL} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="lg:ms-64 flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 bg-background/95 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="font-bold text-base lg:text-lg truncate">
              {navItems.find((n) => n.id === active)?.label}
            </h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {restaurantName}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
              <span className="absolute top-1 end-1 size-2 bg-destructive rounded-full" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLocale}
              className="gap-1.5"
            >
              <Languages className="size-4" />
              <span className="hidden sm:inline text-xs">{locale === "en" ? "ع" : "EN"}</span>
            </Button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
              <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                {staffName?.[0]?.toUpperCase() || "S"}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold">{staffName}</div>
                <div className="text-[10px] text-muted-foreground">{t.admin.staff}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
              title={t.admin.logout}
            >
              <LogOut className={isRTL ? "size-4 rotate-180" : "size-4"} />
            </Button>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveTab />
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-auto border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>© {new Date().getFullYear()} {restaurantName} — Admin Panel</span>
          <span>{isRTL ? "إصدار 1.0" : "v1.0"}</span>
        </footer>
      </div>
    </>
  );
}

function NavList({
  navItems, active, onSelect, isRTL,
}: {
  navItems: { id: AdminTab; label: string; icon: React.ReactNode }[];
  active: AdminTab;
  onSelect: (id: AdminTab) => void;
  isRTL: boolean;
}) {
  return (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scroll-thin">
      {navItems.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            {item.icon}
            <span className="flex-1 text-start">{item.label}</span>
          </button>
        );
      })}
      <div className="pt-3 mt-3 border-t border-sidebar-border">
        <Link
          href="/admin/featured"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <Award className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "إدارة المميز" : "Featured Items"}</span>
        </Link>
        <Link
          href="/admin/reservations-calendar"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <CalendarDays className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "تقويم الحجوزات" : "Reservations Calendar"}</span>
        </Link>
        <Link
          href="/admin/analytics"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <TrendingUp className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "تحليلات المبيعات" : "Sales Analytics"}</span>
        </Link>
        <Link
          href="/admin/floor-editor"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <Grid3x3 className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "محرر الطاولات" : "Floor Plan Editor"}</span>
        </Link>
        <Link
          href="/admin/inventory"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <Package className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "لوحة المخزون" : "Inventory Dashboard"}</span>
        </Link>
        <Link
          href="/admin/qr"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <QrCode className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "رموز الطاولات" : "Table QR Codes"}</span>
        </Link>
        <Link
          href="/admin/feedback"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <MessageSquare className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "آراء العملاء" : "Customer Feedback"}</span>
        </Link>
        <Link
          href="/admin/timesheet"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <Timer className="size-[18px]" />
          <span className="flex-1 text-start">{isRTL ? "سجل الدوام" : "Staff Timesheet"}</span>
        </Link>
      </div>
    </nav>
  );
}

function SidebarFooter({
  t, isRTL, onLogout,
}: {
  t: any;
  isRTL: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
      <Link href="/" className="block">
        <Button variant="outline" size="sm" className="w-full gap-2 justify-start">
          <Menu className="size-4" />
          <span className="text-xs">{isRTL ? "العودة للموقع" : "Back to site"}</span>
        </Button>
      </Link>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 hover:text-destructive text-sm transition-colors"
      >
        <LogOut className={isRTL ? "size-4 rotate-180" : "size-4"} />
        <span>{t.admin.logout}</span>
      </button>
    </div>
  );
}
