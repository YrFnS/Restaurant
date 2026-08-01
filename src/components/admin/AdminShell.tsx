"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import {
  INVENTORY_MANAGEMENT_ROLES,
  MENU_MANAGEMENT_ROLES,
  ORDER_MANAGEMENT_ROLES,
  REPORTING_ROLES,
  RESERVATION_MANAGEMENT_ROLES,
  SETTINGS_MANAGEMENT_ROLES,
  STAFF_ADMIN_ROLES,
  TABLE_OPERATION_ROLES,
  roleIsAllowed,
} from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Armchair,
  CalendarCheck,
  Users,
  Boxes,
  BarChart3,
  MonitorSmartphone,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  Languages,
  Bell,
  QrCode,
  MessageSquare,
  Timer,
  Award,
  Package,
  CalendarDays,
  TrendingUp,
  Grid3x3,
  ShoppingCart,
  ShieldAlert,
  Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardTab } from "./tabs/DashboardTab";
import { MenuTab } from "./tabs/MenuTab";
import { OrdersTab } from "./tabs/OrdersTab";
import { TablesTab } from "./tabs/TablesTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { WaitlistTab } from "./tabs/WaitlistTab";
import { StaffTab } from "./tabs/StaffTab";
import { InventoryTab } from "./tabs/InventoryTab";
import { PurchasingTab } from "./tabs/PurchasingTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { KdsScreensTab } from "./tabs/KdsScreensTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type AdminTab =
  | "dashboard"
  | "menu"
  | "orders"
  | "tables"
  | "reservations"
  | "waitlist"
  | "staff"
  | "inventory"
  | "purchasing"
  | "reports"
  | "kds"
  | "settings";

interface AdminShellProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
}

interface AdminNavItem {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  roles: readonly string[];
}

interface SecondaryLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: readonly string[];
}

const TAB_COMPONENTS: Record<AdminTab, React.ComponentType> = {
  dashboard: DashboardTab,
  menu: MenuTab,
  orders: OrdersTab,
  tables: TablesTab,
  reservations: ReservationsTab,
  waitlist: WaitlistTab,
  staff: StaffTab,
  inventory: InventoryTab,
  purchasing: PurchasingTab,
  reports: ReportsTab,
  kds: KdsScreensTab,
  settings: SettingsTab,
};

