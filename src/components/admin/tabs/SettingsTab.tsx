"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminLoading, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Store, Phone, Mail, MapPin, Clock, DollarSign, Image as ImageIcon,
  Share2, BarChart3, ChefHat, Save, Loader2, Volume2, Facebook,
  Instagram, Twitter, MessageCircle,
} from "lucide-react";

export function SettingsTab() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });

  if (isLoading || !data?.settings) return <AdminLoading label={t.common.loading} />;
  return <SettingsForm key={data.settings.id || "settings"} initial={data.settings} />;
}

function SettingsForm({ initial }: { initial: any }) {
  const { t, isRTL } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      toast.success(isRTL ? "تم الحفظ" : "Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-[1200px]">
      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general" className="gap-1.5"><Store className="size-3.5" />{isRTL ? "عام" : "General"}</TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5"><Phone className="size-3.5" />{isRTL ? "اتصال" : "Contact"}</TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5"><Clock className="size-3.5" />{isRTL ? "ساعات" : "Hours"}</TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5"><DollarSign className="size-3.5" />{isRTL ? "رسوم" : "Fees"}</TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5"><Share2 className="size-3.5" />{isRTL ? "تواصل" : "Social"}</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="size-3.5" />{isRTL ? "إحصاءات" : "Stats"}</TabsTrigger>
          <TabsTrigger value="kds" className="gap-1.5"><ChefHat className="size-3.5" />{isRTL ? "المطبخ" : "KDS"}</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Store className="size-4 text-primary" />{isRTL ? "معلومات المطعم" : "Restaurant Info"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "الاسم (إنجليزي)" : "Name (English)"} value={form.nameEn} onChange={(v) => set("nameEn", v)} dir="ltr" />
                <Field label={isRTL ? "الاسم (عربي)" : "Name (Arabic)"} value={form.nameAr} onChange={(v) => set("nameAr", v)} dir="rtl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "الشعار (إنجليزي)" : "Tagline (English)"} value={form.taglineEn} onChange={(v) => set("taglineEn", v)} dir="ltr" />
                <Field label={isRTL ? "الشعار (عربي)" : "Tagline (Arabic)"} value={form.taglineAr} onChange={(v) => set("taglineAr", v)} dir="rtl" />
              </div>
              <FieldArea label={isRTL ? "الوصف (إنجليزي)" : "Description (English)"} value={form.descriptionEn} onChange={(v) => set("descriptionEn", v)} dir="ltr" />
              <FieldArea label={isRTL ? "الوصف (عربي)" : "Description (Arabic)"} value={form.descriptionAr} onChange={(v) => set("descriptionAr", v)} dir="rtl" />
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "رابط الشعار" : "Logo URL"} value={form.logoUrl} onChange={(v) => set("logoUrl", v)} dir="ltr" icon={<ImageIcon className="size-3.5" />} />
                <Field label={isRTL ? "رابط صورة الواجهة" : "Hero Image URL"} value={form.heroImageUrl} onChange={(v) => set("heroImageUrl", v)} dir="ltr" icon={<ImageIcon className="size-3.5" />} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACT */}
        <TabsContent value="contact" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="size-4 text-primary" />{isRTL ? "بيانات الاتصال" : "Contact Details"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "الهاتف" : "Phone"} value={form.phone} onChange={(v) => set("phone", v)} dir="ltr" icon={<Phone className="size-3.5" />} />
                <Field label={isRTL ? "البريد" : "Email"} value={form.email} onChange={(v) => set("email", v)} dir="ltr" icon={<Mail className="size-3.5" />} />
              </div>
              <FieldArea label={isRTL ? "العنوان (إنجليزي)" : "Address (English)"} value={form.addressEn} onChange={(v) => set("addressEn", v)} dir="ltr" icon={<MapPin className="size-3.5" />} />
              <FieldArea label={isRTL ? "العنوان (عربي)" : "Address (Arabic)"} value={form.addressAr} onChange={(v) => set("addressAr", v)} dir="rtl" icon={<MapPin className="size-3.5" />} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "خط العرض" : "Latitude"} value={String(form.latitude)} onChange={(v) => set("latitude", parseFloat(v) || 0)} dir="ltr" />
                <Field label={isRTL ? "خط الطول" : "Longitude"} value={String(form.longitude)} onChange={(v) => set("longitude", parseFloat(v) || 0)} dir="ltr" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOURS */}
        <TabsContent value="hours" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="size-4 text-primary" />{isRTL ? "ساعات العمل" : "Working Hours"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "وقت الفتح" : "Open Time"} value={form.openTime} onChange={(v) => set("openTime", v)} dir="ltr" type="time" />
                <Field label={isRTL ? "وقت الإغلاق" : "Close Time"} value={form.closeTime} onChange={(v) => set("closeTime", v)} dir="ltr" type="time" />
              </div>
              <Field label={isRTL ? "متوسط وقت التحضير (دقيقة)" : "Avg Prep Time (min)"} value={String(form.avgPrepTimeMin)} onChange={(v) => set("avgPrepTimeMin", parseInt(v) || 0)} dir="ltr" type="number" />
              <Field label={isRTL ? "نسب الإكرامية (مفصولة بفواصل)" : "Tip Presets (comma-separated)"} value={form.tipPresets} onChange={(v) => set("tipPresets", v)} dir="ltr" />
              <Field label={isRTL ? "مبالغ بطاقات الهدايا" : "Gift Card Amounts"} value={form.giftCardAmounts} onChange={(v) => set("giftCardAmounts", v)} dir="ltr" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* FEES */}
        <TabsContent value="fees" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="size-4 text-primary" />{isRTL ? "الرسوم والضرائب" : "Fees & Taxes"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={isRTL ? "نسبة الضريبة" : "Tax Rate"} value={String(form.taxRate)} onChange={(v) => set("taxRate", parseFloat(v) || 0)} dir="ltr" type="number" step="0.01" />
                <Field label={isRTL ? "العملة" : "Currency"} value={form.currency} onChange={(v) => set("currency", v)} dir="ltr" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={isRTL ? "رسوم التوصيل" : "Delivery Fee"} value={String(form.deliveryFee)} onChange={(v) => set("deliveryFee", parseFloat(v) || 0)} dir="ltr" type="number" step="0.01" />
                <Field label={isRTL ? "أقل طلب توصيل" : "Min Delivery Order"} value={String(form.minDeliveryOrder)} onChange={(v) => set("minDeliveryOrder", parseFloat(v) || 0)} dir="ltr" type="number" step="0.01" />
                <Field label={isRTL ? "نطاق التوصيل (كم)" : "Delivery Radius (km)"} value={String(form.deliveryRadiusKm)} onChange={(v) => set("deliveryRadiusKm", parseFloat(v) || 0)} dir="ltr" type="number" step="0.1" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOCIAL */}
        <TabsContent value="social" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Share2 className="size-4 text-primary" />{isRTL ? "روابط التواصل" : "Social Links"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Facebook URL" value={form.facebookUrl} onChange={(v) => set("facebookUrl", v)} dir="ltr" icon={<Facebook className="size-3.5" />} />
              <Field label="Instagram URL" value={form.instagramUrl} onChange={(v) => set("instagramUrl", v)} dir="ltr" icon={<Instagram className="size-3.5" />} />
              <Field label="Twitter / X URL" value={form.twitterUrl} onChange={(v) => set("twitterUrl", v)} dir="ltr" icon={<Twitter className="size-3.5" />} />
              <Field label="WhatsApp URL" value={form.whatsappUrl} onChange={(v) => set("whatsappUrl", v)} dir="ltr" icon={<MessageCircle className="size-3.5" />} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* STATS */}
        <TabsContent value="stats" className="mt-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="size-4 text-primary" />{isRTL ? "إحصاءات المطعم" : "Restaurant Stats"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label={isRTL ? "طلبات تم تقديمها" : "Orders Served"} value={String(form.statsOrdersServed)} onChange={(v) => set("statsOrdersServed", parseInt(v) || 0)} dir="ltr" type="number" />
                <Field label={isRTL ? "عملاء سعداء" : "Happy Customers"} value={String(form.statsHappyCustomers)} onChange={(v) => set("statsHappyCustomers", parseInt(v) || 0)} dir="ltr" type="number" />
                <Field label={isRTL ? "سنوات الخدمة" : "Years of Service"} value={String(form.statsYearsService)} onChange={(v) => set("statsYearsService", parseInt(v) || 0)} dir="ltr" type="number" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KDS */}
        <TabsContent value="kds" className="mt-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ChefHat className="size-4 text-primary" />
                {isRTL ? "إعدادات شاشات المطبخ" : "KDS Settings"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "تحكم في عتبات الألوان حسب وقت التحضير. الأخضر ضمن الهدف، الأصفر قرب الحد، الأحمر متأخر."
                  : "Control color thresholds by prep time. Green = on target, Yellow = approaching limit, Red = late."}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/50">
                  <Label className="text-xs flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    {isRTL ? "أخضر (≤ دقيقة)" : "Green (≤ min)"}
                  </Label>
                  <Input
                    type="number"
                    value={String(form.kdsGreenMin)}
                    onChange={(e) => set("kdsGreenMin", parseInt(e.target.value) || 0)}
                    dir="ltr"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div className="p-3 rounded-lg border-2 border-amber-200 bg-amber-50/50">
                  <Label className="text-xs flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-amber-500" />
                    {isRTL ? "أصفر (≤ دقيقة)" : "Yellow (≤ min)"}
                  </Label>
                  <Input
                    type="number"
                    value={String(form.kdsYellowMin)}
                    onChange={(e) => set("kdsYellowMin", parseInt(e.target.value) || 0)}
                    dir="ltr"
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div className="p-3 rounded-lg border-2 border-rose-200 bg-rose-50/50">
                  <Label className="text-xs flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-rose-500" />
                    {isRTL ? "أحمر (> دقيقة)" : "Red (> min)"}
                  </Label>
                  <Input
                    type="number"
                    value={String(form.kdsRedMin)}
                    onChange={(e) => set("kdsRedMin", parseInt(e.target.value) || 0)}
                    dir="ltr"
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{isRTL ? "صوت عند طلب جديد" : "Sound on new ticket"}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? "تنبيه صوتي عند وصول طلب جديد للمطبخ" : "Play a sound when a new ticket arrives in the kitchen"}</div>
                  </div>
                </div>
                <Switch checked={form.soundOnNewTicket} onCheckedChange={(v) => set("soundOnNewTicket", v)} />
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                <Badge variant="secondary" className="mb-1.5">{isRTL ? "تذكير" : "Tip"}</Badge>
                <p className="text-muted-foreground">
                  {isRTL
                    ? "كل شاشة مطبخ لها رابطها الخاص في تبويب «شاشات المطبخ». يمكنك إنشاء شاشات متعددة لمحطات مختلفة."
                    : "Each KDS screen has its own URL — manage them in the KDS Screens tab. Create one screen per station for best routing."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="border-primary/30 shadow-lg">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {isRTL ? "لا تنسَ حفظ التغييرات" : "Don't forget to save your changes"}
            </div>
            <div className="flex gap-2 ms-auto">
              <Button
                variant="outline"
                onClick={() => setForm(initial)}
                disabled={saving}
              >
                {isRTL ? "إلغاء" : "Reset"}
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t.admin.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, dir, type = "text", step, icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  type?: string;
  step?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {icon && <span className="absolute top-1/2 -translate-y-1/2 start-2.5 text-muted-foreground">{icon}</span>}
        <Input
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          className={icon ? "ps-8" : ""}
        />
      </div>
    </div>
  );
}

function FieldArea({
  label, value, onChange, dir, icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {icon && <span className="absolute top-3 start-2.5 text-muted-foreground">{icon}</span>}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          rows={2}
          className={icon ? "ps-8" : ""}
        />
      </div>
    </div>
  );
}
