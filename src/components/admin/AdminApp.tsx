"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, RotateCcw } from "lucide-react";
import { useRestaurantStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { AdminLogin } from "./AdminLogin";
import { AdminShell } from "./AdminShell";

export interface AuthenticatedStaffUser {
  id: string;
  name: string;
  role: string;
}

interface AuthSessionResponse {
  user: AuthenticatedStaffUser | null;
}

const PAYMENT_REVERSAL_ROLES = new Set(["owner", "admin", "manager"]);
const LOYALTY_ROLES = new Set(["owner", "admin", "manager", "cashier"]);

export function AdminApp() {
  const { isRTL } = useI18n();
  const setStaff = useRestaurantStore((state) => state.setStaff);
  const clearStaff = useRestaurantStore((state) => state.clearStaff);

  const sessionQuery = useQuery<AuthSessionResponse | null>({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Unable to validate staff session");
      return response.json();
    },
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (sessionQuery.data?.user) {
      setStaff(sessionQuery.data.user.name);
    } else if (sessionQuery.data === null) {
      clearStaff();
    }
  }, [sessionQuery.data, setStaff, clearStaff]);

  const user = sessionQuery.data?.user || null;
  const canReversePayments = PAYMENT_REVERSAL_ROLES.has(user?.role || "");
  const canManageLoyalty = LOYALTY_ROLES.has(user?.role || "");

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-background text-foreground"
      suppressHydrationWarning
    >
      {sessionQuery.isPending ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>{isRTL ? "جارٍ التحقق من الجلسة" : "Checking staff session"}</span>
        </div>
      ) : sessionQuery.isError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-medium">
            {isRTL ? "تعذر التحقق من جلسة الموظف" : "Unable to verify the staff session"}
          </p>
          <button
            type="button"
            onClick={() => void sessionQuery.refetch()}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            {isRTL ? "إعادة المحاولة" : "Try again"}
          </button>
        </div>
      ) : user ? (
        <>
          <AdminShell user={user} />
          {(canManageLoyalty || canReversePayments) && (
            <div className="fixed z-40 bottom-5 end-5 flex flex-col items-end gap-2">
              {canManageLoyalty && (
                <Link
                  href="/admin/loyalty"
                  className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={
                    isRTL
                      ? "فتح إدارة الولاء وبطاقات الهدايا"
                      : "Open loyalty and gift-card management"
                  }
                >
                  <Gift className="size-4 text-primary" />
                  <span className="hidden sm:inline">
                    {isRTL ? "الولاء والبطاقات" : "Loyalty & cards"}
                  </span>
                </Link>
              )}
              {canReversePayments && (
                <Link
                  href="/admin/payment-reversals"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={
                    isRTL
                      ? "فتح إدارة استرجاع وإلغاء المدفوعات"
                      : "Open payment refunds and voids"
                  }
                >
                  <RotateCcw className="size-4" />
                  <span className="hidden sm:inline">
                    {isRTL ? "استرجاع المدفوعات" : "Payment reversals"}
                  </span>
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <AdminLogin />
      )}
    </div>
  );
}
