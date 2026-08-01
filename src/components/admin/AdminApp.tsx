"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
      ) : sessionQuery.data?.user ? (
        <AdminShell user={sessionQuery.data.user} />
      ) : (
        <AdminLogin />
      )}
    </div>
  );
}
