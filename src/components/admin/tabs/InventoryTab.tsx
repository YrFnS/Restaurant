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
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Boxes, Plus, Pencil, Trash2, Search, Loader2, AlertTriangle,
  Package, TrendingDown, DollarSign, Layers,
} from "lucide-react";

export function InventoryTab() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [wasteDialog, setWasteDialog] = useState<{ open: boolean; item?: any }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", "admin"],
    queryFn: async () => (await fetch("/api/inventory")).json(),
  });
  const items: any[] = data?.items || [];
  const waste: any[] = data?.waste || [];

  const filtered = items.filter((i) => {
    if (search) {
      const q = search.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !(i.category || "").toLowerCase().includes(q) && !(i.supplier || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const lowStockItems = items.filter((i) => i.quantity <= i.lowThreshold);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);

  const remove = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذا المكوّن؟" : "Delete this ingredient?")) return;
    try {
      await apiFetch("/api/inventory", {
        method: "PATCH",
        body: JSON.stringify({ id, _delete: true }),
      });
      qc.invalidateQueries({ queryKey: ["inventory", "admin"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-amber-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{isRTL ? "إجمالي العناصر" : "Total Items"}</span>
              <Package className="size-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-1">{items.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-rose-50 to-red-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t.admin.lowStock}</span>
              <AlertTriangle className="size-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-rose-600">{lowStockItems.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-emerald-50 to-teal-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{isRTL ? "قيمة المخزون" : "Inventory Value"}</span>
              <DollarSign className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-700">{fmtCurrency(totalValue)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-br from-violet-50 to-purple-50/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{isRTL ? "سجلات الهدر" : "Waste Logs"}</span>
              <TrendingDown className="size-4 text-violet-600" />
            </div>
            <div className="text-2xl font-bold mt-1">{waste.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Boxes className="size-3.5" />
            {t.admin.inventory}
          </TabsTrigger>
          <TabsTrigger value="waste" className="gap-1.5">
            <TrendingDown className="size-3.5" />
            {isRTL ? "الهدر" : "Waste Log"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? "ابحث عن مكوّن..." : "Search ingredients..."}
                className="ps-9"
              />
            </div>
            <Button onClick={() => setDialog({ open: true })} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              {t.admin.addIngredient}
            </Button>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Boxes className="size-6" />}
                  title={isRTL ? "لا مكوّنات" : "No ingredients"}
                  action={
                    <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true })}>
                      <Plus className="size-4" />
                      {t.admin.addIngredient}
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "المكوّن" : "Ingredient"}</TableHead>
                        <TableHead className="hidden md:table-cell">{isRTL ? "الفئة" : "Category"}</TableHead>
                        <TableHead>{t.admin.quantity}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t.admin.costPerUnit}</TableHead>
                        <TableHead className="hidden lg:table-cell">{isRTL ? "المورد" : "Supplier"}</TableHead>
                        <TableHead>{t.admin.status}</TableHead>
                        <TableHead className="text-end pe-4">{t.admin.edit}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((it) => {
                        const isLow = it.quantity <= it.lowThreshold;
                        const pct = Math.min(100, Math.round((it.quantity / Math.max(it.lowThreshold * 2, 1)) * 100));
                        return (
                          <TableRow key={it.id} className={isLow ? "bg-rose-50/40" : "hover:bg-muted/30"}>
                            <TableCell className="ps-4">
                              <div className="font-medium text-sm">{it.name}</div>
                              <div className="text-xs text-muted-foreground">per {it.unit}</div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {it.category ? (
                                <Badge variant="outline" className="font-normal">{it.category}</Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-semibold">
                                {fmtNumber(it.quantity)} <span className="text-xs text-muted-foreground">{it.unit}</span>
                              </div>
                              <div className="h-1 mt-1 rounded-full bg-muted overflow-hidden w-24">
                                <div
                                  className={`h-full transition-all ${isLow ? "bg-rose-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {isRTL ? "حد" : "min"}: {it.lowThreshold}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {fmtCurrency(it.costPerUnit || 0)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {it.supplier || "—"}
                            </TableCell>
                            <TableCell>
                              {isLow ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  <AlertTriangle className="size-3 me-0.5" />
                                  {isRTL ? "منخفض" : "LOW"}
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                                  ✓ {t.common.available}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-end pe-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-violet-700 hover:text-violet-800"
                                  onClick={() => setWasteDialog({ open: true, item: it })}
                                >
                                  <TrendingDown className="size-3.5" />
                                  <span className="text-xs hidden sm:inline">{isRTL ? "هدر" : "Waste"}</span>
                                </Button>
                                <Button size="icon" variant="ghost" className="size-8" onClick={() => setDialog({ open: true, item: it })}>
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(it.id)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="size-4 text-violet-600" />
                {isRTL ? "سجل الهدر الأخير" : "Recent Waste Log"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {waste.length === 0 ? (
                <EmptyState icon={<TrendingDown className="size-6" />} title={isRTL ? "لا سجلات هدر" : "No waste logged"} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "المكوّن" : "Ingredient"}</TableHead>
                        <TableHead>{t.admin.quantity}</TableHead>
                        <TableHead className="hidden md:table-cell">{isRTL ? "السبب" : "Reason"}</TableHead>
                        <TableHead className="hidden lg:table-cell">{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                        <TableHead className="hidden sm:table-cell">{isRTL ? "المستخدم" : "By"}</TableHead>
                        <TableHead className="text-end pe-4">{isRTL ? "التاريخ" : "Date"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waste.slice(0, 30).map((w) => (
                        <TableRow key={w.id} className="hover:bg-muted/30">
                          <TableCell className="ps-4 font-medium text-sm">{w.ingredientName || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{w.quantity}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="secondary" className="text-[10px]">{w.reason}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{w.notes || "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{w.reportedBy || "—"}</TableCell>
                          <TableCell className="text-end pe-4 text-xs text-muted-foreground">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/edit dialog */}
      {dialog.open && (
        <IngredientDialog
          item={dialog.item}
          onClose={() => setDialog({ open: false })}
          onSaved={() => {
            setDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["inventory", "admin"] });
          }}
        />
      )}

      {/* Waste dialog */}
      {wasteDialog.open && (
        <WasteDialog
          item={wasteDialog.item}
          onClose={() => setWasteDialog({ open: false })}
          onSaved={() => {
            setWasteDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["inventory", "admin"] });
          }}
        />
      )}
    </div>
  );
}

function IngredientDialog({ item, onClose, onSaved }: { item?: any; onClose: () => void; onSaved: () => void }) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: item?.name || "",
    unit: item?.unit || "pcs",
    quantity: item?.quantity ?? 0,
    lowThreshold: item?.lowThreshold ?? 10,
    costPerUnit: item?.costPerUnit ?? 0,
    supplier: item?.supplier || "",
    category: item?.category || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name) {
      toast.error(isRTL ? "الاسم مطلوب" : "Name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        lowThreshold: Number(form.lowThreshold),
        costPerUnit: Number(form.costPerUnit),
      };
      if (item) {
        await apiFetch("/api/inventory", { method: "PATCH", body: JSON.stringify({ id: item.id, ...payload }) });
        toast.success(isRTL ? "تم الحفظ" : "Saved");
      } else {
        await apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(payload) });
        toast.success(isRTL ? "تمت الإضافة" : "Created");
      }
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
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            {item ? t.admin.editItem : t.admin.addIngredient}
          </DialogTitle>
          <DialogDescription>{t.admin.inventory}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{isRTL ? "الاسم *" : "Name *"}</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.unit}</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pcs", "kg", "g", "L", "ml", "pack", "box", "bottle"].map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "الفئة" : "Category"}</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="produce, dairy..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.quantity}</Label>
              <Input type="number" step="0.1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.lowThreshold}</Label>
              <Input type="number" step="0.1" value={form.lowThreshold} onChange={(e) => set("lowThreshold", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.costPerUnit}</Label>
              <Input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => set("costPerUnit", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.supplier}</Label>
            <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
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

function WasteDialog({ item, onClose, onSaved }: { item?: any; onClose: () => void; onSaved: () => void }) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    quantity: 1,
    reason: "expired",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (form.quantity <= 0) {
      toast.error(isRTL ? "الكمية غير صحيحة" : "Invalid quantity");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/inventory", {
        method: "POST",
        body: JSON.stringify({
          type: "waste",
          ingredientId: item?.id,
          ingredientName: item?.name,
          quantity: Number(form.quantity),
          reason: form.reason,
          notes: form.notes,
        }),
      });
      toast.success(isRTL ? "تم تسجيل الهدر" : "Waste logged");
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
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="size-5 text-violet-600" />
            {isRTL ? "تسجيل هدر" : "Log Waste"}
          </DialogTitle>
          <DialogDescription>
            {item?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
            {isRTL ? "المتوفر حالياً" : "Current quantity"}: <span className="font-semibold">{item?.quantity} {item?.unit}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.quantity}</Label>
              <Input type="number" step="0.1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "السبب" : "Reason"}</Label>
              <Select value={form.reason} onValueChange={(v) => set("reason", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expired">{isRTL ? "منتهي الصلاحية" : "Expired"}</SelectItem>
                  <SelectItem value="spoiled">{isRTL ? "تالف" : "Spoiled"}</SelectItem>
                  <SelectItem value="burnt">{isRTL ? "محروق" : "Burnt"}</SelectItem>
                  <SelectItem value="dropped">{isRTL ? "مسكوب" : "Dropped"}</SelectItem>
                  <SelectItem value="overportion">{isRTL ? "إفراط في الكمية" : "Over-portion"}</SelectItem>
                  <SelectItem value="other">{isRTL ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {isRTL ? "تسجيل" : "Log Waste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
