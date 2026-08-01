"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Settings2,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  seated: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-900",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-800",
};

function browserDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function loadReservations() {
  const response = await fetch("/api/reservations?limit=500");
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Unable to load reservations");
  return data;
}

export default function AdminReservationsCalendarPage() {
  const { t, isRTL } = useI18n();
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const todayKey = browserDate();
  const today = new Date(`${todayKey}T00:00:00`);
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const query = useQuery({ queryKey: ["reservations-all"], queryFn: loadReservations });
  const reservations: any[] = query.data?.reservations || [];
  const timezone = query.data?.timezone || "UTC";

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const reservation of reservations) {
      const key = reservation.localDate || reservation.dateTime.slice(0, 10);
      (map[key] ||= []).push(reservation);
    }
    return map;
  }, [reservations]);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: Date; key: string; isCurrentMonth: boolean; reservations: any[] }[] = [];

    for (let index = firstDay.getDay() - 1; index >= 0; index -= 1) {
      const date = new Date(year, month, -index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({ date, key, isCurrentMonth: false, reservations: byDate[key] || [] });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ date, key, isCurrentMonth: true, reservations: byDate[key] || [] });
    }
    for (let day = 1; days.length < 42; day += 1) {
      const date = new Date(year, month + 1, day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      days.push({ date, key, isCurrentMonth: false, reservations: byDate[key] || [] });
    }
    return days;
  }, [byDate, viewMonth]);

  const selectedReservations = useMemo(
    () => [...(byDate[selectedDate] || [])].sort((left, right) => left.localTime.localeCompare(right.localTime)),
    [byDate, selectedDate]
  );
  const totalGuests = selectedReservations.reduce((total, reservation) => total + reservation.partySize, 0);
  const upcomingCount = reservations.filter((reservation) => reservation.localDate >= todayKey && reservation.status === "confirmed").length;

  const updateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || t.common.error);
      await queryClient.invalidateQueries({ queryKey: ["reservations-all"] });
      toast.success(isRTL ? "تم تحديث الحجز" : "Reservation updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    }
  };

  const monthName = viewMonth.toLocaleDateString(isRTL ? "ar-IQ" : "en-US", { month: "long", year: "numeric" });
  const weekdayLabels = isRTL ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><Button variant="ghost" size="icon"><Arrow className="size-5" /></Button></Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2"><Calendar className="size-5 text-primary" />{isRTL ? "تقويم الحجوزات" : "Reservations Calendar"}</h1>
              <p className="text-xs text-muted-foreground">{timezone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{(byDate[todayKey] || []).length} {isRTL ? "اليوم" : "today"}</Badge>
            <Badge variant="outline">{upcomingCount} {isRTL ? "قادم" : "upcoming"}</Badge>
            <Link href="/admin/reservation-settings"><Button size="sm" variant="outline"><Settings2 className="size-4 me-1" />{isRTL ? "الإعدادات" : "Settings"}</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {query.isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : query.isError ? (
          <Card><CardContent className="p-5 text-destructive">{query.error.message}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card><CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">{monthName}</h2>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="size-8" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>{isRTL ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }}>{isRTL ? "اليوم" : "Today"}</Button>
                    <Button variant="outline" size="icon" className="size-8" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>{isRTL ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}</Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">{weekdayLabels.map((label) => <div key={label} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{label}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const selected = day.key === selectedDate;
                    const isToday = day.key === todayKey;
                    return <button key={day.key} onClick={() => setSelectedDate(day.key)} className={`aspect-square rounded-lg p-1 flex flex-col items-center text-xs transition-all ${selected ? "bg-primary text-primary-foreground" : day.isCurrentMonth ? "bg-muted/40 hover:bg-muted" : "text-muted-foreground/40"} ${isToday && !selected ? "ring-2 ring-primary/40" : ""}`}><span className="font-semibold">{day.date.getDate()}</span>{day.reservations.length > 0 && <span className={`text-[9px] font-bold px-1.5 rounded-full mt-0.5 ${selected ? "bg-white/20" : "bg-primary/15 text-primary"}`}>{day.reservations.length}</span>}</button>;
                  })}
                </div>
              </CardContent></Card>
            </div>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3"><div><h3 className="font-bold text-sm">{selectedDate}</h3><p className="text-[11px] text-muted-foreground">{selectedReservations.length} {isRTL ? "حجز" : "reservations"} · {totalGuests} {isRTL ? "ضيف" : "guests"}</p></div><Calendar className="size-5 text-muted-foreground" /></div>
              <div className="space-y-2 max-h-[620px] overflow-y-auto pe-1">
                {selectedReservations.length === 0 ? <div className="text-center py-8 text-muted-foreground"><Calendar className="size-8 mx-auto mb-2 opacity-30" />{isRTL ? "لا حجوزات" : "No reservations"}</div> : selectedReservations.map((reservation, index) => (
                  <motion.div key={reservation.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className={`p-3 rounded-xl border ${statusColors[reservation.status] || statusColors.confirmed}`}>
                    <div className="flex items-start justify-between gap-2 mb-2"><div className="flex items-center gap-2"><span className="flex items-center gap-1 text-xs font-bold"><Clock className="size-3" />{reservation.localTime}–{reservation.localEndTime}</span><Badge variant="outline" className="text-[9px]"><Users className="size-2.5 me-0.5" />{reservation.partySize}</Badge></div><span className="text-[10px] font-semibold capitalize">{reservation.status}</span></div>
                    <div className="font-semibold text-sm">{reservation.customerName}</div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 my-1"><span>{reservation.customerPhone}</span>{reservation.table && <span className="flex items-center gap-0.5"><MapPin className="size-2.5" />{isRTL ? "طاولة" : "Table"} {reservation.table.number}</span>}</div>
                    {reservation.status === "confirmed" && <div className="flex gap-1.5 mt-2"><Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateStatus(reservation.id, "seated")}><CheckCircle2 className="size-3 me-1" />{isRTL ? "جلوس" : "Seat"}</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => updateStatus(reservation.id, "no_show")}><UserX className="size-3" /></Button><Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive" onClick={() => updateStatus(reservation.id, "cancelled")}><XCircle className="size-3" /></Button></div>}
                    {reservation.status === "seated" && <div className="flex gap-1.5 mt-2"><Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateStatus(reservation.id, "completed")}><CheckCircle2 className="size-3 me-1" />{isRTL ? "إكمال" : "Complete"}</Button><Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive" onClick={() => updateStatus(reservation.id, "cancelled")}><XCircle className="size-3" /></Button></div>}
                  </motion.div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        )}
      </main>
    </div>
  );
}
