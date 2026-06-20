"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Clock, Users, Phone, User, Mail, ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  seated: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  no_show: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function ReservationsSection() {
  const { t, isRTL, fmtDate, fmtTime } = useI18n();
  const { customerPhone, customerName, setActiveSection } = useRestaurantStore();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const [form, setForm] = useState({
    name: customerName || "", phone: customerPhone || "", email: "",
    partySize: 2, date: new Date().toISOString().split("T")[0], time: "19:00",
    occasion: "", preference: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["reservations", customerPhone],
    queryFn: async () => (await fetch(`/api/reservations?phone=${encodeURIComponent(customerPhone || form.phone)}`)).json(),
    enabled: !!(customerPhone || form.phone),
  });
  const reservations: any[] = data?.reservations || [];

  const times = ["12:00", "12:30", "13:00", "13:30", "14:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];
  const occasions = [
    { id: "casual", label: t.reservations.occasionCasual },
    { id: "birthday", label: t.reservations.occasionBirthday },
    { id: "anniversary", label: t.reservations.occasionAnniversary },
    { id: "business", label: t.reservations.occasionBusiness },
  ];
  const prefs = [
    { id: "indoor", label: t.reservations.prefIndoor },
    { id: "outdoor", label: t.reservations.prefOutdoor },
    { id: "window", label: t.reservations.prefWindow },
    { id: "bar", label: t.reservations.prefBar },
  ];

  const submit = async () => {
    if (!form.name || !form.phone) { toast.error(t.reservations.yourName); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dateTime: new Date(`${form.date}T${form.time}`) }),
      });
      if (r.ok) {
        toast.success(t.reservations.bookingConfirmed);
        qc.invalidateQueries({ queryKey: ["reservations"] });
        refetch();
      }
    } catch { toast.error(t.common.error); }
    finally { setSubmitting(false); }
  };

  const cancel = async (id: string) => {
    await fetch(`/api/reservations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    refetch();
    toast.success(t.reservations.statusCancelled);
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}><Arrow className="size-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="size-6 text-primary" />{t.reservations.title}</h1>
          <p className="text-sm text-muted-foreground">{t.reservations.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.yourName}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.phone}</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.email}</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Users className="size-3" />{t.reservations.partySize}</label>
                <div className="flex items-center gap-1 border rounded-xl p-1">
                  {[1,2,3,4,5,6,7,8].map((n) => (
                    <button key={n} onClick={() => setForm({ ...form, partySize: n })} className={`size-9 rounded-lg text-sm font-medium transition-colors ${form.partySize === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.date}</label>
                <div className="flex gap-1.5 mb-2">
                  {(() => {
                    const today = new Date();
                    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                    const fmt = (d: Date) => d.toISOString().split("T")[0];
                    const presets = [
                      { label: isRTL ? "اليوم" : "Today", value: fmt(today) },
                      { label: isRTL ? "غداً" : "Tomorrow", value: fmt(tomorrow) },
                    ];
                    return presets.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setForm({ ...form, date: p.value })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${form.date === p.value ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"}`}
                      >
                        {p.label}
                      </button>
                    ));
                  })()}
                </div>
                <Input type="date" value={form.date} min={new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Clock className="size-3" />{t.reservations.time}</label>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">{isRTL ? "الغداء" : "LUNCH"}</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {times.filter((tm) => parseInt(tm) < 17).map((tm) => (
                      <button key={tm} onClick={() => setForm({ ...form, time: tm })} className={`py-2 rounded-lg text-xs font-medium transition-colors ${form.time === tm ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"}`}>{tm}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">{isRTL ? "العشاء" : "DINNER"}</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {times.filter((tm) => parseInt(tm) >= 17).map((tm) => (
                      <button key={tm} onClick={() => setForm({ ...form, time: tm })} className={`py-2 rounded-lg text-xs font-medium transition-colors ${form.time === tm ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"}`}>{tm}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.occasion}</label>
              <div className="flex flex-wrap gap-1.5">
                {occasions.map((o) => (
                  <button key={o.id} onClick={() => setForm({ ...form, occasion: form.occasion === o.id ? "" : o.id })} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${form.occasion === o.id ? "bg-primary text-primary-foreground" : "bg-accent"}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.reservations.preference}</label>
              <div className="flex flex-wrap gap-1.5">
                {prefs.map((p) => (
                  <button key={p.id} onClick={() => setForm({ ...form, preference: form.preference === p.id ? "" : p.id })} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${form.preference === p.id ? "bg-primary text-primary-foreground" : "bg-accent"}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <Textarea placeholder={t.reservations.notesPlaceholder} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} dir="auto" />
            <Button onClick={submit} disabled={submitting} className="w-full h-12 text-base gap-2">
              <CalendarDays className="size-5" />{submitting ? "..." : t.reservations.book}
            </Button>
          </CardContent>
        </Card>

        {/* Your reservations */}
        <div>
          <h2 className="font-bold text-lg mb-3">{t.reservations.yourReservations}</h2>
          {reservations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <CalendarDays className="size-10 mx-auto mb-2 opacity-30" />
                {t.reservations.noReservations}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reservations.map((r, idx) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{fmtDate(r.dateTime)}</span>
                            <span className="text-sm text-muted-foreground">{fmtTime(r.dateTime)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Users className="size-3" />{r.partySize} {t.reservations.guests}
                            {r.occasion && <span>· {r.occasion}</span>}
                          </p>
                        </div>
                        <Badge className={statusColors[r.status] || ""}>{(t.reservations as any)[`status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`] || r.status}</Badge>
                      </div>
                      {r.status === "confirmed" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(r.id)} className="text-destructive text-xs gap-1">
                          <X className="size-3" />{t.reservations.cancel}
                        </Button>
                      )}
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
