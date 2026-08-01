"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

const dayNamesEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayNamesAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function ReservationSettingsPage() {
  const { isRTL, t } = useI18n();
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const query = useQuery({
    queryKey: ["reservation-settings"],
    queryFn: () => api("/api/reservation-settings"),
  });
  const data = query.data;
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policy, setPolicy] = useState({
    minNoticeMinutes: 60,
    maxAdvanceDays: 365,
    defaultDurationMinutes: 90,
    turnoverMinutes: 15,
    slotIntervalMinutes: 30,
    minPartySize: 1,
    maxPartySize: 12,
    customerCancelCutoffMinutes: 120,
  });
  const [period, setPeriod] = useState({
    dayOfWeek: 0,
    opensAt: "10:00",
    closesAt: "23:00",
    label: "",
  });
  const [closure, setClosure] = useState({
    localStart: "",
    localEnd: "",
    reason: "",
  });

  useEffect(() => {
    if (!data?.policy) return;
    const { timezone: _timezone, ...editable } = data.policy;
    setPolicy(editable);
  }, [data]);

  const periodsByDay = useMemo(() => {
    const result: Record<number, any[]> = {};
    for (let day = 0; day <= 6; day += 1) result[day] = [];
    for (const entry of data?.periods || []) result[entry.dayOfWeek].push(entry);
    return result;
  }, [data?.periods]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["reservation-settings"] });

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      await api("/api/reservation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      toast.success(isRTL ? "تم حفظ سياسة الحجوزات" : "Reservation policy saved");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setSavingPolicy(false);
    }
  };

  const addPeriod = async () => {
    try {
      await api("/api/reservation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "period", ...period, isActive: true }),
      });
      toast.success(isRTL ? "تمت إضافة فترة الخدمة" : "Service period added");
      setPeriod((current) => ({ ...current, label: "" }));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    }
  };

  const addClosure = async () => {
    try {
      await api("/api/reservation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "closure", ...closure }),
      });
      toast.success(isRTL ? "تمت إضافة الإغلاق" : "Closure added");
      setClosure({ localStart: "", localEnd: "", reason: "" });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    }
  };

  const remove = async (type: "period" | "closure", id: string) => {
    try {
      const params = new URLSearchParams({ type, id });
      await api(`/api/reservation-settings?${params}`, { method: "DELETE" });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    }
  };

  if (query.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/reservations-calendar"><Button variant="ghost" size="icon"><Arrow className="size-5" /></Button></Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2"><CalendarClock className="size-5 text-primary" />{isRTL ? "إعدادات الحجوزات" : "Reservation Settings"}</h1>
              <p className="text-xs text-muted-foreground">{isRTL ? "السعة، الأوقات، والإغلاقات" : "Capacity, service periods, and closures"}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{data?.policy?.timezone}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {query.isError && <Card><CardContent className="p-4 text-destructive">{query.error.message}</CardContent></Card>}

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock3 className="size-4 text-primary" />{isRTL ? "سياسة الحجز" : "Booking Policy"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <NumberField label={isRTL ? "أقل إشعار (دقيقة)" : "Minimum notice (min)"} value={policy.minNoticeMinutes} onChange={(value) => setPolicy({ ...policy, minNoticeMinutes: value })} />
              <NumberField label={isRTL ? "أقصى حجز مسبق (يوم)" : "Maximum advance (days)"} value={policy.maxAdvanceDays} onChange={(value) => setPolicy({ ...policy, maxAdvanceDays: value })} />
              <NumberField label={isRTL ? "مدة الجلسة (دقيقة)" : "Dining duration (min)"} value={policy.defaultDurationMinutes} onChange={(value) => setPolicy({ ...policy, defaultDurationMinutes: value })} />
              <NumberField label={isRTL ? "وقت التجهيز (دقيقة)" : "Turnover buffer (min)"} value={policy.turnoverMinutes} onChange={(value) => setPolicy({ ...policy, turnoverMinutes: value })} />
              <NumberField label={isRTL ? "فاصل الأوقات (دقيقة)" : "Slot interval (min)"} value={policy.slotIntervalMinutes} onChange={(value) => setPolicy({ ...policy, slotIntervalMinutes: value })} />
              <NumberField label={isRTL ? "أقل عدد ضيوف" : "Minimum party size"} value={policy.minPartySize} onChange={(value) => setPolicy({ ...policy, minPartySize: value })} />
              <NumberField label={isRTL ? "أقصى عدد ضيوف" : "Maximum party size"} value={policy.maxPartySize} onChange={(value) => setPolicy({ ...policy, maxPartySize: value })} />
              <NumberField label={isRTL ? "مهلة إلغاء العميل (دقيقة)" : "Customer cancel cutoff (min)"} value={policy.customerCancelCutoffMinutes} onChange={(value) => setPolicy({ ...policy, customerCancelCutoffMinutes: value })} />
            </div>
            <div className="flex justify-end"><Button onClick={savePolicy} disabled={savingPolicy}>{savingPolicy ? <Loader2 className="size-4 animate-spin me-2" /> : <Save className="size-4 me-2" />}{isRTL ? "حفظ السياسة" : "Save policy"}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{isRTL ? "فترات الخدمة الأسبوعية" : "Weekly Service Periods"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end rounded-xl border p-3">
              <div><Label>{isRTL ? "اليوم" : "Day"}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={period.dayOfWeek} onChange={(event) => setPeriod({ ...period, dayOfWeek: Number(event.target.value) })}>{dayNamesEn.map((name, index) => <option key={name} value={index}>{isRTL ? dayNamesAr[index] : name}</option>)}</select></div>
              <div><Label>{isRTL ? "يفتح" : "Opens"}</Label><Input className="mt-1" type="time" value={period.opensAt} onChange={(event) => setPeriod({ ...period, opensAt: event.target.value })} /></div>
              <div><Label>{isRTL ? "يغلق" : "Closes"}</Label><Input className="mt-1" type="time" value={period.closesAt} onChange={(event) => setPeriod({ ...period, closesAt: event.target.value })} /></div>
              <div><Label>{isRTL ? "الوصف" : "Label"}</Label><Input className="mt-1" value={period.label} onChange={(event) => setPeriod({ ...period, label: event.target.value })} /></div>
              <Button onClick={addPeriod}><Plus className="size-4 me-2" />{isRTL ? "إضافة" : "Add"}</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 7 }, (_, day) => (
                <div key={day} className="rounded-xl border p-3">
                  <h3 className="font-semibold text-sm mb-2">{isRTL ? dayNamesAr[day] : dayNamesEn[day]}</h3>
                  <div className="space-y-2">
                    {(periodsByDay[day] || []).length === 0 && <p className="text-xs text-muted-foreground">{isRTL ? "لا توجد فترات" : "No service periods"}</p>}
                    {(periodsByDay[day] || []).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span><b dir="ltr">{entry.opensAt}–{entry.closesAt}</b>{entry.label ? ` · ${entry.label}` : ""}</span>
                        <Button size="icon" variant="ghost" onClick={() => remove("period", entry.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{isRTL ? "الإغلاقات والاستثناءات" : "Closures & Exceptions"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end rounded-xl border p-3">
              <div><Label>{isRTL ? "البداية" : "Start"}</Label><Input className="mt-1" type="datetime-local" value={closure.localStart} onChange={(event) => setClosure({ ...closure, localStart: event.target.value })} /></div>
              <div><Label>{isRTL ? "النهاية" : "End"}</Label><Input className="mt-1" type="datetime-local" value={closure.localEnd} onChange={(event) => setClosure({ ...closure, localEnd: event.target.value })} /></div>
              <div><Label>{isRTL ? "السبب" : "Reason"}</Label><Input className="mt-1" value={closure.reason} onChange={(event) => setClosure({ ...closure, reason: event.target.value })} /></div>
              <Button onClick={addClosure} disabled={!closure.localStart || !closure.localEnd || closure.reason.length < 3}><Plus className="size-4 me-2" />{isRTL ? "إضافة إغلاق" : "Add closure"}</Button>
            </div>
            <div className="space-y-2">
              {(data?.closures || []).length === 0 && <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد إغلاقات قادمة" : "No upcoming closures"}</p>}
              {(data?.closures || []).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div><p className="font-medium text-sm">{entry.reason}</p><p className="text-xs text-muted-foreground" dir="ltr">{entry.localStart} → {entry.localEnd} ({entry.timezone})</p></div>
                  <Button size="icon" variant="ghost" onClick={() => remove("closure", entry.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div><Label>{label}</Label><Input className="mt-1" type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></div>;
}
