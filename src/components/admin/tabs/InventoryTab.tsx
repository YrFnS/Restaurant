"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Boxes,
  DollarSign,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Trash2,
  TrendingDown,
} from "lucide-react";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  lowThreshold: number;
  costPerUnit: number;
  allowNegativeStock: boolean;
  supplier: string | null;
  category: string | null;
}

interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  movementType: string;
  quantityDelta: number;
  totalCost: number;
  balanceAfter: number;
  reasonCode: string;
  reason: string | null;
  sourceType: string;
  sourceId: string | null;
  reversalOfId: string | null;
}

interface RecipeComponent {
  id: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: string;
  modifierOptionId: string | null;
  modifierNameEn: string | null;
  modifierNameAr: string | null;
  quantity: number;
}

interface Recipe {
  id: string;
  menuItemId: string;
  menuItemNameEn: string;
  menuItemNameAr: string;
  version: number;
  yieldQuantity: number;
  createdByName: string;
  components: RecipeComponent[];
}

interface MenuItemOption {
  id: string;
  nameEn: string;
  nameAr: string;
  modifierGroups?: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    options: Array<{ id: string; nameEn: string; nameAr: string }>;
  }>;
}

type View = "inventory" | "movements" | "recipes";
type MovementMode = "receipt" | "waste" | "adjustment_in" | "adjustment_out";

