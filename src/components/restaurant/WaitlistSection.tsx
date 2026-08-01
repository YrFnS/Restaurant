"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Clock,
  Hourglass,
  ShieldCheck,
  Users,
} from "lucide-react";

export function WaitlistSection() {
  const { t, isRTL } = useI18n();
  const {
    customerPhone,
    customerName,
    waitlistAccess,
    rememberWaitlistAccess,
    clearWaitlistAccess,
    setActiveSection,
  } = useRestaurantStore();
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const [form, setForm] = useState({
    name: customerName || "",
    phone: customerPhone || "",
    partySize: 2,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const waitlistQuery = useQuery({
    queryKey: [
      "customer-waitlist",
      waitlistAccess?.id,
      waitlistAccess?.accessToken,
    ],
    retry: false,
    refetchInterval: 15_000,
    queryFn: async () => {
      const query = waitlistAccess
        ? `?id=${encodeURIComponent(
            waitlistAccess.id
          )}&token=${encodeURIComponent(waitlistAccess.accessToken)}`
        : "";
      const response = await fetch(`/api/waitlist${query}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (response.status === 404 && waitlistAccess) {
        clearWaitlistAccess();
        return { entry: null, position: 0, waitingCount: data?.waitingCount || 0 };
      }
      if (!response.ok) {
        throw new Error(data?.error || t.common.error);
      }
      return data;
    },
  });

  const myEntry = waitlistQuery.data?.entry || null;
  const position = waitlistQuery.data?.position || 0;
  const waitingCount = waitlistQuery.data?.waitingCount || 0;

  const join = async () => {
    if (!form.name || !form.phone) {
      toast.error(t.waitlist.yourName);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          partySize: form.partySize,
          notes: form.notes || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.entry || !data?.accessToken) {
        toast.error(data?.error || t.common.error);
        return;
      }

      rememberWaitlistAccess(data.entry.id, data.accessToken);
      toast.success(t.waitlist.joined);
      await queryClient.invalidateQueries({ queryKey: ["customer-waitlist"] });
    } catch {
      toast.error(t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const leave = async () => {
    if (!waitlistAccess || !myEntry) return;

    try {
      const response = await fetch(
        `/api/waitlist/${encodeURIComponent(
          myEntry.id
        )}?token=${encodeURIComponent(waitlistAccess.accessToken)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || t.common.error);
        return;
      }

      clearWaitlistAccess();
      toast.success(t.waitlist.statusCancelled);
      await queryClient.invalidateQueries({ queryKey: ["customer-waitlist"] });
    } catch {
      toast.error(t.common.error);
    }
  };

  const activeEntry =
    myEntry && ["waiting", "notified"].includes(myEntry.status)
      ? myEntry
      : null;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveSection("home")}
        >
          <Arrow className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hourglass className="size-6 text-primary" />
            {t.waitlist.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.waitlist.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {activeEntry ? (
            <Card className="bg-gradient-to-br from-primary/10 to-accent/40 border-primary/20">
              <CardContent className="p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mx-auto mb-4"
                >
                  {position}
                </motion.div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{t.waitlist.yourSpot}</h3>
                  {activeEntry.status === "notified" && (
                    <Badge className="gap-1">
                      <Bell className="size-3" />
                      {isRTL ? "حان دورك" : "Your table is ready"}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.waitlist.partyAhead.replace(
                    "{count}",
                    String(Math.max(0, position - 1))
                  )}
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background mb-4">
                  <Clock className="size-4 text-primary" />
                  <span className="text-sm font-medium">
                    {t.waitlist.estimatedWait}: {activeEntry.estimatedWait}{" "}
                    {t.waitlist.minutes}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={leave}
                  className="w-full text-destructive gap-2"
                >
                  <ArrowLeft className="size-4" />
                  {t.waitlist.leaveQueue}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      {t.waitlist.yourName}
                    </label>
                    <Input
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      dir="auto"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      {t.waitlist.phone}
                    </label>
                    <Input
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <Users className="size-3" />
                    {t.waitlist.partySize}
                  </label>
                  <div className="flex items-center gap-1 border rounded-xl p-1 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((partySize) => (
                      <button
                        key={partySize}
                        onClick={() => setForm({ ...form, partySize })}
                        className={`size-9 rounded-lg text-sm font-medium ${
                          form.partySize === partySize
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        {partySize}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder={t.waitlist.notes}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  rows={2}
                  dir="auto"
                />
                <Button
                  onClick={join}
                  disabled={submitting}
                  className="w-full h-12 text-base gap-2"
                >
                  <Hourglass className="size-5" />
                  {submitting ? "..." : t.waitlist.join}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Users className="size-5 text-primary" />
            {t.waitlist.currentWait}
          </h2>
          <Card>
            <CardContent className="p-8 text-center">
              <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold mx-auto mb-3">
                {waitingCount}
              </div>
              <p className="font-semibold">
                {waitingCount === 0
                  ? t.waitlist.noWaitlist
                  : isRTL
                    ? `${waitingCount} مجموعات تنتظر حالياً`
                    : `${waitingCount} parties are currently waiting`}
              </p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                {isRTL
                  ? "أسماء وأرقام العملاء لا تظهر للعامة"
                  : "Guest names and phone numbers remain private"}
              </p>
            </CardContent>
          </Card>

          {waitlistQuery.isError && (
            <p className="text-sm text-destructive mt-3">
              {waitlistQuery.error instanceof Error
                ? waitlistQuery.error.message
                : t.common.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
