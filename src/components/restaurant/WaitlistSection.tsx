"use client";

import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  ShieldCheck,
  Users,
} from "lucide-react";

function formatProjectedTime(value: string | null | undefined, timezone: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

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
    preference: "any",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [joinKey, setJoinKey] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const waitlistQuery = useQuery({
    queryKey: [
      "customer-waitlist",
      waitlistAccess?.id,
      waitlistAccess?.accessToken,
    ],
    retry: false,
    refetchInterval: 10_000,
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
        return {
          entry: null,
          position: 0,
          waitingCount: data?.waitingCount || 0,
          policy: data?.policy || null,
        };
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
  const policy = waitlistQuery.data?.policy || {
    enabled: true,
    isOpenNow: true,
    timezone: "UTC",
    minPartySize: 1,
    maxPartySize: 8,
    notificationExpiryMinutes: 10,
    requireConfirmation: true,
  };

  useEffect(() => {
    setForm((current) => ({
      ...current,
      partySize: Math.min(
        Math.max(current.partySize, policy.minPartySize || 1),
        policy.maxPartySize || 8
      ),
    }));
  }, [policy.maxPartySize, policy.minPartySize]);

  const partySizes = useMemo(() => {
    const minimum = Math.max(1, policy.minPartySize || 1);
    const maximum = Math.min(12, policy.maxPartySize || 8);
    return Array.from(
      { length: Math.max(0, maximum - minimum + 1) },
      (_, index) => minimum + index
    );
  }, [policy.maxPartySize, policy.minPartySize]);

  const join = async () => {
    if (!form.name || !form.phone) {
      toast.error(t.waitlist.yourName);
      return;
    }
    if (!policy.enabled || !policy.isOpenNow) {
      toast.error(
        isRTL
          ? "قائمة الانتظار غير متاحة حالياً"
          : "The waitlist is not available right now"
      );
      return;
    }

    const requestKey = joinKey || crypto.randomUUID();
    if (!joinKey) setJoinKey(requestKey);
    setSubmitting(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `waitlist-${requestKey}`,
        },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          partySize: form.partySize,
          preference: form.preference,
          notes: form.notes || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.entry || !data?.accessToken) {
        toast.error(data?.error || t.common.error);
        return;
      }

      rememberWaitlistAccess(data.entry.id, data.accessToken);
      setJoinKey("");
      toast.success(t.waitlist.joined);
      await queryClient.invalidateQueries({ queryKey: ["customer-waitlist"] });
    } catch {
      toast.error(t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const mutateEntry = async (
    action: "confirm" | "cancel",
    setBusy?: (value: boolean) => void
  ) => {
    if (!waitlistAccess || !myEntry) return;
    setBusy?.(true);
    try {
      const response = await fetch(
        `/api/waitlist/${encodeURIComponent(
          myEntry.id
        )}?token=${encodeURIComponent(waitlistAccess.accessToken)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || t.common.error);
        return;
      }

      if (action === "cancel") {
        clearWaitlistAccess();
        toast.success(t.waitlist.statusCancelled);
      } else {
        toast.success(
          isRTL ? "تم تأكيد حضورك" : "Your arrival is confirmed"
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["customer-waitlist"] });
    } catch {
      toast.error(t.common.error);
    } finally {
      setBusy?.(false);
    }
  };

  const activeEntry =
    myEntry && ["waiting", "notified"].includes(myEntry.status)
      ? myEntry
      : null;
  const isNotified = activeEntry?.status === "notified";
  const isConfirmed = Boolean(activeEntry?.notificationConfirmedAt);
  const expiresInSeconds = activeEntry?.notificationExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeEntry.notificationExpiresAt).getTime() - now) / 1_000
        )
      )
    : 0;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.common.back}
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

      {!policy.enabled || !policy.isOpenNow ? (
        <Card className="mb-6 border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="size-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-semibold">
                {isRTL
                  ? "قائمة الانتظار مغلقة حالياً"
                  : "The waitlist is currently closed"}
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "يمكن الانضمام خلال فترات خدمة المطعم وعندما لا توجد فترة إغلاق مجدولة."
                  : "Joining is available during restaurant service periods when no closure is active."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div>
          {activeEntry ? (
            <Card className="bg-gradient-to-br from-primary/10 to-accent/40 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mx-auto mb-4"
                  >
                    {isNotified ? <Bell className="size-8" /> : position}
                  </motion.div>
                  <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-lg">
                      {isNotified
                        ? isRTL
                          ? "طاولتك جاهزة"
                          : "Your table is ready"
                        : t.waitlist.yourSpot}
                    </h3>
                    {isNotified && (
                      <Badge className="gap-1">
                        <Bell className="size-3" />
                        {isConfirmed
                          ? isRTL
                            ? "تم التأكيد"
                            : "Confirmed"
                          : isRTL
                            ? "بانتظار تأكيدك"
                            : "Confirmation needed"}
                      </Badge>
                    )}
                  </div>
                  {!isNotified && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.waitlist.partyAhead.replace(
                        "{count}",
                        String(Math.max(0, position - 1))
                      )}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 my-5">
                  <div className="rounded-xl bg-background/80 border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {t.waitlist.estimatedWait}
                    </div>
                    <div className="font-bold mt-1">
                      {isNotified
                        ? isRTL
                          ? "الآن"
                          : "Now"
                        : `${activeEntry.estimatedWait} ${t.waitlist.minutes}`}
                    </div>
                  </div>
                  <div className="rounded-xl bg-background/80 border p-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" />
                      {isRTL ? "الوقت المتوقع" : "Projected seating"}
                    </div>
                    <div className="font-bold mt-1">
                      {formatProjectedTime(
                        activeEntry.estimatedSeatAt,
                        policy.timezone
                      )}
                    </div>
                  </div>
                </div>

                {isNotified && (
                  <div className="rounded-xl border bg-background/90 p-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {isRTL ? "الطاولة المحجوزة" : "Held table"}
                        </div>
                        <div className="font-bold">
                          {activeEntry.table
                            ? `#${activeEntry.table.number} · ${activeEntry.table.section}`
                            : "—"}
                        </div>
                      </div>
                      <Badge variant={expiresInSeconds > 60 ? "secondary" : "destructive"}>
                        {Math.floor(expiresInSeconds / 60)}:
                        {String(expiresInSeconds % 60).padStart(2, "0")}
                      </Badge>
                    </div>
                    {!isConfirmed && policy.requireConfirmation && (
                      <Button
                        onClick={() =>
                          void mutateEntry("confirm", setConfirming)
                        }
                        disabled={confirming || expiresInSeconds <= 0}
                        className="w-full gap-2"
                      >
                        <CheckCircle2 className="size-4" />
                        {confirming
                          ? "..."
                          : isRTL
                            ? "تأكيد أنني قادم"
                            : "Confirm I am coming"}
                      </Button>
                    )}
                    {isConfirmed && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="size-4" />
                        {isRTL
                          ? "تم تأكيد حضورك. توجّه إلى المضيف قبل انتهاء المهلة."
                          : "Arrival confirmed. Please see the host before the hold expires."}
                      </p>
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => void mutateEntry("cancel")}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="waitlist-name"
                      className="text-xs font-semibold text-muted-foreground mb-1 block"
                    >
                      {t.waitlist.yourName}
                    </label>
                    <Input
                      id="waitlist-name"
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      dir="auto"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="waitlist-phone"
                      className="text-xs font-semibold text-muted-foreground mb-1 block"
                    >
                      {t.waitlist.phone}
                    </label>
                    <Input
                      id="waitlist-phone"
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
                    {partySizes.map((partySize) => (
                      <button
                        key={partySize}
                        type="button"
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
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    {isRTL ? "تفضيل الجلوس" : "Seating preference"}
                  </label>
                  <Select
                    value={form.preference}
                    onValueChange={(preference) =>
                      setForm({ ...form, preference })
                    }
                  >
                    <SelectTrigger
                      aria-label={
                        isRTL ? "تفضيل الجلوس" : "Seating preference"
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">
                        {isRTL ? "أي مكان" : "Any section"}
                      </SelectItem>
                      <SelectItem value="indoor">
                        {isRTL ? "داخلي" : "Indoor"}
                      </SelectItem>
                      <SelectItem value="outdoor">
                        {isRTL ? "خارجي" : "Outdoor"}
                      </SelectItem>
                      <SelectItem value="bar">
                        {isRTL ? "البار" : "Bar"}
                      </SelectItem>
                      <SelectItem value="private">
                        {isRTL ? "خاص" : "Private"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                  onClick={() => void join()}
                  disabled={submitting || !policy.enabled || !policy.isOpenNow}
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
                    ? `${waitingCount} مجموعات نشطة حالياً`
                    : `${waitingCount} active parties`}
              </p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                {isRTL
                  ? "التقدير يعتمد على حجم المجموعة والطاولات والحجوزات"
                  : "Quotes use party size, table capacity, and reservations"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {isRTL ? "المنطقة الزمنية" : "Restaurant timezone"}: {policy.timezone}
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
