"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, UserCheck, Sparkles, Eraser, RefreshCw, MapPin, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TABLE_STATUS_COLORS,
  SECTION_META,
  type RestaurantTable,
  type TableStatus,
} from "./types";

interface FloorPlanProps {
  selectedTableId: string | null;
  onSelectTable: (table: RestaurantTable | null) => void;
  /** Called when "Occupy" is tapped — POS may auto-switch to menu view */
  onOccupy?: (table: RestaurantTable) => void;
}

export function FloorPlan({ selectedTableId, onSelectTable, onOccupy }: FloorPlanProps) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pos-tables"],
    queryFn: async () => {
      const r = await fetch("/api/tables");
      return (await r.json()) as { tables: RestaurantTable[] };
    },
    refetchInterval: 15_000,
  });

  const tables = data?.tables ?? [];
  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) ?? null,
    [tables, selectedTableId]
  );

  // Group tables by section for legend + dividers
  const sections = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();
    for (const t of tables) {
      const arr = map.get(t.section) ?? [];
      arr.push(t);
      map.set(t.section, arr);
    }
    return Array.from(map.entries());
  }, [tables]);

  // Compute canvas bounds for the absolute-positioned floor
  const bounds = useMemo(() => {
    if (tables.length === 0) return { w: 1000, h: 600 };
    let maxX = 0, maxY = 0;
    for (const t of tables) {
      maxX = Math.max(maxX, t.x + t.width);
      maxY = Math.max(maxY, t.y + t.height);
    }
    return { w: maxX + 60, h: maxY + 60 };
  }, [tables]);

  // Stats strip
  const stats = useMemo(() => {
    const out: Record<TableStatus, number> = {
      open: 0, seated: 0, ordered: 0, served: 0, paid: 0, cleaning: 0, reserved: 0,
    };
    for (const t of tables) out[t.status] = (out[t.status] ?? 0) + 1;
    return out;
  }, [tables]);

  async function patchTable(id: string, status: TableStatus, serverName?: string) {
    try {
      const r = await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update",
          id,
          status,
          serverName: serverName ?? "",
        }),
      });
      if (!r.ok) throw new Error("Failed");
      await qc.invalidateQueries({ queryKey: ["pos-tables"] });
      return true;
    } catch {
      toast.error(t.common.error);
      return false;
    }
  }

  async function handleOccupy(table: RestaurantTable) {
    const ok = await patchTable(table.id, "seated", table.serverName || "Server");
    if (ok) {
      toast.success(`${t.pos.occupy} — #${table.number}`);
      onOccupy?.({ ...table, status: "seated" });
    }
  }

  async function handleClear(table: RestaurantTable) {
    // First set to cleaning, then after a brief delay set to open
    const ok = await patchTable(table.id, "cleaning", "");
    if (ok) {
      toast.success(t.pos.clear + ` — #${table.number}`);
      // Auto-clear to open after 1.2s for snappy demo
      setTimeout(async () => {
        await patchTable(table.id, "open", "");
      }, 1200);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const statusLegend: TableStatus[] = [
    "open", "seated", "ordered", "served", "paid", "cleaning", "reserved",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Legend + stats */}
      <div className="border-b border-border bg-card/50 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide me-1">
            {t.pos.tables}:
          </span>
          {statusLegend.map((s) => {
            const c = TABLE_STATUS_COLORS[s];
            const label = (t.pos as any)[s] ?? s;
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}
              >
                <span className={`size-2 rounded-full ${c.dot}`} />
                {label}
                <span className="opacity-60">·</span>
                <span className="font-bold tabular-nums">{stats[s] ?? 0}</span>
              </span>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto h-8 px-2"
            onClick={() => refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable floor canvas */}
      <div className="flex-1 overflow-auto scroll-thin bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,oklch(0.94_0.01_60)_39px,oklch(0.94_0.01_60)_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,oklch(0.94_0.01_60)_39px,oklch(0.94_0.01_60)_40px)]">
        <div
          className="relative mx-auto"
          style={{ width: bounds.w, height: bounds.h, minWidth: "100%" }}
        >
          {/* Section labels & dividers */}
          {sections.map(([section, list]) => {
            const meta = SECTION_META[section] ?? {
              labelEn: section, labelAr: section, icon: "🍽️",
            };
            // Compute section bounding box
            const minX = Math.min(...list.map((t) => t.x)) - 20;
            const minY = Math.min(...list.map((t) => t.y)) - 26;
            const maxX = Math.max(...list.map((t) => t.x + t.width)) + 20;
            const maxY = Math.max(...list.map((t) => t.y + t.height)) + 20;
            return (
              <div
                key={section}
                className="absolute pointer-events-none border-2 border-dashed border-border/60 rounded-2xl"
                style={{
                  left: minX,
                  top: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                }}
              >
                <div className="absolute -top-3 start-3 bg-background/90 backdrop-blur px-2 py-0.5 rounded-md text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  <span className="me-1">{meta.icon}</span>
                  {isRTL ? meta.labelAr : meta.labelEn}
                </div>
              </div>
            );
          })}

          {/* Tables */}
          {tables.map((table) => {
            const c = TABLE_STATUS_COLORS[table.status];
            const isSelected = table.id === selectedTableId;
            const shapeClass =
              table.shape === "round" ? "rounded-full" : "rounded-xl";
            return (
              <button
                key={table.id}
                onClick={() => onSelectTable(isSelected ? null : table)}
                aria-pressed={isSelected}
                aria-label={`Table ${table.number} — ${table.status}`}
                className={`absolute ${shapeClass} ${c.bg} ${c.text} border-2 ${c.border} flex flex-col items-center justify-center text-center transition-all hover:scale-105 hover:shadow-lg active:scale-95 ${
                  isSelected
                    ? `ring-4 ${c.ring} ring-offset-2 ring-offset-background shadow-lg z-10`
                    : "shadow-sm"
                }`}
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                  minHeight: 56,
                }}
              >
                <span className="text-base font-bold leading-none">
                  #{table.number}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] opacity-80">
                  <Users className="size-2.5" />
                  {table.capacity}
                </span>
                {table.serverName && table.status !== "open" && (
                  <span className="mt-0.5 text-[9px] font-medium opacity-75 truncate max-w-full px-1">
                    {table.serverName}
                  </span>
                )}
                {table.status === "ordered" && (
                  <span className="absolute -top-1 -end-1 size-3 rounded-full bg-orange-500 ring-2 ring-background" />
                )}
                {table.status === "paid" && (
                  <span className="absolute -top-1 -end-1 size-3 rounded-full bg-teal-500 ring-2 ring-background" />
                )}
              </button>
            );
          })}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">{t.pos.noTableSelected}</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected table action bar */}
      {selectedTable && (
        <div className="border-t border-border bg-card p-3">
          <div className="flex items-center gap-3 mb-2.5">
            <div className={`flex size-12 items-center justify-center rounded-xl border-2 ${
              TABLE_STATUS_COLORS[selectedTable.status].border
            } ${TABLE_STATUS_COLORS[selectedTable.status].bg}`}>
              <span className={`font-bold ${TABLE_STATUS_COLORS[selectedTable.status].text}`}>
                #{selectedTable.number}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">
                  {t.pos.tables} #{selectedTable.number}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  TABLE_STATUS_COLORS[selectedTable.status].bg
                } ${TABLE_STATUS_COLORS[selectedTable.status].text} ${
                  TABLE_STATUS_COLORS[selectedTable.status].border
                } border`}>
                  <span className={`size-1.5 rounded-full ${TABLE_STATUS_COLORS[selectedTable.status].dot}`} />
                  {(t.pos as any)[selectedTable.status] ?? selectedTable.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {t.pos.capacity.replace("{n}", String(selectedTable.capacity))}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {SECTION_META[selectedTable.section]?.[isRTL ? "labelAr" : "labelEn"] ?? selectedTable.section}
                </span>
                {selectedTable.serverName && (
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="size-3" />
                    {selectedTable.serverName}
                  </span>
                )}
                {selectedTable.orders && selectedTable.orders[0] && (
                  <span className="font-medium text-foreground">
                    {selectedTable.orders[0].orderNumber} · {fmtCurrency(selectedTable.orders[0].total)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="lg"
              variant={selectedTable.status === "seated" || selectedTable.status === "ordered" ? "secondary" : "default"}
              className="h-12"
              onClick={() => handleOccupy(selectedTable)}
              disabled={selectedTable.status === "ordered" || selectedTable.status === "served"}
            >
              <UserCheck className="size-4" />
              {t.pos.occupy}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12"
              onClick={() => onOccupy?.(selectedTable)}
            >
              <Sparkles className="size-4" />
              {t.pos.newOrder}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleClear(selectedTable)}
              disabled={selectedTable.status === "open"}
            >
              <Eraser className="size-4" />
              {t.pos.clear}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FloorPlanBackButton({ onClick }: { onClick: () => void }) {
  const { t, isRTL } = useI18n();
  return (
    <Button variant="ghost" size="sm" className="h-9" onClick={onClick}>
      <ChevronLeft className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
      {t.common.back}
    </Button>
  );
}