function newKey(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}:${suffix}`;
}

function movementLabel(type: string, isRTL: boolean): string {
  const labels: Record<string, { en: string; ar: string }> = {
    opening_balance: { en: "Opening balance", ar: "رصيد افتتاحي" },
    receipt: { en: "Receipt", ar: "استلام" },
    waste: { en: "Waste", ar: "هدر" },
    adjustment_in: { en: "Adjustment in", ar: "تسوية زيادة" },
    adjustment_out: { en: "Adjustment out", ar: "تسوية نقص" },
    production_consumption: { en: "Production", ar: "استهلاك إنتاج" },
    reversal: { en: "Reversal", ar: "عكس حركة" },
  };
  return labels[type]?.[isRTL ? "ar" : "en"] || type;
}

export function InventoryTab() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("inventory");
  const [search, setSearch] = useState("");
  const [ingredientEditor, setIngredientEditor] = useState<Ingredient | null | "new">(
    null
  );
  const [movementEditor, setMovementEditor] = useState<{
    item: Ingredient;
    mode: MovementMode;
  } | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "admin"],
    queryFn: async () => apiFetch("/api/inventory"),
  });
  const movementQuery = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: async () => apiFetch("/api/inventory/movements?limit=150"),
  });
  const recipeQuery = useQuery({
    queryKey: ["inventory", "recipes"],
    queryFn: async () => apiFetch("/api/inventory/recipes"),
  });
  const menuQuery = useQuery({
    queryKey: ["menu", "inventory-recipes"],
    queryFn: async () => apiFetch("/api/menu?all=true"),
  });

  const items: Ingredient[] = inventoryQuery.data?.items || [];
  const movements: StockMovement[] = movementQuery.data?.movements || [];
  const recipes: Recipe[] = recipeQuery.data?.recipes || [];
  const menuItems: MenuItemOption[] = useMemo(
    () =>
      (menuQuery.data?.categories || []).flatMap(
        (category: { items?: MenuItemOption[] }) => category.items || []
      ),
    [menuQuery.data]
  );
  const lowStock = items.filter((item) => item.quantity <= item.lowThreshold);
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.costPerUnit,
    0
  );
  const filtered = items.filter((item) =>
    [item.name, item.category || "", item.supplier || ""]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["inventory"] }),
      qc.invalidateQueries({ queryKey: ["menu"] }),
    ]);
  };

  if (inventoryQuery.isLoading) return <AdminLoading label={t.common.loading} />;

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label={isRTL ? "المكوّنات" : "Ingredients"} value={String(items.length)} icon={<Package className="size-4 text-primary" />} />
        <Metric label={t.admin.lowStock} value={String(lowStock.length)} icon={<AlertTriangle className="size-4 text-rose-600" />} />
        <Metric label={isRTL ? "قيمة المخزون" : "Inventory value"} value={fmtCurrency(totalValue)} icon={<DollarSign className="size-4 text-emerald-600" />} />
        <Metric label={isRTL ? "الوصفات النشطة" : "Active recipes"} value={String(recipes.length)} icon={<BookOpen className="size-4 text-violet-600" />} />
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <ViewButton active={view === "inventory"} onClick={() => setView("inventory")} icon={<Boxes className="size-3.5" />} label={t.admin.inventory} />
          <ViewButton active={view === "movements"} onClick={() => setView("movements")} icon={<History className="size-3.5" />} label={isRTL ? "سجل المخزون" : "Stock ledger"} />
          <ViewButton active={view === "recipes"} onClick={() => setView("recipes")} icon={<BookOpen className="size-3.5" />} label={isRTL ? "الوصفات" : "Recipes"} />
        </div>
        {view === "inventory" && (
          <Button size="sm" className="gap-1.5" onClick={() => setIngredientEditor("new")}>
            <Plus className="size-4" />
            {t.admin.addIngredient}
          </Button>
        )}
        {view === "recipes" && (
          <Button size="sm" className="gap-1.5" onClick={() => setRecipeOpen(true)}>
            <Plus className="size-4" />
            {isRTL ? "نشر وصفة" : "Publish recipe"}
          </Button>
        )}
      </div>

      {view === "inventory" && (
        <>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="ps-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRTL ? "ابحث عن مكوّن" : "Search ingredients"} />
          </div>
          <Card className="border-border/60">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <EmptyState icon={<Boxes className="size-6" />} title={isRTL ? "لا توجد مكوّنات" : "No ingredients"} />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "المكوّن" : "Ingredient"}</TableHead>
                        <TableHead>{t.admin.quantity}</TableHead>
                        <TableHead className="hidden md:table-cell">{t.admin.costPerUnit}</TableHead>
                        <TableHead>{t.admin.status}</TableHead>
                        <TableHead className="text-end pe-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => {
                        const isLow = item.quantity <= item.lowThreshold;
                        return (
                          <TableRow key={item.id} className={isLow ? "bg-rose-50/40" : ""}>
                            <TableCell className="ps-4">
                              <div className="font-medium text-sm">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.category || "—"} · {item.supplier || "—"}</div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{fmtNumber(item.quantity)} {item.unit}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm">{fmtCurrency(item.costPerUnit)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={isLow ? "destructive" : "secondary"}>{isLow ? (isRTL ? "منخفض" : "Low") : (isRTL ? "متاح" : "Available")}</Badge>
                                {item.allowNegativeStock && <Badge variant="outline">{isRTL ? "يسمح بالسالب" : "Negative allowed"}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="pe-4">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="size-8 text-emerald-700" title={isRTL ? "استلام" : "Receive"} onClick={() => setMovementEditor({ item, mode: "receipt" })}><ArrowDownToLine className="size-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="size-8 text-rose-700" title={isRTL ? "هدر" : "Waste"} onClick={() => setMovementEditor({ item, mode: "waste" })}><TrendingDown className="size-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="size-8" title={isRTL ? "تسوية" : "Adjustment"} onClick={() => setMovementEditor({ item, mode: "adjustment_in" })}><ArrowUpFromLine className="size-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="size-8" title={isRTL ? "تحويل الوحدات" : "Unit conversion"} onClick={() => void promptConversion(item, isRTL, refresh)}><Scale className="size-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="size-8" onClick={() => setIngredientEditor(item)}><Pencil className="size-3.5" /></Button>
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
        </>
      )}

      {view === "movements" && (
        <MovementTable movements={movements} loading={movementQuery.isLoading} isRTL={isRTL} fmtNumber={fmtNumber} fmtCurrency={fmtCurrency} onReverse={async (entry) => {
          const reason = window.prompt(isRTL ? "سبب عكس الحركة" : "Reason for reversing this movement");
          if (!reason?.trim()) return;
          try {
            await apiFetch("/api/inventory/movements", {
              method: "POST",
              headers: { "Idempotency-Key": newKey("stock-reversal") },
              body: JSON.stringify({ action: "reverse", movementId: entry.id, reasonCode: "manager_correction", reason: reason.trim() }),
            });
            toast.success(isRTL ? "تم عكس الحركة" : "Movement reversed");
            await refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t.common.error);
          }
        }} />
      )}

      {view === "recipes" && (
        <RecipeCards recipes={recipes} loading={recipeQuery.isLoading} isRTL={isRTL} fmtNumber={fmtNumber} />
      )}

      {ingredientEditor && (
        <IngredientDialog item={ingredientEditor === "new" ? undefined : ingredientEditor} onClose={() => setIngredientEditor(null)} onSaved={async () => { setIngredientEditor(null); await refresh(); }} />
      )}
      {movementEditor && (
        <MovementDialog item={movementEditor.item} initialMode={movementEditor.mode} onClose={() => setMovementEditor(null)} onSaved={async () => { setMovementEditor(null); await refresh(); }} />
      )}
      {recipeOpen && (
        <RecipeDialog items={menuItems} ingredients={items} onClose={() => setRecipeOpen(false)} onSaved={async () => { setRecipeOpen(false); await refresh(); }} />
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <Card className="border-border/60"><CardContent className="p-4"><div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div><div className="text-2xl font-bold mt-1">{value}</div></CardContent></Card>;
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{icon}{label}</button>;
}

async function promptConversion(item: Ingredient, isRTL: boolean, refresh: () => Promise<void>) {
  const unit = window.prompt(isRTL ? "اسم الوحدة البديلة، مثل g أو box" : "Alternate unit, such as g or box");
  if (!unit?.trim()) return;
  const factor = window.prompt(isRTL ? `كم ${item.unit} في وحدة ${unit}` : `How many ${item.unit} are in one ${unit}`);
  if (!factor || Number(factor) <= 0) return;
  try {
    await apiFetch("/api/inventory/conversions", { method: "POST", body: JSON.stringify({ ingredientId: item.id, unit: unit.trim(), toBaseQuantity: Number(factor) }) });
    toast.success(isRTL ? "تم حفظ التحويل" : "Conversion saved");
    await refresh();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to save conversion");
  }
}

function IngredientDialog({ item, onClose, onSaved }: { item?: Ingredient; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: item?.name || "",
    unit: item?.unit || "pcs",
    quantity: String(item?.quantity ?? 0),
    lowThreshold: String(item?.lowThreshold ?? 10),
    costPerUnit: String(item?.costPerUnit ?? 0),
    supplier: item?.supplier || "",
    category: item?.category || "",
    allowNegativeStock: item?.allowNegativeStock || false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return toast.error(isRTL ? "الاسم مطلوب" : "Name is required");
    setSaving(true);
    try {
      await apiFetch("/api/inventory", {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(item ? {
          id: item.id,
          name: form.name,
          unit: form.unit,
          lowThreshold: Number(form.lowThreshold),
          costPerUnit: Number(form.costPerUnit),
          supplier: form.supplier || null,
          category: form.category || null,
          allowNegativeStock: form.allowNegativeStock,
        } : {
          name: form.name,
          unit: form.unit,
          quantity: Number(form.quantity),
          lowThreshold: Number(form.lowThreshold),
          costPerUnit: Number(form.costPerUnit),
          supplier: form.supplier || null,
          category: form.category || null,
          allowNegativeStock: form.allowNegativeStock,
        }),
      });
      toast.success(isRTL ? "تم الحفظ" : "Saved");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{item ? t.admin.editItem : t.admin.addIngredient}</DialogTitle><DialogDescription>{item ? (isRTL ? "الرصيد يدار من سجل الحركات." : "The balance is controlled by the stock ledger.") : (isRTL ? "الكمية ستسجل كرصيد افتتاحي." : "The quantity becomes an Opening balance movement.")}</DialogDescription></DialogHeader><div className="space-y-3"><Field label={isRTL ? "الاسم" : "Name"}><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label={t.admin.unit}><Input disabled={Boolean(item)} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field><Field label={isRTL ? "الفئة" : "Category"}><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field></div>{!item && <Field label={isRTL ? "الرصيد الافتتاحي" : "Opening balance"}><Input type="number" min="0" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>}<div className="grid grid-cols-2 gap-3"><Field label={t.admin.lowThreshold}><Input type="number" min="0" step="0.000001" value={form.lowThreshold} onChange={(event) => setForm({ ...form, lowThreshold: event.target.value })} /></Field><Field label={t.admin.costPerUnit}><Input type="number" min="0" step="0.000001" value={form.costPerUnit} onChange={(event) => setForm({ ...form, costPerUnit: event.target.value })} /></Field></div><Field label={t.admin.supplier}><Input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></Field><label className="flex gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={form.allowNegativeStock} onChange={(event) => setForm({ ...form, allowNegativeStock: event.target.checked })} /><span><strong className="block">{isRTL ? "السماح بالمخزون السالب" : "Allow negative stock"}</strong><small className="text-muted-foreground">{isRTL ? "استخدمه فقط عندما لا يجب أن يتوقف الإنتاج." : "Use only when production must not be blocked."}</small></span></label></div><DialogFooter><Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button><Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{t.admin.save}</Button></DialogFooter></DialogContent></Dialog>;
}

function MovementDialog({ item, initialMode, onClose, onSaved }: { item: Ingredient; initialMode: MovementMode; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const { t, isRTL } = useI18n();
  const [mode, setMode] = useState<MovementMode>(initialMode);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(item.unit);
  const [cost, setCost] = useState(String(item.costPerUnit));
  const [reasonCode, setReasonCode] = useState(initialMode === "waste" ? "expired" : "manual_count");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (Number(quantity) <= 0 || !reason.trim()) return toast.error(isRTL ? "أدخل كمية وسبباً صحيحين" : "Enter a valid quantity and explanation");
    const body = mode === "receipt" ? { action: "receipt", ingredientId: item.id, quantity: Number(quantity), unit, unitCost: Number(cost), reasonCode, reason } : mode === "waste" ? { action: "waste", ingredientId: item.id, quantity: Number(quantity), unit, reasonCode, reason } : { action: "adjustment", direction: mode === "adjustment_in" ? "in" : "out", ingredientId: item.id, quantity: Number(quantity), unit, reasonCode, reason };
    setSaving(true);
    try {
      await apiFetch("/api/inventory/movements", { method: "POST", headers: { "Idempotency-Key": newKey(`stock-${mode}`) }, body: JSON.stringify(body) });
      toast.success(isRTL ? "تم تسجيل الحركة" : "Stock movement recorded");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{item.name}</DialogTitle><DialogDescription>{isRTL ? "الرصيد الحالي" : "Current balance"}: {item.quantity} {item.unit}</DialogDescription></DialogHeader><div className="space-y-3"><Field label={isRTL ? "نوع الحركة" : "Movement type"}><Select value={mode} onValueChange={(value) => setMode(value as MovementMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="receipt">{isRTL ? "استلام" : "Receipt"}</SelectItem><SelectItem value="waste">{isRTL ? "هدر" : "Waste"}</SelectItem><SelectItem value="adjustment_in">{isRTL ? "تسوية زيادة" : "Adjustment in"}</SelectItem><SelectItem value="adjustment_out">{isRTL ? "تسوية نقص" : "Adjustment out"}</SelectItem></SelectContent></Select></Field><div className="grid grid-cols-2 gap-3"><Field label={t.admin.quantity}><Input type="number" min="0.000001" step="0.000001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label={t.admin.unit}><Input value={unit} onChange={(event) => setUnit(event.target.value)} /></Field></div>{mode === "receipt" && <Field label={t.admin.costPerUnit}><Input type="number" min="0" step="0.000001" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>}<Field label={isRTL ? "رمز السبب" : "Reason code"}>{mode === "waste" ? <Select value={reasonCode} onValueChange={setReasonCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["expired", "spoiled", "burnt", "dropped", "overportion", "other"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select> : <Input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} />}</Field><Field label={isRTL ? "التفسير" : "Explanation"}><Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field></div><DialogFooter><Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button><Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{isRTL ? "تسجيل" : "Record"}</Button></DialogFooter></DialogContent></Dialog>;
}

interface DraftComponent { key: string; ingredientId: string; quantity: string; unit: string; modifierOptionId: string }

function RecipeDialog({ items, ingredients, onClose, onSaved }: { items: MenuItemOption[]; ingredients: Ingredient[]; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const { t, isRTL } = useI18n();
  const [menuItemId, setMenuItemId] = useState(items[0]?.id || "");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [components, setComponents] = useState<DraftComponent[]>([{ key: newKey("component"), ingredientId: ingredients[0]?.id || "", quantity: "1", unit: ingredients[0]?.unit || "pcs", modifierOptionId: "base" }]);
  const [saving, setSaving] = useState(false);
  const selectedItem = items.find((item) => item.id === menuItemId);
  const modifiers = selectedItem?.modifierGroups?.flatMap((group) => group.options.map((option) => ({ ...option, group: isRTL ? group.nameAr : group.nameEn }))) || [];
  const update = (key: string, change: Partial<DraftComponent>) => setComponents((current) => current.map((entry) => entry.key === key ? { ...entry, ...change } : entry));

  const save = async () => {
    if (!menuItemId || components.some((entry) => !entry.ingredientId || Number(entry.quantity) <= 0)) return toast.error(isRTL ? "الوصفة غير مكتملة" : "Recipe is incomplete");
    setSaving(true);
    try {
      await apiFetch("/api/inventory/recipes", { method: "POST", headers: { "Idempotency-Key": newKey("recipe-version") }, body: JSON.stringify({ menuItemId, yieldQuantity: Number(yieldQuantity), components: components.map((entry) => ({ ingredientId: entry.ingredientId, quantity: Number(entry.quantity), unit: entry.unit, modifierOptionId: entry.modifierOptionId === "base" ? null : entry.modifierOptionId })) }) });
      toast.success(isRTL ? "تم نشر الوصفة" : "Recipe published");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>{isRTL ? "نشر إصدار وصفة" : "Publish recipe version"}</DialogTitle><DialogDescription>{isRTL ? "الإصدار السابق يبقى محفوظاً وغير قابل للتعديل." : "The previous version remains preserved and immutable."}</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid sm:grid-cols-[1fr_140px] gap-3"><Field label={isRTL ? "صنف القائمة" : "Menu item"}><Select value={menuItemId} onValueChange={setMenuItemId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{isRTL ? item.nameAr : item.nameEn}</SelectItem>)}</SelectContent></Select></Field><Field label={isRTL ? "الناتج" : "Yield"}><Input type="number" min="0.000001" value={yieldQuantity} onChange={(event) => setYieldQuantity(event.target.value)} /></Field></div><div className="space-y-2"><div className="flex justify-between"><Label>{isRTL ? "المكوّنات" : "Components"}</Label><Button type="button" size="sm" variant="outline" onClick={() => setComponents((current) => [...current, { key: newKey("component"), ingredientId: ingredients[0]?.id || "", quantity: "1", unit: ingredients[0]?.unit || "pcs", modifierOptionId: "base" }])}><Plus className="size-3.5" />{isRTL ? "إضافة" : "Add"}</Button></div>{components.map((entry, index) => <div key={entry.key} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_100px_90px_1fr_auto]"><Select value={entry.ingredientId} onValueChange={(value) => { const ingredient = ingredients.find((candidate) => candidate.id === value); update(entry.key, { ingredientId: value, unit: ingredient?.unit || "pcs" }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ingredients.map((ingredient) => <SelectItem key={ingredient.id} value={ingredient.id}>{ingredient.name}</SelectItem>)}</SelectContent></Select><Input aria-label={`quantity-${index}`} type="number" min="0.000001" step="0.000001" value={entry.quantity} onChange={(event) => update(entry.key, { quantity: event.target.value })} /><Input aria-label={`unit-${index}`} value={entry.unit} onChange={(event) => update(entry.key, { unit: event.target.value })} /><Select value={entry.modifierOptionId} onValueChange={(value) => update(entry.key, { modifierOptionId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="base">{isRTL ? "أساسي دائماً" : "Always included"}</SelectItem>{modifiers.map((option) => <SelectItem key={option.id} value={option.id}>{isRTL ? option.nameAr : option.nameEn} · {option.group}</SelectItem>)}</SelectContent></Select><Button type="button" size="icon" variant="ghost" disabled={components.length === 1} onClick={() => setComponents((current) => current.filter((candidate) => candidate.key !== entry.key))}><Trash2 className="size-4 text-destructive" /></Button></div>)}</div></div><DialogFooter><Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button><Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{isRTL ? "نشر" : "Publish"}</Button></DialogFooter></DialogContent></Dialog>;
}

function MovementTable({ movements, loading, isRTL, fmtNumber, fmtCurrency, onReverse }: { movements: StockMovement[]; loading: boolean; isRTL: boolean; fmtNumber: (value: number) => string; fmtCurrency: (value: number) => string; onReverse: (entry: StockMovement) => void | Promise<void> }) {
  if (loading) return <AdminLoading />;
  return <Card className="border-border/60"><CardContent className="p-0">{movements.length === 0 ? <EmptyState icon={<History className="size-6" />} title={isRTL ? "لا توجد حركات" : "No stock movements"} /> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="ps-4">{isRTL ? "المكوّن" : "Ingredient"}</TableHead><TableHead>{isRTL ? "الحركة" : "Movement"}</TableHead><TableHead>{isRTL ? "التغيير" : "Change"}</TableHead><TableHead>{isRTL ? "الرصيد" : "Balance"}</TableHead><TableHead className="hidden md:table-cell">{isRTL ? "الأثر المالي" : "Cost impact"}</TableHead><TableHead className="text-end pe-4" /></TableRow></TableHeader><TableBody>{movements.map((entry) => <TableRow key={entry.id}><TableCell className="ps-4 font-medium">{entry.ingredientName}</TableCell><TableCell><Badge variant="outline">{movementLabel(entry.movementType, isRTL)}</Badge></TableCell><TableCell className={`font-mono ${entry.quantityDelta < 0 ? "text-rose-600" : "text-emerald-700"}`}>{entry.quantityDelta > 0 ? "+" : ""}{fmtNumber(entry.quantityDelta)} {entry.baseUnit}</TableCell><TableCell className="font-mono">{fmtNumber(entry.balanceAfter)} {entry.baseUnit}</TableCell><TableCell className="hidden md:table-cell">{fmtCurrency(entry.totalCost)}</TableCell><TableCell className="text-end pe-4"><Button size="icon" variant="ghost" className="size-8" disabled={entry.movementType === "reversal"} onClick={() => void onReverse(entry)}><RotateCcw className="size-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>;
}

function RecipeCards({ recipes, loading, isRTL, fmtNumber }: { recipes: Recipe[]; loading: boolean; isRTL: boolean; fmtNumber: (value: number) => string }) {
  if (loading) return <AdminLoading />;
  if (recipes.length === 0) return <Card><EmptyState icon={<BookOpen className="size-6" />} title={isRTL ? "لا توجد وصفات" : "No active recipes"} description={isRTL ? "الأصناف بلا وصفة تبقى قابلة للبيع ولكن استهلاكها غير متتبع." : "Items without recipes remain sellable, but their ingredient use is untracked."} /></Card>;
  return <div className="grid gap-3 lg:grid-cols-2">{recipes.map((recipe) => <Card key={recipe.id}><CardHeader className="pb-3"><div className="flex justify-between gap-2"><div><CardTitle className="text-base">{isRTL ? recipe.menuItemNameAr : recipe.menuItemNameEn}</CardTitle><p className="text-xs text-muted-foreground mt-1">{isRTL ? "الإصدار" : "Version"} {recipe.version} · {isRTL ? "الناتج" : "Yield"} {recipe.yieldQuantity}</p></div><Badge>{isRTL ? "نشطة" : "Active"}</Badge></div></CardHeader><CardContent className="space-y-2">{recipe.components.map((component) => <div key={component.id} className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{component.ingredientName}{component.modifierOptionId ? ` · +${isRTL ? component.modifierNameAr : component.modifierNameEn}` : ""}</span><span className="font-mono">{fmtNumber(component.quantity)} {component.ingredientUnit}</span></div>)}<p className="text-[11px] text-muted-foreground">{isRTL ? "أنشأها" : "Created by"}: {recipe.createdByName || "—"}</p></CardContent></Card>)}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
