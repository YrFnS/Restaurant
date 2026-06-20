"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Armchair, Plus, Trash2, Save, RotateCcw,
  Grid3x3, Eye, Move,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

const sectionColors: Record<string, string> = {
  main: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  patio: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800",
  bar: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800",
  private: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
};

const statusColors: Record<string, string> = {
  open: "border-green-400 bg-green-50 dark:bg-green-950/30",
  seated: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  ordered: "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  served: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  paid: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
  cleaning: "border-gray-400 bg-gray-50 dark:bg-gray-800/30",
  reserved: "border-red-400 bg-red-50 dark:bg-red-950/30",
};

export default function AdminFloorEditorPage() {
  const { t, isRTL } = useI18n();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [newTable, setNewTable] = useState({ number: "", capacity: "4", section: "main", shape: "square" });

  const { data, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
  });
  const tables: any[] = data?.tables || [];

  const updateLocalPos = useCallback((id: string, x: number, y: number) => {
    setLocalPositions((prev) => ({ ...prev, [id]: { x, y } }));
  }, []);

  const handleMouseDown = (e: React.MouseEvent, table: any) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = localPositions[table.id] || { x: table.x, y: table.y };
    setDragOffset({
      x: e.clientX - rect.left - pos.x,
      y: e.clientY - rect.top - pos.y,
    });
    setDraggingId(table.id);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left - dragOffset.x;
    let y = e.clientY - rect.top - dragOffset.y;
    // constrain to canvas
    x = Math.max(0, Math.min(rect.width - 90, x));
    y = Math.max(0, Math.min(rect.height - 90, y));
    // snap to grid (20px)
    if (snapToGrid) {
      x = Math.round(x / 20) * 20;
      y = Math.round(y / 20) * 20;
    }
    updateLocalPos(draggingId, x, y);
  }, [draggingId, dragOffset, snapToGrid, updateLocalPos]);

  const handleMouseUp = useCallback(async () => {
    if (!draggingId) return;
    const table = tables.find((t) => t.id === draggingId);
    const pos = localPositions[draggingId];
    if (table && pos) {
      // save to server
      try {
        await fetch("/api/tables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draggingId, x: pos.x, y: pos.y }),
        });
        qc.invalidateQueries({ queryKey: ["tables"] });
      } catch {
        toast.error(t.common.error);
      }
    }
    setDraggingId(null);
  }, [draggingId, tables, localPositions, qc, t]);

  const saveAll = async () => {
    const updates = Object.entries(localPositions);
    for (const [id, pos] of updates) {
      await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, x: pos.x, y: pos.y }),
      });
    }
    qc.invalidateQueries({ queryKey: ["tables"] });
    setLocalPositions({});
    toast.success(isRTL ? "تم حفظ التخطيط" : "Layout saved");
  };

  const resetLayout = () => {
    setLocalPositions({});
    toast.info(isRTL ? "تم إعادة التعيين" : "Reset to saved");
  };

  const addTable = async () => {
    const num = parseInt(newTable.number);
    if (!num) { toast.error(isRTL ? "أدخل رقم الطاولة" : "Enter table number"); return; }
    if (tables.some((t) => t.number === num)) { toast.error(isRTL ? "الرقم موجود" : "Number exists"); return; }
    try {
      await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: num,
          capacity: parseInt(newTable.capacity) || 4,
          section: newTable.section,
          shape: newTable.shape,
          x: 20 + (tables.length % 5) * 100,
          y: 20 + Math.floor(tables.length / 5) * 100,
          width: 90, height: 90,
        }),
      });
      qc.invalidateQueries({ queryKey: ["tables"] });
      toast.success(isRTL ? `تمت إضافة طاولة ${num}` : `Table ${num} added`);
      setNewTable({ ...newTable, number: "" });
    } catch {
      toast.error(t.common.error);
    }
  };

  const deleteTable = async (id: string, num: number) => {
    if (!confirm(isRTL ? `حذف طاولة ${num}؟` : `Delete table ${num}?`)) return;
    await fetch(`/api/tables/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["tables"] });
    toast.success(isRTL ? `تم حذف طاولة ${num}` : `Table ${num} deleted`);
  };

  const sections = ["main", "patio", "bar", "private"];
  const sectionLabels: Record<string, { en: string; ar: string }> = {
    main: { en: "Main Hall", ar: "القاعة الرئيسية" },
    patio: { en: "Patio", ar: "الفناء" },
    bar: { en: "Bar", ar: "البار" },
    private: { en: "Private", ar: "خاص" },
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Grid3x3 className="size-5 text-primary" />
                {isRTL ? "محرر مخطط الطاولات" : "Floor Plan Editor"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "اسحب الطاولات لإعادة الترتيب" : "Drag tables to rearrange the floor"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowGrid(!showGrid)}>
              <Grid3x3 className="size-4" />
              {showGrid ? (isRTL ? "إخفاء الشبكة" : "Hide Grid") : (isRTL ? "إظهار الشبكة" : "Show Grid")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSnapToGrid(!snapToGrid)}>
              <Move className="size-4" />
              {snapToGrid ? (isRTL ? "إلغاء المحاذاة" : "Unsnap") : (isRTL ? "محاذاة" : "Snap")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={resetLayout}>
              <RotateCcw className="size-4" />
              {isRTL ? "إعادة" : "Reset"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={saveAll} disabled={Object.keys(localPositions).length === 0}>
              <Save className="size-4" />
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Canvas */}
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="p-4">
                  <div
                    ref={canvasRef}
                    className="relative w-full h-[600px] rounded-xl border-2 border-dashed border-border overflow-hidden bg-accent/10"
                    style={showGrid ? {
                      backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    } : {}}
                  >
                    {/* Section dividers */}
                    {sections.map((sec) => {
                      const secTables = tables.filter((t) => t.section === sec);
                      if (secTables.length === 0) return null;
                      const minX = Math.min(...secTables.map((t) => localPositions[t.id]?.x ?? t.x));
                      const minY = Math.min(...secTables.map((t) => localPositions[t.id]?.y ?? t.y));
                      const maxX = Math.max(...secTables.map((t) => (localPositions[t.id]?.x ?? t.x) + t.width));
                      const maxY = Math.max(...secTables.map((t) => (localPositions[t.id]?.y ?? t.y) + t.height));
                      return (
                        <div
                          key={sec}
                          className="absolute border border-dashed border-primary/20 rounded-lg pointer-events-none"
                          style={{
                            left: minX - 10, top: minY - 25,
                            width: maxX - minX + 20, height: maxY - minY + 35,
                          }}
                        >
                          <span className="absolute -top-5 start-2 text-[10px] font-bold uppercase tracking-wider text-primary/50">
                            {isRTL ? sectionLabels[sec].ar : sectionLabels[sec].en}
                          </span>
                        </div>
                      );
                    })}

                    {/* Tables */}
                    {tables.map((table) => {
                      const pos = localPositions[table.id] || { x: table.x, y: table.y };
                      const isDragging = draggingId === table.id;
                      return (
                        <div
                          key={table.id}
                          onMouseDown={(e) => handleMouseDown(e, table)}
                          className={`absolute cursor-grab active:cursor-grabbing select-none transition-shadow ${
                            isDragging ? "shadow-xl z-50 scale-105" : "shadow-md hover:shadow-lg z-10"
                          } ${statusColors[table.status] || statusColors.open} border-2 rounded-xl flex flex-col items-center justify-center`}
                          style={{
                            left: pos.x, top: pos.y,
                            width: table.width, height: table.height,
                            borderRadius: table.shape === "round" ? "50%" : "0.75rem",
                          }}
                        >
                          <span className="font-bold text-lg">{table.number}</span>
                          <span className="text-[10px] text-muted-foreground">{table.capacity} {isRTL ? "مقاعد" : "seats"}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTable(table.id, table.number); }}
                            className="absolute -top-2 -end-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                            style={{ opacity: isDragging ? 0 : 1 }}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <Move className="size-3" />
                    {isRTL ? "اسحب الطاولات لإعادة الترتيب — يتم الحفظ تلقائياً عند الإفلات" : "Drag tables to rearrange — saved automatically on drop"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar: Add table + legend */}
            <div className="space-y-4">
              {/* Add table */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Plus className="size-4 text-primary" />
                    {isRTL ? "إضافة طاولة" : "Add Table"}
                  </h3>
                  <div>
                    <Label className="text-xs">{isRTL ? "الرقم" : "Number"}</Label>
                    <Input type="number" value={newTable.number} onChange={(e) => setNewTable({ ...newTable, number: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? "السعة" : "Capacity"}</Label>
                    <Input type="number" value={newTable.capacity} onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? "القسم" : "Section"}</Label>
                    <select
                      value={newTable.section}
                      onChange={(e) => setNewTable({ ...newTable, section: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {sections.map((s) => (
                        <option key={s} value={s}>{isRTL ? sectionLabels[s].ar : sectionLabels[s].en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">{isRTL ? "الشكل" : "Shape"}</Label>
                    <select
                      value={newTable.shape}
                      onChange={(e) => setNewTable({ ...newTable, shape: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="square">{isRTL ? "مربع" : "Square"}</option>
                      <option value="round">{isRTL ? "دائري" : "Round"}</option>
                    </select>
                  </div>
                  <Button className="w-full gap-1.5" onClick={addTable}>
                    <Plus className="size-4" />
                    {isRTL ? "إضافة" : "Add"}
                  </Button>
                </CardContent>
              </Card>

              {/* Legend */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Eye className="size-4 text-primary" />
                    {isRTL ? "دليل الحالات" : "Status Legend"}
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { status: "open", label: isRTL ? "متاحة" : "Open" },
                      { status: "seated", label: isRTL ? "جلس" : "Seated" },
                      { status: "ordered", label: isRTL ? "طلبت" : "Ordered" },
                      { status: "served", label: isRTL ? "قُدمت" : "Served" },
                      { status: "paid", label: isRTL ? "مدفوعة" : "Paid" },
                      { status: "cleaning", label: isRTL ? "تنظيف" : "Cleaning" },
                      { status: "reserved", label: isRTL ? "محجوزة" : "Reserved" },
                    ].map((s) => (
                      <div key={s.status} className="flex items-center gap-2 text-xs">
                        <div className={`size-4 rounded border-2 ${statusColors[s.status]}`} />
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-2">{isRTL ? "إحصائيات" : "Stats"}</h3>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">{isRTL ? "إجمالي الطاولات" : "Total Tables"}</span><span className="font-bold">{tables.length}</span></div>
                    {sections.map((s) => {
                      const count = tables.filter((t) => t.section === s).length;
                      return (
                        <div key={s} className="flex justify-between">
                          <span className="text-muted-foreground">{isRTL ? sectionLabels[s].ar : sectionLabels[s].en}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      );
                    })}
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
