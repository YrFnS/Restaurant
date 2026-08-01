"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  CalendarDays,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  seated: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function dateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

export function ReservationsSection() {
  const { t, isRTL, fmtDate, fmtTime } = useI18n();
  const {
    customerPhone,
    customerName,
    recentReservations,
    rememberReservationAccess,
    forgetReservationAccess,
    setActiveSection,
  } = useRestaurantStore();
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const idempotencyKey = useRef<string | null>(null);

  const [form, setForm] = useState({
    name: customerName || "",
    phone: customerPhone || "",
    email: "",
    partySize: 2,
    date: "",
    time: "",
    occasion: "",
    preference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["reservation-public-settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      const data = await response.json();
      if (!response.ok || !data?.settings) throw new Error(t.common.error);
      return data.settings as { timezone?: string };
    },
    staleTime: 5 * 60_000,
  });
  const timezone = settingsQuery.data?.timezone || "UTC";

  useEffect(() => {
    if (!settingsQuery.data || form.date) return;
    setForm((current) => ({
      ...current,
      date: dateInTimezone(timezone),
    }));
  }, [form.date, settingsQuery.data, timezone]);

  const availabilityQuery = useQuery({
    queryKey: [
      "reservation-availability",
      form.date,
      form.partySize,
      form.preference,
    ],
    enabled: Boolean(form.date),
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        date: form.date,
        partySize: String(form.partySize),
      });
      if (form.preference) params.set("preference", form.preference);
      const response = await fetch(`/api/reservations/availability?${params}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.error || t.common.error) as Error & {
          details?: Record<string, string>;
        };
        error.details = data?.details;
        throw error;
      }
      return data as {
        timezone: string;
        policy: {
          earliestDate: string;
          latestDate: string;
          minPartySize: number;
          maxPartySize: number;
          defaultDurationMinutes: number;
        };
        slots: Array<{
          date: string;
          time: string;
          startsAt: string;
          endsAt: string;
          releaseAt: string;
          availableTableCount: number;
          bestCapacity: number;
        }>;
      };
    },
  });
  const availability = availabilityQuery.data;
  const slots = availability?.slots || [];

  useEffect(() => {
    if (!slots.length) {
      if (form.time) setForm((current) => ({ ...current, time: "" }));
      return;
    }
    if (!slots.some((slot) => slot.time === form.time)) {
      setForm((current) => ({ ...current, time: slots[0].time }));
    }
  }, [form.time, slots]);

  useEffect(() => {
    idempotencyKey.current = null;
  }, [
    form.name,
    form.phone,
    form.email,
    form.partySize,
    form.date,
    form.time,
    form.occasion,
    form.preference,
    form.notes,
  ]);

  const credentialsFingerprint = useMemo(
    () => JSON.stringify(recentReservations),
    [recentReservations]
  );
  const reservationsQuery = useQuery({
    queryKey: ["customer-reservations", credentialsFingerprint],
    enabled: recentReservations.length > 0,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/reservations/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservations: recentReservations }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || t.common.error);
      return data;
    },
  });
  const reservations: any[] = reservationsQuery.data?.reservations || [];

  const occasions = [
    { id: "casual", label: t.reservations.occasionCasual },
    { id: "birthday", label: t.reservations.occasionBirthday },
    { id: "anniversary", label: t.reservations.occasionAnniversary },
    { id: "business", label: t.reservations.occasionBusiness },
  ];
  const preferences = [
    { id: "indoor", label: t.reservations.prefIndoor },
    { id: "outdoor", label: t.reservations.prefOutdoor },
    { id: "window", label: t.reservations.prefWindow },
    { id: "bar", label: t.reservations.prefBar },
  ];

  const submit = async () => {
    if (!form.name || !form.phone || !form.date || !form.time) {
      toast.error(isRTL ? "اختر بيانات الحجز والوقت المتاح" : "Complete the booking and select an available time");
      return;
    }

    setSubmitting(true);
    idempotencyKey.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email || null,
          partySize: form.partySize,
          date: form.date,
          time: form.time,
          occasion: form.occasion || null,
          preference: form.preference || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reservation || !data?.accessToken) {
        if (response.status < 500) idempotencyKey.current = null;
        toast.error(data?.error || t.common.error);
        await availabilityQuery.refetch();
        return;
      }

      rememberReservationAccess(data.reservation.id, data.accessToken);
      idempotencyKey.current = null;
      toast.success(t.reservations.bookingConfirmed);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-reservations"] }),
        availabilityQuery.refetch(),
      ]);
    } catch {
      toast.error(t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    const credential = recentReservations.find(
      (reservation) => reservation.id === id
    );
    if (!credential) {
      toast.error(t.common.error);
      return;
    }

    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credential.accessToken}`,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || t.common.error);
        return;
      }
      toast.success(t.reservations.statusCancelled);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-reservations"] }),
        availabilityQuery.refetch(),
      ]);
    } catch {
      toast.error(t.common.error);
    }
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}>
          <Arrow className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="size-6 text-primary" />
            {t.reservations.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.reservations.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.reservations.yourName}>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} dir="auto" />
              </Field>
              <Field label={t.reservations.phone}>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} dir="ltr" />
              </Field>
            </div>

            <Field label={t.reservations.email}>
              <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} dir="ltr" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.reservations.partySize} icon={<Users className="size-3" />}>
                <Input
                  type="number"
                  min={availability?.policy.minPartySize || 1}
                  max={availability?.policy.maxPartySize || 100}
                  value={form.partySize}
                  onChange={(event) =>
                    setForm({ ...form, partySize: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </Field>
              <Field label={t.reservations.date}>
                <Input
                  type="date"
                  value={form.date}
                  min={availability?.policy.earliestDate || dateInTimezone(timezone)}
                  max={availability?.policy.latestDate}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </Field>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1"><Clock className="size-3" />{t.reservations.time}</span>
                <span className="font-normal">{timezone}</span>
              </label>
              {availabilityQuery.isFetching ? (
                <div className="h-24 flex items-center justify-center rounded-xl border border-dashed">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : availabilityQuery.isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="text-destructive mb-2">{availabilityQuery.error.message}</p>
                  <Button size="sm" variant="outline" onClick={() => availabilityQuery.refetch()}>
                    <RefreshCw className="size-3 me-1" />{isRTL ? "إعادة المحاولة" : "Retry"}
                  </Button>
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {isRTL ? "لا توجد أوقات متاحة لهذا التاريخ وحجم المجموعة" : "No times are available for this date and party size"}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setForm({ ...form, time: slot.time })}
                      className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                        form.time === slot.time
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent hover:bg-accent/70"
                      }`}
                    >
                      <span className="block">{slot.time}</span>
                      <span className="block text-[9px] opacity-70">
                        {slot.availableTableCount} {isRTL ? "متاح" : "available"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ChoiceGroup label={t.reservations.occasion} items={occasions} selected={form.occasion} onSelect={(occasion) => setForm({ ...form, occasion })} />
            <ChoiceGroup label={t.reservations.preference} items={preferences} selected={form.preference} onSelect={(preference) => setForm({ ...form, preference })} />

            <Textarea placeholder={t.reservations.notesPlaceholder} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} dir="auto" />
            <Button onClick={submit} disabled={submitting || availabilityQuery.isFetching || !form.time} className="w-full h-12 text-base gap-2">
              {submitting ? <Loader2 className="size-5 animate-spin" /> : <CalendarDays className="size-5" />}
              {submitting ? "..." : t.reservations.book}
            </Button>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-lg">{t.reservations.yourReservations}</h2>
            <span className="text-[11px] text-muted-foreground">
              {isRTL ? "محفوظة بأمان على هذا الجهاز" : "Securely saved on this device"}
            </span>
          </div>

          {reservationsQuery.isError && (
            <Card className="mb-3"><CardContent className="p-4 text-sm text-destructive">{reservationsQuery.error.message}</CardContent></Card>
          )}

          {reservations.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground"><CalendarDays className="size-10 mx-auto mb-2 opacity-30" />{t.reservations.noReservations}</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {reservations.map((reservation, index) => (
                <motion.div key={reservation.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{reservation.localDate || fmtDate(reservation.dateTime)}</span>
                            <span className="text-sm text-muted-foreground">{reservation.localTime || fmtTime(reservation.dateTime)}–{reservation.localEndTime || fmtTime(reservation.endsAt)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <Users className="size-3" />{reservation.partySize} {t.reservations.guests}
                            {reservation.table && <span>· {t.orders.table} {reservation.table.number}</span>}
                            {reservation.occasion && <span>· {reservation.occasion}</span>}
                          </p>
                        </div>
                        <Badge className={statusColors[reservation.status] || ""}>
                          {(t.reservations as any)[`status${reservation.status.charAt(0).toUpperCase()}${reservation.status.slice(1)}`] || reservation.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {reservation.status === "confirmed" && (
                          <Button size="sm" variant="ghost" onClick={() => cancel(reservation.id)} className="text-destructive text-xs gap-1">
                            <X className="size-3" />{t.reservations.cancel}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs gap-1 ms-auto" onClick={() => forgetReservationAccess(reservation.id)}>
                          <Trash2 className="size-3" />{isRTL ? "إخفاء" : "Hide"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">{icon}{label}</label>{children}</div>;
}

function ChoiceGroup({ label, items, selected, onSelect }: { label: React.ReactNode; items: Array<{ id: string; label: string }>; selected: string; onSelect: (value: string) => void }) {
  return <div><label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label><div className="flex flex-wrap gap-1.5">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(selected === item.id ? "" : item.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${selected === item.id ? "bg-primary text-primary-foreground" : "bg-accent"}`}>{item.label}</button>)}</div></div>;
}
