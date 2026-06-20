"use client";

import { useRestaurantStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

export function AdminApp() {
  const { isRTL } = useI18n();
  const staffPin = useRestaurantStore((s) => s.staffPin);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-background text-foreground"
      suppressHydrationWarning
    >
      {!staffPin ? <AdminLogin /> : <AdminShell />}
    </div>
  );
}
