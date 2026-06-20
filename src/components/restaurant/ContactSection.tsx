"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Clock, ArrowLeft, ArrowRight, Send, MessageCircle } from "lucide-react";
import { useState } from "react";

export function ContactSection() {
  const { t, isRTL } = useI18n();
  const { setActiveSection } = useRestaurantStore();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const s = data?.settings;

  const submit = async () => {
    if (!form.name || !form.message) { toast.error(t.contact.name); return; }
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, rating: 5, comment: `${form.subject}: ${form.message}` }),
      });
      toast.success(t.contact.sent);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch { toast.error(t.common.error); }
    finally { setSending(false); }
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}><Arrow className="size-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{t.contact.title}</h1>
          <p className="text-sm text-muted-foreground">{t.contact.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact info */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Phone className="size-5" /></div>
                <h3 className="font-semibold text-sm mb-1">{t.contact.callUs}</h3>
                <p className="text-sm text-muted-foreground" dir="ltr">{s?.phone}</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Mail className="size-5" /></div>
                <h3 className="font-semibold text-sm mb-1">{t.contact.emailUs}</h3>
                <p className="text-sm text-muted-foreground break-all">{s?.email}</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><MapPin className="size-5" /></div>
                <h3 className="font-semibold text-sm mb-1">{t.contact.visitUs}</h3>
                <p className="text-sm text-muted-foreground">{isRTL ? s?.addressAr : s?.addressEn}</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3"><Clock className="size-5" /></div>
                <h3 className="font-semibold text-sm mb-1">{t.contact.hours}</h3>
                <p className="text-sm text-muted-foreground">{s?.openTime} - {s?.closeTime}</p>
              </CardContent>
            </Card>
          </div>

          {/* Map placeholder */}
          <Card className="overflow-hidden">
            <div className="h-56 bg-gradient-to-br from-primary/10 via-accent/40 to-primary/5 relative flex items-center justify-center">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
              <div className="text-center">
                <MapPin className="size-10 text-primary mx-auto mb-2" />
                <p className="font-semibold">{isRTL ? s?.nameAr : s?.nameEn}</p>
                <p className="text-sm text-muted-foreground">{isRTL ? s?.addressAr : s?.addressEn}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Contact form */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.contact.name}</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.contact.email}</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.contact.subject}</label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} dir="auto" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t.contact.message}</label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} dir="auto" />
            </div>
            <Button onClick={submit} disabled={sending} className="w-full h-12 gap-2">
              <Send className="size-4" />{sending ? "..." : t.contact.send}
            </Button>
            {s?.whatsappUrl && (
              <Button asChild variant="outline" className="w-full gap-2">
                <a href={s.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
