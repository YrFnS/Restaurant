"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Calendar, ChevronLeft, ChevronRight,
  Users, Clock, Phone, User, MapPin, CheckCircle2, XCircle, Utensils,
} from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  seated: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-900",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-800",
};

export default function AdminReservationsCalendarPage() {
  const { t, isRTL, fmtTime } = useI18n();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split("T")[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["reservations-all"],
    queryFn: async () => (await fetch("/api/reservations")).json(),
  });
  const reservations: any[] = data?.reservations || [];

  // Group reservations by date
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    reservations.forEach((r) => {
      const d = new Date(r.dateTime).toISOString().split("T")[0];
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [reservations]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay(); // 0=Sunday
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; isCurrentMonth: boolean; reservations: any[] }[] = [];
    // Previous month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, reservations: byDate[d.toISOString().split("T")[0]] || [] });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, reservations: byDate[d.toISOString().split("T")[0]] || [] });
    }
    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, reservations: byDate[d.toISOString().split("T")[0]] || [] });
    }
    return days;
  }, [viewMonth, byDate]);

  const selectedReservations = (byDate[selectedDate] || []).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const monthName = viewMonth.toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "long", year: "numeric" });
  const weekdayLabels = isRTL
    ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      qc.invalidateQueries({ queryKey: ["reservations-all"] });
      toast.success(status === "seated" ? (isRTL ? "تم الجلوس" : "Seated") : status === "completed" ? (isRTL ? "مكتمل" : "Completed") : (isRTL ? "ملغى" : "Cancelled"));
    } catch {
      toast.error(t.common.error);
    }
  };

  // Stats
  const todayCount = (byDate[today.toISOString().split("T")[0]] || []).length;
  const upcomingCount = reservations.filter((r) => new Date(r.dateTime) >= today && r.status === "confirmed").length;
  const totalGuests = selectedReservations.reduce((s, r) => s + r.partySize, 0);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Calendar className="size-5 text-primary" />
                {isRTL ? "تقويم الحجوزات" : "Reservations Calendar"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "عرض الحجوزات بالتقويم" : "Calendar view of all reservations"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">{todayCount} {isRTL ? "اليوم" : "today"}</Badge>
            <Badge variant="outline" className="gap-1">{upcomingCount} {isRTL ? "قادم" : "upcoming"}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-4">
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg">{monthName}</h2>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                      >
                        {isRTL ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => { setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today.toISOString().split("T")[0]); }}
                      >
                        {isRTL ? "اليوم" : "Today"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                      >
                        {isRTL ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {weekdayLabels.map((d) => (
                      <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      const dateStr = day.date.toISOString().split("T")[0];
                      const isSelected = dateStr === selectedDate;
                      const isToday = dateStr === today.toISOString().split("T")[0];
                      const count = day.reservations.length;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start text-xs transition-all relative ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : day.isCurrentMonth
                              ? "bg-muted/40 hover:bg-muted"
                              : "bg-transparent text-muted-foreground/40"
                          } ${isToday && !isSelected ? "ring-2 ring-primary/40" : ""}`}
                        >
                          <span className={`font-semibold ${isToday && !isSelected ? "text-primary" : ""}`}>
                            {day.date.getDate()}
                          </span>
                          {count > 0 && (
                            <div className="flex items-center justify-center mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 rounded-full ${
                                isSelected ? "bg-white/20 text-primary-foreground" : "bg-primary/15 text-primary"
                              }`}>
                                {count}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Selected day reservations */}
            <div>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm">
                        {new Date(selectedDate).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { weekday: "long", month: "short", day: "numeric" })}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedReservations.length} {isRTL ? "حجز" : "reservations"} · {totalGuests} {isRTL ? "ضيف" : "guests"}
                      </p>
                    </div>
                    <Calendar className="size-5 text-muted-foreground" />
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto scroll-thin pe-1">
                    {selectedReservations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="size-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{isRTL ? "لا حجوزات" : "No reservations"}</p>
                      </div>
                    ) : (
                      selectedReservations.map((r, idx) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-3 rounded-xl border ${statusColors[r.status] || statusColors.confirmed}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs font-bold">
                                <Clock className="size-3" />
                                {fmtTime(r.dateTime)}
                              </div>
                              <Badge variant="outline" className="text-[9px] gap-0.5">
                                <Users className="size-2.5" />
                                {r.partySize}
                              </Badge>
                            </div>
                            <span className="text-[10px] font-semibold capitalize">{r.status}</span>
                          </div>
                          <div className="font-semibold text-sm mb-1">{r.customerName}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                            <span className="flex items-center gap-0.5"><Phone className="size-2.5" />{r.customerPhone}</span>
                            {r.occasion && <span className="flex items-center gap-0.5"><Utensils className="size-2.5" />{r.occasion}</span>}
                          </div>
                          {r.status === "confirmed" && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="default" className="h-7 text-[10px] flex-1 gap-1" onClick={() => updateStatus(r.id, "seated")}>
                                <CheckCircle2 className="size-3" />
                                {isRTL ? "جلوس" : "Seat"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900" onClick={() => updateStatus(r.id, "cancelled")}>
                                <XCircle className="size-3" />
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
