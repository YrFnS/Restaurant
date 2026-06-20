"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  MonitorSmartphone, Plus, Pencil, Trash2, ExternalLink, Copy,
  Link2, Loader2, ChefHat, Flame, Wine, Cake, IceCream, Soup,
  Salad, Coffee, Pizza, Fish, Cookie, Sandwich, Utensils,
  Monitor, Grid2x2, List, Eye, Filter, Globe, Check, X,
} from "lucide-react";

const STATION_ICONS: Record<string, React.ReactNode> = {
  Flame: <Flame className="size-4" />,
  ChefHat: <ChefHat className="size-4" />,
  Wine: <Wine className="size-4" />,
  Cake: <Cake className="size-4" />,
  Soup: <Soup className="size-4" />,
  Salad: <Salad className="size-4" />,
  Coffee: <Coffee className="size-4" />,
  Pizza: <Pizza className="size-4" />,
  Fish: <Fish className="size-4" />,
  Cookie: <Cookie className="size-4" />,
  Sandwich: <Sandwich className="size-4" />,
  Utensils: <Utensils className="size-4" />,
};

export function KdsScreensTab() {
  const { t, isRTL, locale } = useI18n();
  const qc = useQueryClient();
  const [screenDialog, setScreenDialog] = useState<{ open: boolean; screen?: any }>({ open: false });
  const [stationDialog, setStationDialog] = useState<{ open: boolean; station?: any }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ["kitchen-screens", "admin"],
    queryFn: async () => (await fetch("/api/kitchen-screens")).json(),
  });
  const screens: any[] = data?.screens || [];
  const stations: any[] = data?.stations || [];

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copyUrl = async (slug: string) => {
    const url = `${origin}/kds/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.admin.urlCopied);
    } catch {
      toast.error(isRTL ? "تعذّر النسخ" : "Failed to copy");
    }
  };

  const deleteScreen = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذه الشاشة؟" : "Delete this screen?")) return;
    try {
      await apiFetch(`/api/kitchen-screens/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["kitchen-screens", "admin"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteStation = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذه المحطة؟" : "Delete this station?")) return;
    try {
      await apiFetch(`/api/stations/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["kitchen-screens", "admin"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleScreenActive = async (s: any) => {
    try {
      await apiFetch(`/api/kitchen-screens/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      qc.invalidateQueries({ queryKey: ["kitchen-screens", "admin"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  return (
    <div className="space-y-5 max-w-[1600px]">
      {/* Hero info banner */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-amber-50/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <MonitorSmartphone className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base">{t.admin.kdsScreens}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{t.admin.screenUrlDesc}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                  <Link2 className="size-3 me-1" />
                  {screens.length} {isRTL ? "شاشة" : "screens"}
                </Badge>
                <Badge className="bg-violet-500/15 text-violet-700 hover:bg-violet-500/15">
                  <Filter className="size-3 me-1" />
                  {stations.length} {isRTL ? "محطة" : "stations"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="screens">
        <TabsList>
          <TabsTrigger value="screens" className="gap-1.5">
            <Monitor className="size-3.5" />
            {t.admin.kdsScreens}
          </TabsTrigger>
          <TabsTrigger value="stations" className="gap-1.5">
            <ChefHat className="size-3.5" />
            {t.admin.kdsStations}
          </TabsTrigger>
        </TabsList>

        {/* ─── SCREENS ─── */}
        <TabsContent value="screens" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setScreenDialog({ open: true })} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              {t.admin.addScreen}
            </Button>
          </div>

          {screens.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="p-0">
                <EmptyState
                  icon={<MonitorSmartphone className="size-6" />}
                  title={t.admin.noScreens}
                  description={t.admin.screenUrlDesc}
                  action={
                    <Button size="sm" className="gap-1.5" onClick={() => setScreenDialog({ open: true })}>
                      <Plus className="size-4" />
                      {t.admin.addScreen}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {screens.map((s) => {
                const url = `${origin}/kds/${s.slug}`;
                const filteredStations = s.stationFilter
                  ? stations.filter((st) => s.stationFilter.split(",").includes(st.slug))
                  : stations;
                return (
                  <Card key={s.id} className={`border-border/60 overflow-hidden ${!s.isActive ? "opacity-70" : ""}`}>
                    {/* Header with type badge */}
                    <div className={`px-4 py-3 border-b border-border flex items-center gap-2 ${s.screenType === "expo" ? "bg-violet-500/10" : "bg-primary/10"}`}>
                      <div className={`size-9 rounded-lg flex items-center justify-center ${s.screenType === "expo" ? "bg-violet-500/20 text-violet-700" : "bg-primary/20 text-primary"}`}>
                        {s.screenType === "expo" ? <Monitor className="size-4" /> : <MonitorSmartphone className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {s.screenType === "expo" ? t.admin.expo : t.admin.prep}
                        </div>
                      </div>
                      <Switch checked={s.isActive} onCheckedChange={() => toggleScreenActive(s)} />
                    </div>

                    <CardContent className="p-4 space-y-3">
                      {s.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                      )}

                      {/* URL block */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <Link2 className="size-3" />
                          {t.admin.stationUrl}
                        </Label>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-border">
                          <Globe className="size-3.5 text-primary shrink-0" />
                          <code className="text-xs font-mono truncate flex-1" dir="ltr">/kds/{s.slug}</code>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            asChild
                            size="sm"
                            variant="default"
                            className="h-8 gap-1.5 text-xs"
                          >
                            <a href={`/kds/${s.slug}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-3.5" />
                              {t.admin.openInNewTab}
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => copyUrl(s.slug)}
                          >
                            <Copy className="size-3.5" />
                            {t.admin.copyUrl}
                          </Button>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MetaPill label={t.admin.layout} value={s.layoutType} icon={s.layoutType === "grid" ? <Grid2x2 className="size-3" /> : <List className="size-3" />} />
                        <MetaPill label={t.admin.autoRefresh} value={`${s.autoRefreshSec}s`} icon={<Loader2 className="size-3" />} />
                        <MetaPill label={t.admin.maxOrders} value={s.maxOrders > 0 ? String(s.maxOrders) : "∞"} icon={<Eye className="size-3" />} />
                        <MetaPill label={t.admin.showCompleted} value={s.showCompleted ? <Check className="size-3 text-emerald-600" /> : <X className="size-3 text-muted-foreground" />} />
                      </div>

                      {/* Station filter */}
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide mb-1 block">{isRTL ? "المحطات" : "Stations"}</Label>
                        <div className="flex flex-wrap gap-1">
                          {filteredStations.length === 0 ? (
                            <Badge variant="secondary" className="text-[10px]">{t.admin.all}</Badge>
                          ) : (
                            filteredStations.map((st) => (
                              <Badge
                                key={st.id}
                                variant="outline"
                                className="text-[10px] gap-1"
                                style={{ borderColor: st.color, color: st.color }}
                              >
                                {STATION_ICONS[st.icon] || <ChefHat className="size-3" />}
                                {st.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 gap-1.5"
                          onClick={() => setScreenDialog({ open: true, screen: s })}
                        >
                          <Pencil className="size-3.5" />
                          {t.admin.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => deleteScreen(s.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── STATIONS ─── */}
        <TabsContent value="stations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setStationDialog({ open: true })} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              {t.admin.addStation}
            </Button>
          </div>

          {stations.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="p-0">
                <EmptyState
                  icon={<ChefHat className="size-6" />}
                  title={t.admin.noStations}
                  description={isRTL ? "أنشئ محطات لتوجيه الطلبات لكل قسم" : "Create stations to route orders to specific kitchen areas"}
                  action={
                    <Button size="sm" className="gap-1.5" onClick={() => setStationDialog({ open: true })}>
                      <Plus className="size-4" />
                      {t.admin.addStation}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {stations.map((st) => (
                <Card key={st.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="size-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${st.color}20`, color: st.color }}
                      >
                        {STATION_ICONS[st.icon] || <ChefHat className="size-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{st.name}</div>
                        <code className="text-xs text-muted-foreground font-mono" dir="ltr">/{st.slug}</code>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div className="p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="text-[10px] text-muted-foreground uppercase">{t.admin.targetPrepMin}</div>
                        <div className="font-semibold">{st.targetPrepMin} {isRTL ? "د" : "min"}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="text-[10px] text-muted-foreground uppercase">{t.admin.status}</div>
                        <div className="font-semibold">
                          {st.isActive ? (
                            <span className="text-emerald-600 flex items-center gap-1"><Check className="size-3" />{t.admin.active}</span>
                          ) : (
                            <span className="text-muted-foreground">Off</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 gap-1.5"
                        onClick={() => setStationDialog({ open: true, station: st })}
                      >
                        <Pencil className="size-3.5" />
                        {t.admin.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteStation(st.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Screen dialog */}
      {screenDialog.open && (
        <ScreenDialog
          screen={screenDialog.screen}
          stations={stations}
          onClose={() => setScreenDialog({ open: false })}
          onSaved={() => {
            setScreenDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["kitchen-screens", "admin"] });
          }}
        />
      )}

      {/* Station dialog */}
      {stationDialog.open && (
        <StationDialog
          station={stationDialog.station}
          onClose={() => setStationDialog({ open: false })}
          onSaved={() => {
            setStationDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["kitchen-screens", "admin"] });
          }}
        />
      )}
    </div>
  );
}

function MetaPill({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="p-2 rounded-lg bg-muted/30 border border-border">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-0.5">{icon}{label}</div>
      <div className="font-semibold text-xs mt-0.5">{value}</div>
    </div>
  );
}

function ScreenDialog({
  screen, stations, onClose, onSaved,
}: {
  screen?: any;
  stations: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: screen?.name || "",
    slug: screen?.slug || "",
    description: screen?.description || "",
    stationFilter: screen?.stationFilter || "",
    screenType: screen?.screenType || "prep",
    layoutType: screen?.layoutType || "grid",
    autoRefreshSec: screen?.autoRefreshSec ?? 10,
    showCompleted: screen?.showCompleted ?? false,
    maxOrders: screen?.maxOrders ?? 0,
    sortOrder: screen?.sortOrder ?? 0,
    isActive: screen?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleStation = (slug: string) => {
    const list = form.stationFilter ? form.stationFilter.split(",").filter(Boolean) : [];
    const idx = list.indexOf(slug);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(slug);
    set("stationFilter", list.join(","));
  };

  const save = async () => {
    if (!form.name || !form.slug) {
      toast.error(isRTL ? "الاسم والرابط مطلوبان" : "Name and slug required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, autoRefreshSec: Number(form.autoRefreshSec), maxOrders: Number(form.maxOrders), sortOrder: Number(form.sortOrder) };
      if (screen) {
        await apiFetch(`/api/kitchen-screens/${screen.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success(isRTL ? "تم الحفظ" : "Saved");
      } else {
        await apiFetch("/api/kitchen-screens", { method: "POST", body: JSON.stringify(payload) });
        toast.success(isRTL ? "تمت الإضافة" : "Created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/kds/${form.slug || "..."}`;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorSmartphone className="size-5 text-primary" />
            {screen ? t.admin.editScreen : t.admin.addScreen}
          </DialogTitle>
          <DialogDescription>{t.admin.screenUrlDesc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "الاسم *" : "Name *"}</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Grill Station" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.slug} *</Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="grill"
                dir="ltr"
                className="font-mono"
              />
            </div>
          </div>

          {/* Live URL preview */}
          {form.slug && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
              <Globe className="size-4 text-primary shrink-0" />
              <code className="text-xs font-mono truncate flex-1" dir="ltr">{previewUrl}</code>
              <a href={`/kds/${form.slug}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="h-7 px-2">
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{isRTL ? "الوصف" : "Description"}</Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.screenType}</Label>
              <Select value={form.screenType} onValueChange={(v) => set("screenType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prep">{t.admin.prep}</SelectItem>
                  <SelectItem value="expo">{t.admin.expo}</SelectItem>
                  <SelectItem value="all">{t.admin.all}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.layout}</Label>
              <Select value={form.layoutType} onValueChange={(v) => set("layoutType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.autoRefresh}</Label>
              <Input type="number" min="3" value={form.autoRefreshSec} onChange={(e) => set("autoRefreshSec", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.maxOrders}</Label>
              <Input type="number" min="0" value={form.maxOrders} onChange={(e) => set("maxOrders", e.target.value)} />
            </div>
          </div>

          {/* Station filter */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Filter className="size-3.5" />
              {isRTL ? "محطات العرض (فارغ = الكل)" : "Stations to show (empty = all)"}
            </Label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-muted/20 min-h-12">
              {stations.length === 0 ? (
                <span className="text-xs text-muted-foreground self-center px-2">
                  {isRTL ? "لا محطات بعد" : "No stations yet — create stations first"}
                </span>
              ) : (
                stations.map((st) => {
                  const active = form.stationFilter.split(",").includes(st.slug);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStation(st.slug)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                        active
                          ? "text-white border-transparent"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                      style={active ? { backgroundColor: st.color } : {}}
                    >
                      {STATION_ICONS[st.icon] || <ChefHat className="size-3" />}
                      {st.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-3 gap-2">
            <FlagRow label={t.admin.showCompleted} checked={form.showCompleted} onChange={(v) => set("showCompleted", v)} />
            <FlagRow label={t.admin.active} checked={form.isActive} onChange={(v) => set("isActive", v)} />
            <div className="space-y-1.5">
              <Label className="text-xs">{t.admin.sortOrder}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
      <span className="text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StationDialog({
  station, onClose, onSaved,
}: {
  station?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: station?.name || "",
    slug: station?.slug || "",
    icon: station?.icon || "ChefHat",
    color: station?.color || "#f59e0b",
    targetPrepMin: station?.targetPrepMin ?? 15,
    sortOrder: station?.sortOrder ?? 0,
    isActive: station?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.slug) {
      toast.error(isRTL ? "الاسم والرابط مطلوبان" : "Name and slug required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, targetPrepMin: Number(form.targetPrepMin), sortOrder: Number(form.sortOrder) };
      if (station) {
        await apiFetch(`/api/stations/${station.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success(isRTL ? "تم الحفظ" : "Saved");
      } else {
        await apiFetch("/api/stations", { method: "POST", body: JSON.stringify(payload) });
        toast.success(isRTL ? "تمت الإضافة" : "Created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  const iconOptions = Object.keys(STATION_ICONS);
  const colorOptions = ["#f59e0b", "#ef4444", "#84cc16", "#06b6d4", "#a855f7", "#ec4899", "#10b981", "#f97316", "#8b5cf6"];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="size-5 text-primary" />
            {station ? t.admin.editStation : t.admin.addStation}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "الاسم *" : "Name *"}</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Grill" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.slug} *</Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="grill"
                dir="ltr"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.admin.icon}</Label>
            <div className="flex flex-wrap gap-1.5">
              {iconOptions.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => set("icon", ic)}
                  className={`size-9 rounded-lg border flex items-center justify-center transition-all ${
                    form.icon === ic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {STATION_ICONS[ic]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.admin.color}</Label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={`size-8 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="size-8 rounded-md border border-border cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.targetPrepMin}</Label>
              <Input type="number" min="1" value={form.targetPrepMin} onChange={(e) => set("targetPrepMin", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.sortOrder}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            </div>
          </div>

          <FlagRow label={t.admin.active} checked={form.isActive} onChange={(v) => set("isActive", v)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
