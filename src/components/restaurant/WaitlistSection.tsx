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
import { Hourglass, Users, Phone, User, ArrowLeft, ArrowRight, Clock, Check, Bell } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export function WaitlistSection() {
  const { t, isRTL } = useI18n();
  const { customerPhone, customerName, setActiveSection } = useRestaurantStore();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const [form, setForm] = useState({ name: customerName || "", phone: customerPhone || "", partySize: 2, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["waitlist"],
    queryFn: async () => (await fetch("/api/waitlist")).json(),
    refetchInterval: 15000,
  });
  const entries: any[] = data?.entries || [];
  const myEntry = entries.find((e) => e.customerPhone === (customerPhone || form.phone));

  const join = async () => {
    if (!form.name || !form.phone) { toast.error(t.waitlist.yourName); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        toast.success(t.waitlist.joined);
        refetch();
      }
    } catch { toast.error(t.common.error); }
    finally { setSubmitting(false); }
  };

  const leave = async (id: string) => {
    await fetch(`/api/waitlist/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    refetch();
    toast.success(t.waitlist.statusCancelled);
  };

  const position = myEntry ? entries.filter((e) => new Date(e.createdAt) < new Date(myEntry.createdAt) && e.status === "waiting").length + 1 : 0;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}><Arrow className="size-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Hourglass className="size-6 text-primary" />{t.waitlist.title}</h1>
          <p className="text-sm text-muted-foreground">{t.waitlist.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Join form / your spot */}
        <div>
          {myEntry && myEntry.status === "waiting" ? (
            <Card className="bg-gradient-to-br from-primary/10 to-accent/40 border-primary/20">
              <CardContent className="p-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="size-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                  {position}
                </motion.div>
                <h3 className="font-bold text-lg mb-1">{t.waitlist.yourSpot}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.waitlist.partyAhead.replace("{count}", String(position - 1))}</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background mb-4">
                  <Clock className="size-4 text-primary" />
                  <span className="text-sm font-medium">{t.waitlist.estimatedWait}: {myEntry.estimatedWait} {t.waitlist.minutes}</span>
                </div>
                <Button variant="outline" onClick={() => leave(myEntry.id)} className="w-full text-destructive gap-2">
                  <ArrowLeft className="size-4" />{t.waitlist.leaveQueue}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.waitlist.yourName}</label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.waitlist.phone}</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Users className="size-3" />{t.waitlist.partySize}</label>
                  <div className="flex items-center gap-1 border rounded-xl p-1">
                    {[1,2,3,4,5,6,7,8].map((n) => (
                      <button key={n} onClick={() => setForm({ ...form, partySize: n })} className={`size-9 rounded-lg text-sm font-medium ${form.partySize === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                <Textarea placeholder={t.waitlist.notes} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} dir="auto" />
                <Button onClick={join} disabled={submitting} className="w-full h-12 text-base gap-2">
                  <Hourglass className="size-5" />{submitting ? "..." : t.waitlist.join}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Current waitlist */}
        <div>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Users className="size-5 text-primary" />{t.waitlist.currentWait}
          </h2>
          {entries.filter((e) => e.status === "waiting").length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Hourglass className="size-10 mx-auto mb-2 opacity-30" />
                {t.waitlist.noWaitlist}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.filter((e) => e.status === "waiting").map((e, idx) => (
                <motion.div key={e.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card className={e.customerPhone === (customerPhone || form.phone) ? "border-primary bg-primary/5" : ""}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{e.customerName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Users className="size-3" />{e.partySize}
                          <Clock className="size-3" />~{e.estimatedWait}{t.waitlist.minutes}
                        </div>
                      </div>
                      {e.customerPhone === (customerPhone || form.phone) && <Badge variant="default" className="text-[10px]">YOU</Badge>}
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
