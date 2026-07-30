"use client";

import { useMemo, useState } from "react";
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

  const [form, setForm] = useState({
    name: customerName || "",
    phone: customerPhone || "",
    email: "",
    partySize: 2,
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    occasion: "",
    preference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

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
      if (!response.ok) {
        throw new Error(data?.error || t.common.error);
      }
      return data;
    },
  });
  const reservations: any[] = reservationsQuery.data?.reservations || [];

  const times = [
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
  ];
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
    if (!form.name || !form.phone) {
      toast.error(t.reservations.yourName);
      return;
    }

    const localDateTime = new Date(`${form.date}T${form.time}:00`);
    if (Number.isNaN(localDateTime.getTime())) {
      toast.error(t.common.error);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email || null,
          partySize: form.partySize,
          dateTime: localDateTime.toISOString(),
          occasion: form.occasion || null,
          preference: form.preference || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.reservation || !data?.accessToken) {
        toast.error(data?.error || t.common.error);
        return;
      }

      rememberReservationAccess(data.reservation.id, data.accessToken);
      toast.success(t.reservations.bookingConfirmed);
      await queryClient.invalidateQueries({
        queryKey: ["customer-reservations"],
      });
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
      const response = await fetch(
        `/api/reservations/${encodeURIComponent(id)}?token=${encodeURIComponent(
          credential.accessToken
        )}`,
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
      toast.success(t.reservations.statusCancelled);
      await queryClient.invalidateQueries({
        queryKey: ["customer-reservations"],
      });
    } catch {
      toast.error(t.common.error);
    }
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
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
            <CalendarDays className="size-6 text-primary" />
            {t.reservations.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.reservations.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {t.reservations.yourName}
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
                  {t.reservations.phone}
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
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t.reservations.email}
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Users className="size-3" />
                  {t.reservations.partySize}
                </label>
                <div className="flex items-center gap-1 border rounded-xl p-1 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((partySize) => (
                    <button
                      key={partySize}
                      onClick={() => setForm({ ...form, partySize })}
                      className={`size-9 rounded-lg text-sm font-medium transition-colors ${
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
                  {t.reservations.date}
                </label>
                <Input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(event) =>
                    setForm({ ...form, date: event.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="size-3" />
                {t.reservations.time}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {times.map((time) => (
                  <button
                    key={time}
                    onClick={() => setForm({ ...form, time })}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      form.time === time
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent hover:bg-accent/70"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t.reservations.occasion}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {occasions.map((occasion) => (
                  <button
                    key={occasion.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        occasion:
                          form.occasion === occasion.id ? "" : occasion.id,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      form.occasion === occasion.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent"
                    }`}
                  >
                    {occasion.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t.reservations.preference}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {preferences.map((preference) => (
                  <button
                    key={preference.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        preference:
                          form.preference === preference.id
                            ? ""
                            : preference.id,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      form.preference === preference.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent"
                    }`}
                  >
                    {preference.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder={t.reservations.notesPlaceholder}
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              rows={2}
              dir="auto"
            />
            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 text-base gap-2"
            >
              <CalendarDays className="size-5" />
              {submitting ? "..." : t.reservations.book}
            </Button>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-lg">
              {t.reservations.yourReservations}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {isRTL ? "محفوظة بأمان على هذا الجهاز" : "Securely saved on this device"}
            </span>
          </div>

          {reservationsQuery.isError && (
            <Card className="mb-3">
              <CardContent className="p-4 text-sm text-destructive">
                {reservationsQuery.error instanceof Error
                  ? reservationsQuery.error.message
                  : t.common.error}
              </CardContent>
            </Card>
          )}

          {reservations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <CalendarDays className="size-10 mx-auto mb-2 opacity-30" />
                {t.reservations.noReservations}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reservations.map((reservation, index) => (
                <motion.div
                  key={reservation.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">
                              {fmtDate(reservation.dateTime)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {fmtTime(reservation.dateTime)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <Users className="size-3" />
                            {reservation.partySize} {t.reservations.guests}
                            {reservation.table && (
                              <span>· {t.orders.table} {reservation.table.number}</span>
                            )}
                            {reservation.occasion && (
                              <span>· {reservation.occasion}</span>
                            )}
                          </p>
                        </div>
                        <Badge className={statusColors[reservation.status] || ""}>
                          {(t.reservations as any)[
                            `status${reservation.status.charAt(0).toUpperCase()}${reservation.status.slice(1)}`
                          ] || reservation.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {reservation.status === "confirmed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(reservation.id)}
                            className="text-destructive text-xs gap-1"
                          >
                            <X className="size-3" />
                            {t.reservations.cancel}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={
                            isRTL ? "إزالة من الجهاز" : "Remove from this device"
                          }
                          onClick={() =>
                            forgetReservationAccess(reservation.id)
                          }
                          className="ms-auto size-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
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
