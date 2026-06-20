"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Package, AlertTriangle, TrendingDown, DollarSign,
  Boxes, ShoppingCart, Plus, Minus, Phone,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

export default function AdminInventoryDashboardPage() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [updating, setUpdating] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await fetch("/api/inventory")).json(),
    refetchInterval: 30000,
  });

  const items: any[] = data?.items || [];
  const lowStock = items.filter((i) => i.quantity <= i.lowThreshold);
  const outOfStock = items.filter((i) => i.quantity <= 0);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);
  const lowStockValue = lowStock.reduce((s, i) => s + i.costPerUnit * (i.lowThreshold - i.quantity), 0);

  // Suggested reorders: items below threshold, suggest ordering up to 2x threshold
  const reorderSuggestions = lowStock.map((i) => ({
    ...i,
    suggestedQty: Math.max(i.lowThreshold * 2 - Math.round(i.quantity), 1),
    suggestedCost: Math.max(i.lowThreshold * 2 - Math.round(i.quantity), 1) * i.costPerUnit,
  }));

  const adjustQty = async (item: any, delta: number) => {
    setUpdating(item.id);
    try {
      const newQty = Math.max(0, item.quantity + delta);
      await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, quantity: newQty }),
      });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`${item.name}: ${newQty} ${item.unit}`);
    } catch {
      toast.error(t.common.error);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Boxes className="size-5 text-primary" />
                {isRTL ? "لوحة المخزون" : "Inventory Dashboard"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "مراقبة المخزون واقتراحات إعادة الطلب" : "Stock monitoring and reorder suggestions"}
              </p>
            </div>
          </div>
          <Badge variant={lowStock.length > 0 ? "destructive" : "secondary"} className="gap-1.5">
            <AlertTriangle className="size-3" />
            {lowStock.length} {isRTL ? "منخفض" : "low"}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "إجمالي الأصناف" : "Total Items"}</span>
                    <Boxes className="size-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold">{items.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500/5 to-red-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "مخزون منخفض" : "Low Stock"}</span>
                    <AlertTriangle className="size-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{lowStock.length}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{outOfStock.length} {isRTL ? "نفد" : "out of stock"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "قيمة المخزون" : "Stock Value"}</span>
                    <DollarSign className="size-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">{fmtCurrency(totalValue)}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "تكلفة إعادة الطلب" : "Reorder Cost"}</span>
                    <ShoppingCart className="size-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{fmtCurrency(lowStockValue)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Reorder suggestions */}
            {reorderSuggestions.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900/50">
                <CardContent className="p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <ShoppingCart className="size-4" />
                    {isRTL ? "اقتراحات إعادة الطلب" : "Reorder Suggestions"}
                  </h3>
                  <div className="space-y-2">
                    {reorderSuggestions.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50"
                      >
                        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${item.quantity <= 0 ? "bg-red-100 dark:bg-red-950 text-red-700" : "bg-amber-100 dark:bg-amber-950 text-amber-700"}`}>
                          <Package className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{item.name}</span>
                            {item.quantity <= 0 && <Badge variant="destructive" className="text-[9px]">OUT</Badge>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {isRTL ? "الحالي" : "Current"}: <span className="font-semibold text-red-600">{Math.round(item.quantity)}</span> / {item.lowThreshold} {item.unit}
                            {item.supplier && <span className="ms-2">· {item.supplier}</span>}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                            +{item.suggestedQty} {item.unit}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{fmtCurrency(item.suggestedCost)}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All inventory with quick adjust */}
            <div>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Package className="size-4 text-primary" />
                {isRTL ? "كل المخزون" : "All Inventory"}
              </h3>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const isLow = item.quantity <= item.lowThreshold;
                  const isOut = item.quantity <= 0;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    >
                      <Card className={isOut ? "border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20" : isLow ? "border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isOut ? "bg-red-100 dark:bg-red-950 text-red-700" : isLow ? "bg-amber-100 dark:bg-amber-950 text-amber-700" : "bg-muted text-muted-foreground"
                          }`}>
                            <Package className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate">{item.name}</span>
                              {isOut && <Badge variant="destructive" className="text-[9px]">{isRTL ? "نفد" : "OUT"}</Badge>}
                              {isLow && !isOut && <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{isRTL ? "منخفض" : "LOW"}</Badge>}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.supplier || "—"} · {fmtCurrency(item.costPerUnit)}/{item.unit}
                            </div>
                          </div>
                          {/* Quantity bar */}
                          <div className="hidden sm:flex flex-col items-end gap-0.5 w-24 shrink-0">
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(100, (item.quantity / (item.lowThreshold * 2)) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{item.lowThreshold} {isRTL ? "حد" : "min"}</span>
                          </div>
                          {/* Quick adjust */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => adjustQty(item, -1)}
                              disabled={updating === item.id}
                              className="size-7 rounded-lg border border-border hover:bg-accent flex items-center justify-center"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className={`w-12 text-center font-bold text-sm tabular-nums ${isOut ? "text-red-600" : isLow ? "text-amber-600" : ""}`}>
                              {Math.round(item.quantity)}
                            </span>
                            <button
                              onClick={() => adjustQty(item, 1)}
                              disabled={updating === item.id}
                              className="size-7 rounded-lg border border-border hover:bg-accent flex items-center justify-center"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
