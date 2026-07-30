"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, Lock, ArrowLeft, Languages, ShieldCheck, KeyRound,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export function AdminLogin() {
  const { t, isRTL, toggleLocale, locale } = useI18n();
  const setStaff = useRestaurantStore((state) => state.setStaff);
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error(t.admin.loginError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.user) {
        toast.error(data?.error || t.admin.loginError);
        return;
      }

      setPin("");
      setStaff(data.user.name);
      queryClient.setQueryData(["auth-session"], data);
      toast.success(`${t.admin.welcome}, ${data.user.name}`);

      const nextPath = searchParams.get("next");
      if (
        nextPath &&
        nextPath.startsWith("/") &&
        !nextPath.startsWith("//")
      ) {
        router.replace(nextPath);
        router.refresh();
      }
    } catch {
      toast.error(t.admin.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-50">
        <div className="absolute -top-32 -start-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -end-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-border/60 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 size-16 rounded-2xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-3xl">🌶️</span>
            </div>
            <CardTitle className="text-2xl font-bold">
              {isRTL ? "زعفران وبهارات" : "Saffron & Spice"}
            </CardTitle>
            <CardDescription className="text-base font-medium">
              {t.admin.login}
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-1">{t.admin.loginDesc}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="staff-pin" className="text-sm font-medium flex items-center gap-1.5">
                <KeyRound className="size-4 text-primary" />
                {t.admin.pin}
              </label>
              <Input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                autoFocus
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                onKeyDown={(event) => event.key === "Enter" && void submit()}
                placeholder="••••"
                className="text-center text-2xl tracking-[0.5em] font-bold h-14"
                dir="ltr"
              />
            </div>

            <Button
              onClick={() => void submit()}
              disabled={loading || pin.length < 4}
              size="lg"
              className="w-full h-12 text-base"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ShieldCheck className="size-5" />
              )}
              {t.admin.login}
            </Button>

            <div className="flex items-center justify-between pt-3 border-t">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowLeft className={isRTL ? "size-4 rotate-180" : "size-4"} />
                  {t.common.back}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLocale}
                className="gap-1.5"
              >
                <Languages className="size-4" />
                {locale === "en" ? "العربية" : "English"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
          <Lock className="size-3" />
          {isRTL ? "محمية بجلسة آمنة للموظفين" : "Protected by a secure staff session"}
        </p>
      </motion.div>
    </div>
  );
}
