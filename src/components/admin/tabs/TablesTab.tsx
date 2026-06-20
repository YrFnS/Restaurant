"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminLoading, EmptyState, TABLE_STATUS_META, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Armchair, Plus, Loader2, Users, Clock, X, Circle, Square,
  ArrowRightCircle, RefreshCw,
} from "lucide-react";

const SECTION_COLORS: Record<string, string> = {
  main: "#f59e0b",
  patio: "#84cc16",
  private: "#a855f7",
  bar: "#06b6d4",
};

export function TablesTab() {
  const { t, isRTL, locale, fmtTime } = useI18n();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sectionFilter, setSectionFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["tables", "admin"],
    queryFn: async () => (await fetch("/api/tables")).json(),
    refetchInterval: 15000,
  });
  const tables: any[] = data?.tables || [];

  const sections = useMemo(() => {
    const s = new Set<string>();
    tables.forEach((t) => s.add(t.section));
    return ["all", ...Array.from(s)];
  }, [tables]);

  const filteredTables = tables.filter((t) => sectionFilter === "all" || t.section === sectionFilter);

  // Floor plan canvas dimensions
  const maxX = Math.max(...filteredTables.map((t) => t.x + t.width), 600);
  const maxY = Math.max(...filteredTables.map((t) => t.y + t.height), 400);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch("/api/tables", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      qc.invalidateQueries({ queryKey: ["tables", "admin"] });
      toast.success(isRTL ? "تم التحديث" : "Status updated");
      setSelected((s) => s ? { ...s, status } : s);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  // Summary cards
  const summary = Object.keys(TABLE_STATUS_META).map((s) => ({
    status: s,
    count: tables.filter((t) => t.status === s).length,
    meta: TABLE_STATUS_META[s],
  }));

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {summary.map((s) => (
          <button
            key={s.status}
            onClick={() => setSectionFilter("all")}
            className="p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors text-start"
          >
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${s.meta.cls}`} />
              <span className="text-xs font-medium">{s.meta.label[locale]}</span>
            </div>
            <div className="text-xl font-bold mt-1">{s.count}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? t.menu.all : <span className="capitalize">{s}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => qc.invalidateQueries({ queryKey: ["tables", "admin"] })}
          >
            <RefreshCw className="size-3.5" />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {t.admin.addTable}
        </Button>
      </div>

      {/* Floor plan */}
      <Card className="border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Armchair className="size-4 text-primary" />
            {isRTL ? "مخطط الصالة" : "Floor Plan"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTables.length === 0 ? (
            <EmptyState
              icon={<Armchair className="size-6" />}
              title={isRTL ? "لا طاولات" : "No tables"}
              description={isRTL ? "أضف طاولات لعرض المخطط" : "Add tables to see the floor plan"}
              action={
                <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" />
                  {t.admin.addTable}
                </Button>
              }
            />
          ) : (
            <div className="overflow-auto bg-muted/20 rounded-lg border border-border p-4 scroll-thin" style={{ maxHeight: "70vh" }}>
              <div
                className="relative mx-auto"
                style={{
                  width: `${maxX + 40}px`,
                  height: `${maxY + 40}px`,
                  minWidth: "100%",
                }}
              >
                {/* Section labels */}
                {Array.from(new Set(filteredTables.map((t) => t.section))).map((section) => {
                  const sectionTables = filteredTables.filter((t) => t.section === section);
                  const minX = Math.min(...sectionTables.map((t) => t.x));
                  const minY = Math.min(...sectionTables.map((t) => t.y));
                  const sectionColor = SECTION_COLORS[section] || "#888";
                  return (
                    <div
                      key={section}
                      className="absolute text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        left: minX,
                        top: Math.max(0, minY - 22),
                        color: sectionColor,
                        backgroundColor: `${sectionColor}15`,
                      }}
                    >
                      {section}
                    </div>
                  );
                })}

                {/* Tables */}
                {filteredTables.map((table) => {
                  const meta = TABLE_STATUS_META[table.status] || TABLE_STATUS_META.open;
                  const hasOrder = table.orders?.length > 0;
                  return (
                    <button
                      key={table.id}
                      onClick={() => setSelected(table)}
                      className={`absolute group flex flex-col items-center justify-center text-white shadow-md hover:shadow-lg hover:scale-105 transition-all ring-2 ${meta.ring}`}
                      style={{
                        left: `${table.x}px`,
                        top: `${table.y}px`,
                        width: `${table.width}px`,
                        height: `${table.height}px`,
                        backgroundColor: meta.cls.replace("bg-", "").includes("slate") ? "#94a3b8" : undefined,
                        borderRadius: table.shape === "round" ? "9999px" : "12px",
                      }}
                    >
                      <div className="absolute inset-0 rounded-[inherit] opacity-90" style={{ backgroundColor: getHexForStatus(table.status) }} />
                      <div className="relative flex flex-col items-center justify-center">
                        <div className="text-base font-bold leading-none">#{table.number}</div>
                        <div className="text-[10px] opacity-90 mt-0.5 flex items-center gap-0.5">
                          <Users className="size-2.5" />
                          {table.capacity}
                        </div>
                        {hasOrder && (
                          <div className="absolute -top-1.5 -end-1.5 size-3 bg-white rounded-full ring-2 ring-emerald-500" />
                        )}
                      </div>
                      {table.serverName && (
                        <div className="absolute -bottom-5 text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                          {table.serverName}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected table dialog */}
      {selected && (
        <TableStatusDialog
          table={selected}
          onClose={() => setSelected(null)}
          onUpdate={(status) => updateStatus(selected.id, status)}
        />
      )}

      {/* Add table dialog */}
      {addOpen && (
        <AddTableDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ["tables", "admin"] });
          }}
          existingNumbers={tables.map((t) => t.number)}
        />
      )}
    </div>
  );
}

function getHexForStatus(status: string): string {
  const map: Record<string, string> = {
    open: "#10b981",
    seated: "#f59e0b",
    ordered: "#0ea5e9",
    served: "#8b5cf6",
    paid: "#059669",
    cleaning: "#94a3b8",
    reserved: "#ef4444",
  };
  return map[status] || "#10b981";
}

function TableStatusDialog({
  table, onClose, onUpdate,
}: {
  table: any;
  onClose: () => void;
  onUpdate: (status: string) => void;
}) {
  const { t, isRTL, locale, fmtTime } = useI18n();
  const meta = TABLE_STATUS_META[table.status] || TABLE_STATUS_META.open;
  const nextStatuses = Object.keys(TABLE_STATUS_META).filter((s) => s !== table.status);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="size-10 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: getHexForStatus(table.status), borderRadius: table.shape === "round" ? "9999px" : "8px" }}
            >
              #{table.number}
            </div>
            <div>
              <div>{isRTL ? `طاولة ${table.number}` : `Table ${table.number}`}</div>
              <div className="text-xs font-normal text-muted-foreground">{meta.label[locale]} · {table.section}</div>
            </div>
          </DialogTitle>
          <DialogDescription>{t.admin.tables} — {table.number}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.admin.capacity}</div>
            <div className="font-semibold flex items-center gap-1">
              <Users className="size-3.5" />
              {table.capacity} {isRTL ? "أشخاص" : "seats"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.admin.status}</div>
            <div className="font-semibold">{meta.label[locale]}</div>
          </div>
          {table.serverName && (
            <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{isRTL ? "النادل" : "Server"}</div>
              <div className="font-semibold">{table.serverName}</div>
            </div>
          )}
          {table.seatedAt && (
            <div className="col-span-2 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{isRTL ? "وقت الجلوس" : "Seated at"}</div>
              <div className="font-semibold flex items-center gap-1">
                <Clock className="size-3.5" />
                {fmtTime(table.seatedAt)}
              </div>
            </div>
          )}
        </div>

        {/* Status quick change */}
        <div className="space-y-2">
          <Label className="text-xs">{isRTL ? "تغيير الحالة" : "Change status"}</Label>
          <div className="grid grid-cols-2 gap-2">
            {nextStatuses.map((s) => {
              const m = TABLE_STATUS_META[s];
              return (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="justify-start gap-2 h-auto py-2"
                  onClick={() => onUpdate(s)}
                >
                  <span className={`size-2.5 rounded-full`} style={{ backgroundColor: getHexForStatus(s) }} />
                  <span className="text-xs">{m.label[locale]}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTableDialog({
  onClose, onSaved, existingNumbers,
}: {
  onClose: () => void;
  onSaved: () => void;
  existingNumbers: number[];
}) {
  const { t, isRTL } = useI18n();
  const nextNum = Math.max(0, ...existingNumbers) + 1;
  const [form, setForm] = useState<any>({
    number: nextNum,
    capacity: 4,
    section: "main",
    shape: "square",
    x: 20,
    y: 20,
    width: 90,
    height: 90,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (existingNumbers.includes(Number(form.number))) {
      toast.error(isRTL ? "رقم الطاولة مستخدم" : "Table number already exists");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/tables", { method: "POST", body: JSON.stringify(form) });
      toast.success(isRTL ? "تمت الإضافة" : "Table created");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.admin.addTable}</DialogTitle>
          <DialogDescription>{t.admin.tables}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t.admin.number}</Label>
            <Input type="number" value={form.number} onChange={(e) => set("number", parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.capacity}</Label>
            <Input type="number" value={form.capacity} onChange={(e) => set("capacity", parseInt(e.target.value) || 1)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.section}</Label>
            <Select value={form.section} onValueChange={(v) => set("section", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main</SelectItem>
                <SelectItem value="patio">Patio</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.shape}</Label>
            <Select value={form.shape} onValueChange={(v) => set("shape", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="round">Round</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 col-span-2">
            <div className="space-y-1.5">
              <Label>X</Label>
              <Input type="number" value={form.x} onChange={(e) => set("x", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Y</Label>
              <Input type="number" value={form.y} onChange={(e) => set("y", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>W</Label>
              <Input type="number" value={form.width} onChange={(e) => set("width", parseFloat(e.target.value) || 90)} />
            </div>
            <div className="space-y-1.5">
              <Label>H</Label>
              <Input type="number" value={form.height} onChange={(e) => set("height", parseFloat(e.target.value) || 90)} />
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