function roleLabel(role: string): string {
  return role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminShell({ user }: AdminShellProps) {
  const { t, isRTL, toggleLocale, locale } = useI18n();
  const clearStaff = useRestaurantStore((state) => state.clearStaff);
  const queryClient = useQueryClient();
  const [requestedActive, setRequestedActive] = useState<AdminTab | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const settings = settingsData?.settings;
  const restaurantName = (isRTL ? settings?.nameAr : settings?.nameEn) || t.app.name;

  const navItems = useMemo<AdminNavItem[]>(() => {
    const items: AdminNavItem[] = [
      {
        id: "dashboard",
        label: t.admin.dashboard,
        icon: <LayoutDashboard className="size-[18px]" />,
        roles: REPORTING_ROLES,
      },
      {
        id: "menu",
        label: t.admin.menu,
        icon: <UtensilsCrossed className="size-[18px]" />,
        roles: MENU_MANAGEMENT_ROLES,
      },
      {
        id: "orders",
        label: t.admin.orders,
        icon: <ClipboardList className="size-[18px]" />,
        roles: ORDER_MANAGEMENT_ROLES,
      },
      {
        id: "tables",
        label: t.admin.tables,
        icon: <Armchair className="size-[18px]" />,
        roles: TABLE_OPERATION_ROLES,
      },
      {
        id: "reservations",
        label: t.admin.reservations,
        icon: <CalendarCheck className="size-[18px]" />,
        roles: RESERVATION_MANAGEMENT_ROLES,
      },
      {
        id: "waitlist",
        label: isRTL ? "قائمة الانتظار" : "Waitlist",
        icon: <Hourglass className="size-[18px]" />,
        roles: RESERVATION_MANAGEMENT_ROLES,
      },
      {
        id: "staff",
        label: t.admin.staff,
        icon: <Users className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
      {
        id: "inventory",
        label: t.admin.inventory,
        icon: <Boxes className="size-[18px]" />,
        roles: INVENTORY_MANAGEMENT_ROLES,
      },
      {
        id: "purchasing",
        label: isRTL ? "المشتريات" : "Purchasing",
        icon: <ShoppingCart className="size-[18px]" />,
        roles: INVENTORY_MANAGEMENT_ROLES,
      },
      {
        id: "reports",
        label: t.admin.reports,
        icon: <BarChart3 className="size-[18px]" />,
        roles: REPORTING_ROLES,
      },
      {
        id: "kds",
        label: t.admin.kdsScreens,
        icon: <MonitorSmartphone className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
      {
        id: "settings",
        label: t.admin.settings,
        icon: <SettingsIcon className="size-[18px]" />,
        roles: SETTINGS_MANAGEMENT_ROLES,
      },
    ];
    return items.filter((item) => roleIsAllowed(user.role, item.roles));
  }, [isRTL, t, user.role]);

  const secondaryLinks = useMemo<SecondaryLink[]>(() => {
    const items: SecondaryLink[] = [
      {
        href: "/admin/featured",
        label: isRTL ? "إدارة المميز" : "Featured Items",
        icon: <Award className="size-[18px]" />,
        roles: MENU_MANAGEMENT_ROLES,
      },
      {
        href: "/admin/reservations-calendar",
        label: isRTL ? "تقويم الحجوزات" : "Reservations Calendar",
        icon: <CalendarDays className="size-[18px]" />,
        roles: RESERVATION_MANAGEMENT_ROLES,
      },
      {
        href: "/admin/analytics",
        label: isRTL ? "تحليلات المبيعات" : "Sales Analytics",
        icon: <TrendingUp className="size-[18px]" />,
        roles: REPORTING_ROLES,
      },
      {
        href: "/admin/floor-editor",
        label: isRTL ? "محرر الطاولات" : "Floor Plan Editor",
        icon: <Grid3x3 className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
      {
        href: "/admin/inventory",
        label: isRTL ? "لوحة المخزون" : "Inventory Dashboard",
        icon: <Package className="size-[18px]" />,
        roles: INVENTORY_MANAGEMENT_ROLES,
      },
      {
        href: "/admin/qr",
        label: isRTL ? "رموز الطاولات" : "Table QR Codes",
        icon: <QrCode className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
      {
        href: "/admin/feedback",
        label: isRTL ? "آراء العملاء" : "Customer Feedback",
        icon: <MessageSquare className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
      {
        href: "/admin/timesheet",
        label: isRTL ? "سجل الدوام" : "Staff Timesheet",
        icon: <Timer className="size-[18px]" />,
        roles: STAFF_ADMIN_ROLES,
      },
    ];
    return items.filter((item) => roleIsAllowed(user.role, item.roles));
  }, [isRTL, user.role]);

  const active =
    requestedActive && navItems.some((item) => item.id === requestedActive)
      ? requestedActive
      : navItems[0]?.id ?? null;
  const ActiveTab = active ? TAB_COMPONENTS[active] : null;
  const activeLabel = navItems.find((item) => item.id === active)?.label;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearStaff();
      queryClient.setQueryData(["auth-session"], null);
      toast.success(isRTL ? "تم تسجيل الخروج" : "Logged out");
    }
  };

  const handleSelect = (id: AdminTab) => {
    if (!navItems.some((item) => item.id === id)) return;
    setRequestedActive(id);
    setMobileOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  return (
    <>
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
        <NavList
          navItems={navItems}
          secondaryLinks={secondaryLinks}
          active={active}
          onSelect={handleSelect}
        />
        <SidebarFooter t={t} isRTL={isRTL} onLogout={handleLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0 flex flex-col">
          <SheetHeader className="h-16 flex flex-row items-center gap-2.5 px-5 border-b border-sidebar-border m-0">
            <span className="text-2xl">🌶️</span>
            <SheetTitle className="text-sm font-bold">{restaurantName}</SheetTitle>
          </SheetHeader>
          <NavList
            navItems={navItems}
            secondaryLinks={secondaryLinks}
            active={active}
            onSelect={handleSelect}
          />
          <SidebarFooter t={t} isRTL={isRTL} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      <div className="lg:ms-64 flex-1 flex flex-col min-h-screen">
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
              {activeLabel || (isRTL ? "لا توجد أدوات إدارية" : "No admin tools")}
            </h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {restaurantName}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative" aria-label={isRTL ? "الإشعارات" : "Notifications"}>
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
                {user.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold">{user.name}</div>
                <div className="text-[10px] text-muted-foreground">{roleLabel(user.role)}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void handleLogout()}
              className="text-muted-foreground hover:text-destructive"
              title={t.admin.logout}
            >
              <LogOut className={isRTL ? "size-4 rotate-180" : "size-4"} />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {ActiveTab ? (
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
          ) : (
            <AccessNotice isRTL={isRTL} role={user.role} />
          )}
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
  navItems,
  secondaryLinks,
  active,
  onSelect,
}: {
  navItems: AdminNavItem[];
  secondaryLinks: SecondaryLink[];
  active: AdminTab | null;
  onSelect: (id: AdminTab) => void;
}) {
  return (
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scroll-thin">
      {navItems.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
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

      {secondaryLinks.length > 0 && (
        <div className="pt-3 mt-3 border-t border-sidebar-border">
          {secondaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all"
            >
              {item.icon}
              <span className="flex-1 text-start">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

function AccessNotice({ isRTL, role }: { isRTL: boolean; role: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg text-center rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mx-auto size-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
          <ShieldAlert className="size-7" />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {isRTL ? "لا توجد أدوات إدارية مخصصة لهذا الدور" : "No admin tools are assigned to this role"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {isRTL
            ? `تم تسجيل الدخول بدور ${roleLabel(role)}. استخدم شاشة العمل المخصصة لك أو تواصل مع المدير عند الحاجة إلى صلاحية إضافية.`
            : `You are signed in as ${roleLabel(role)}. Use your assigned operational screen or ask a manager when additional access is required.`}
        </p>
        <Button asChild variant="outline">
          <Link href="/">{isRTL ? "العودة للموقع" : "Back to site"}</Link>
        </Button>
      </div>
    </div>
  );
}

function SidebarFooter({
  t,
  isRTL,
  onLogout,
}: {
  t: any;
  isRTL: boolean;
  onLogout: () => void | Promise<void>;
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
        onClick={() => void onLogout()}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 hover:text-destructive text-sm transition-colors"
      >
        <LogOut className={isRTL ? "size-4 rotate-180" : "size-4"} />
        <span>{t.admin.logout}</span>
      </button>
    </div>
  );
}
