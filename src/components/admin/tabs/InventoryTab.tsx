"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Layers,
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

interface WasteEntry {
  id: string;
  ingredientName: string;
  quantity: number;
  reason: string;
  notes: string | null;
  reportedBy: string | null;
  createdAt: string;
}

interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  movementType: string;
  quantityDelta: number;
  unitCost: number;
  totalCost: number;
  balanceAfter: number;
  sourceType: string;
  sourceId: string | null;
  reversalOfId: string | null;
  reasonCode: string;
  reason: string | null;
  actorName: string;
  occurredAt: string;
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
  isActive: boolean;
  createdByName: string;
  createdAt: string;
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
    options: Array<{
      id: string;
      nameEn: string;
      nameAr: string;
    }>;
  }>;
}

type IngredientDialogState = { open: boolean; item?: Ingredient };
type MovementMode = "receipt" | "waste" | "adjustment_in" | "adjustment_out";
type MovementDialogState = {
  open: boolean;
  item?: Ingredient;
  mode: MovementMode;
};

function createIdempotencyKey(prefix: string): string {
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
  const label = labels[type];
  return label ? label[isRTL ? "ar" : "en"] : type;
}

export function InventoryTab() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [ingredientDialog, setIngredientDialog] =
    useState<IngredientDialogState>({ open: false });
  const [movementDialog, setMovementDialog] = useState<MovementDialogState>({
    open: false,
    mode: "receipt",
  });
  const [conversionIngredient, setConversionIngredient] =
    useState<Ingredient | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "admin"],
    queryFn: async () => apiFetch("/api/inventory"),
  });
  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: async () => apiFetch("/api/inventory/movements?limit=150"),
  });
  const recipesQuery = useQuery({
    queryKey: ["inventory", "recipes"],
    queryFn: async () => apiFetch("/api/inventory/recipes"),
  });
  const menuQuery = useQuery({
    queryKey: ["menu", "all", "inventory-recipes"],
    queryFn: async () => apiFetch("/api/menu?all=true"),
  });

  const items: Ingredient[] = inventoryQuery.data?.items || [];
  const waste: WasteEntry[] = inventoryQuery.data?.waste || [];
  const movements: StockMovement[] = movementsQuery.data?.movements || [];
  const recipes: Recipe[] = recipesQuery.data?.recipes || [];
  const menuItems: MenuItemOption[] = useMemo(
    () =>
      (menuQuery.data?.categories || []).flatMap(
        (category: { items?: MenuItemOption[] }) => category.items || []
      ),
    [menuQuery.data]
  );

  const filtered = items.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [item.name, item.category || "", item.supplier || ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const lowStockItems = items.filter(
    (item) => item.quantity <= item.lowThreshold
  );
  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.costPerUnit,
    0
  );
  const untrackedMenuItems = Math.max(0, menuItems.length - recipes.length);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["menu"] }),
    ]);
  };

  if (inventoryQuery.isLoading) {
    return <AdminLoading label={t.common.loading} />;
  }

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryCard
          label={isRTL ? "المكوّنات" : "Ingredients"}
          value={String(items.length)}
          icon={<Package className="size-4 text-primary" />}
        />
        <SummaryCard
          label={t.admin.lowStock}
          value={String(lowStockItems.length)}
          icon={<AlertTriangle className="size-4 text-rose-600" />}
          valueClass="text-rose-600"
        />
        <SummaryCard
          label={isRTL ? "قيمة المخزون" : "Inventory value"}
          value={fmtCurrency(totalValue)}
          icon={<DollarSign className="size-4 text-emerald-600" />}
          valueClass="text-emerald-700"
        />
        <SummaryCard
          label={isRTL ? "الوصفات النشطة" : "Active recipes"}
          value={String(recipes.length)}
          icon={<BookOpen className="size-4 text-violet-600" />}
        />
        <SummaryCard
          label={isRTL ? "أصناف بلا وصفة" : "Items without recipe"}
          value={String(untrackedMenuItems)}
          icon={<Scale className="size-4 text-amber-600" />}
          valueClass={untrackedMenuItems > 0 ? "text-amber-700" : undefined}
        />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="inventory" className="gap-1.5">
            <Boxes className="size-3.5" />
            {t.admin.inventory}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1.5">
            <History className="size-3.5" />
            {isRTL ? "حركات المخزون" : "Stock ledger"}
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-1.5">
            <BookOpen className="size-3.5" />
            {isRTL ? "الوصفات" : "Recipes"}
          </TabsTrigger>
          <TabsTrigger value="waste" className="gap-1.5">
            <TrendingDown className="size-3.5" />
            {isRTL ? "الهدر" : "Waste"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isRTL ? "ابحث عن مكوّن..." : "Search ingredients..."
                }
                className="ps-9"
              />
            </div>
            <Button
              onClick={() => setIngredientDialog({ open: true })}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="size-4" />
              {t.admin.addIngredient}
            </Button>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Boxes className="size-6" />}
                  title={isRTL ? "لا توجد مكوّنات" : "No ingredients"}
                  description={
                    isRTL
                      ? "أنشئ مكوّناً ثم سجّل الاستلام أو الرصيد الافتتاحي."
                      : "Create an ingredient, then record its opening balance or receipts."
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">
                          {isRTL ? "المكوّن" : "Ingredient"}
                        </TableHead>
                        <TableHead>{t.admin.quantity}</TableHead>
                        <TableHead className="hidden md:table-cell">
                          {t.admin.costPerUnit}
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          {isRTL ? "الفئة / المورد" : "Category / supplier"}
                        </TableHead>
                        <TableHead>{t.admin.status}</TableHead>
                        <TableHead className="text-end pe-4">
                          {isRTL ? "الحركات" : "Actions"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => {
                        const isLow = item.quantity <= item.lowThreshold;
                        return (
                          <TableRow
                            key={item.id}
                            className={
                              isLow ? "bg-rose-50/40" : "hover:bg-muted/30"
                            }
                          >
                            <TableCell className="ps-4">
                              <div className="font-medium text-sm">
                                {item.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isRTL ? "الوحدة الأساسية" : "Base unit"}: {item.unit}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-semibold tabular-nums">
                                {fmtNumber(item.quantity)}{" "}
                                <span className="text-xs text-muted-foreground">
                                  {item.unit}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {isRTL ? "حد التنبيه" : "Low threshold"}: {item.lowThreshold}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {fmtCurrency(item.costPerUnit || 0)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              <div>{item.category || "—"}</div>
                              <div>{item.supplier || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-1">
                                {isLow ? (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <AlertTriangle className="size-3 me-1" />
                                    {isRTL ? "مخزون منخفض" : "LOW"}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                                    {isRTL ? "متاح" : "Available"}
                                  </Badge>
                                )}
                                {item.allowNegativeStock && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {isRTL ? "يسمح بالسالب" : "Negative allowed"}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-end pe-4">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-emerald-700"
                                  onClick={() =>
                                    setMovementDialog({
                                      open: true,
                                      item,
                                      mode: "receipt",
                                    })
                                  }
                                >
                                  <ArrowDownToLine className="size-3.5" />
                                  <span className="hidden xl:inline">
                                    {isRTL ? "استلام" : "Receive"}
                                  </span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-violet-700"
                                  onClick={() =>
                                    setMovementDialog({
                                      open: true,
                                      item,
                                      mode: "waste",
                                    })
                                  }
                                >
                                  <TrendingDown className="size-3.5" />
                                  <span className="hidden xl:inline">
                                    {isRTL ? "هدر" : "Waste"}
                                  </span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  title={isRTL ? "تحويل الوحدات" : "Unit conversions"}
                                  onClick={() => setConversionIngredient(item)}
                                >
                                  <Scale className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  onClick={() =>
                                    setIngredientDialog({ open: true, item })
                                  }
                                >
                                  <Pencil className="size-3.5" />
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

        <TabsContent value="movements" className="mt-4">
          <MovementLedger
            movements={movements}
            isLoading={movementsQuery.isLoading}
            isRTL={isRTL}
            fmtNumber={fmtNumber}
            fmtCurrency={fmtCurrency}
            onReverse={async (movement) => {
              const reason = window.prompt(
                isRTL
                  ? "اكتب سبب عكس هذه الحركة"
                  : "Enter the reason for reversing this movement"
              );
              if (!reason?.trim()) return;
              try {
                await apiFetch("/api/inventory/movements", {
                  method: "POST",
                  headers: {
                    "Idempotency-Key": createIdempotencyKey("stock-reversal"),
                  },
                  body: JSON.stringify({
                    action: "reverse",
                    movementId: movement.id,
                    reasonCode: "manager_correction",
                    reason: reason.trim(),
                  }),
                });
                toast.success(isRTL ? "تم عكس الحركة" : "Movement reversed");
                await refreshAll();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t.common.error);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="recipes" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setRecipeOpen(true)}
            >
              <Plus className="size-4" />
              {isRTL ? "نشر وصفة" : "Publish recipe"}
            </Button>
          </div>
          {recipesQuery.isLoading ? (
            <AdminLoading label={t.common.loading} />
          ) : recipes.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BookOpen className="size-6" />}
                title={isRTL ? "لا توجد وصفات" : "No active recipes"}
                description={
                  isRTL
                    ? "الأصناف بلا وصفة تبقى قابلة للبيع، لكن استهلاكها غير متتبع."
                    : "Items without recipes remain sellable, but their ingredient use is untracked."
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {recipes.map((recipe) => (
                <Card key={recipe.id} className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {isRTL
                            ? recipe.menuItemNameAr
                            : recipe.menuItemNameEn}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRTL ? "الإصدار" : "Version"} {recipe.version} ·{" "}
                          {isRTL ? "الناتج" : "Yield"} {recipe.yieldQuantity}
                        </p>
                      </div>
                      <Badge>{isRTL ? "نشطة" : "Active"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recipe.components.map((component) => (
                      <div
                        key={component.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {component.ingredientName}
                          </div>
                          {component.modifierOptionId && (
                            <div className="text-[11px] text-muted-foreground">
                              +{" "}
                              {isRTL
                                ? component.modifierNameAr
                                : component.modifierNameEn}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-xs shrink-0">
                          {fmtNumber(component.quantity)} {component.ingredientUnit}
                        </span>
                      </div>
                    ))}
                    <div className="pt-1 text-[11px] text-muted-foreground">
                      {isRTL ? "أنشأها" : "Created by"}: {recipe.createdByName || "—"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="waste" className="mt-4">
          <WasteTable waste={waste} isRTL={isRTL} />
        </TabsContent>
      </Tabs>

      {ingredientDialog.open && (
        <IngredientDialog
          item={ingredientDialog.item}
          onClose={() => setIngredientDialog({ open: false })}
          onSaved={async () => {
            setIngredientDialog({ open: false });
            await refreshAll();
          }}
        />
      )}

      {movementDialog.open && movementDialog.item && (
        <StockMovementDialog
          item={movementDialog.item}
          initialMode={movementDialog.mode}
          onClose={() =>
            setMovementDialog({ open: false, mode: "receipt" })
          }
          onSaved={async () => {
            setMovementDialog({ open: false, mode: "receipt" });
            await refreshAll();
          }}
        />
      )}

      {conversionIngredient && (
        <UnitConversionDialog
          item={conversionIngredient}
          onClose={() => setConversionIngredient(null)}
          onSaved={async () => {
            setConversionIngredient(null);
            await refreshAll();
          }}
        />
      )}

      {recipeOpen && (
        <RecipeDialog
          ingredients={items}
          menuItems={menuItems}
          onClose={() => setRecipeOpen(false)}
          onSaved={async () => {
            setRecipeOpen(false);
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-bold mt-1 ${valueClass || ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function IngredientDialog({
  item,
  onClose,
  onSaved,
}: {
  item?: Ingredient;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: item?.name || "",
    unit: item?.unit || "pcs",
    quantity: item?.quantity ?? 0,
    lowThreshold: item?.lowThreshold ?? 10,
    costPerUnit: item?.costPerUnit ?? 0,
    supplier: item?.supplier || "",
    category: item?.category || "",
    allowNegativeStock: item?.allowNegativeStock || false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(isRTL ? "الاسم مطلوب" : "Name is required");
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await apiFetch("/api/inventory", {
          method: "PATCH",
          body: JSON.stringify({
            id: item.id,
            name: form.name,
            unit: form.unit,
            lowThreshold: Number(form.lowThreshold),
            costPerUnit: Number(form.costPerUnit),
            supplier: form.supplier || null,
            category: form.category || null,
            allowNegativeStock: form.allowNegativeStock,
          }),
        });
        toast.success(isRTL ? "تم حفظ المكوّن" : "Ingredient saved");
      } else {
        await apiFetch("/api/inventory", {
          method: "POST",
          body: JSON.stringify({
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
        toast.success(isRTL ? "تم إنشاء المكوّن" : "Ingredient created");
      }
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            {item ? t.admin.editItem : t.admin.addIngredient}
          </DialogTitle>
          <DialogDescription>
            {item
              ? isRTL
                ? "الرصيد يدار من سجل الحركات ولا يمكن تغييره من هنا."
                : "The balance is ledger-controlled and cannot be edited here."
              : isRTL
                ? "الكمية المدخلة ستسجل كحركة رصيد افتتاحي."
                : "The entered quantity becomes an opening-balance movement."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{isRTL ? "الاسم" : "Name"}</Label>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.unit}</Label>
              <Input
                value={form.unit}
                disabled={Boolean(item)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "الفئة" : "Category"}</Label>
              <Input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className={`grid ${item ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
            {!item && (
              <div className="space-y-1.5">
                <Label>{isRTL ? "الرصيد الافتتاحي" : "Opening balance"}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t.admin.lowThreshold}</Label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                value={form.lowThreshold}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lowThreshold: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.costPerUnit}</Label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                value={form.costPerUnit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    costPerUnit: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.supplier}</Label>
            <Input
              value={form.supplier}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  supplier: event.target.value,
                }))
              }
            />
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={form.allowNegativeStock}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  allowNegativeStock: event.target.checked,
                }))
              }
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium block">
                {isRTL ? "السماح بالمخزون السالب" : "Allow negative stock"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isRTL
                  ? "استخدمه فقط للمكوّنات التي لا يجب أن توقف الإنتاج."
                  : "Use only for ingredients that must not block production."}
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockMovementDialog({
  item,
  initialMode,
  onClose,
  onSaved,
}: {
  item: Ingredient;
  initialMode: MovementMode;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const [mode, setMode] = useState<MovementMode>(initialMode);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(item.unit);
  const [unitCost, setUnitCost] = useState(String(item.costPerUnit || 0));
  const [reasonCode, setReasonCode] = useState(
    initialMode === "waste" ? "expired" : "manual_count"
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (Number(quantity) <= 0 || !reason.trim()) {
      toast.error(
        isRTL
          ? "أدخل كمية صحيحة وسبباً واضحاً"
          : "Enter a valid quantity and explanation"
      );
      return;
    }
    setSaving(true);
    try {
      const body =
        mode === "receipt"
          ? {
              action: "receipt",
              ingredientId: item.id,
              quantity: Number(quantity),
              unit,
              unitCost: Number(unitCost),
              reasonCode,
              reason: reason.trim(),
            }
          : mode === "waste"
            ? {
                action: "waste",
                ingredientId: item.id,
                quantity: Number(quantity),
                unit,
                reasonCode,
                reason: reason.trim(),
              }
            : {
                action: "adjustment",
                direction: mode === "adjustment_in" ? "in" : "out",
                ingredientId: item.id,
                quantity: Number(quantity),
                unit,
                reasonCode,
                reason: reason.trim(),
              };

      await apiFetch("/api/inventory/movements", {
        method: "POST",
        headers: {
          "Idempotency-Key": createIdempotencyKey(`stock-${mode}`),
        },
        body: JSON.stringify(body),
      });
      toast.success(isRTL ? "تم تسجيل الحركة" : "Stock movement recorded");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            {item.name}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? "الرصيد الحالي" : "Current balance"}: {item.quantity}{" "}
            {item.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{isRTL ? "نوع الحركة" : "Movement type"}</Label>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value as MovementMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">
                  {isRTL ? "استلام" : "Receipt"}
                </SelectItem>
                <SelectItem value="waste">
                  {isRTL ? "هدر" : "Waste"}
                </SelectItem>
                <SelectItem value="adjustment_in">
                  {isRTL ? "تسوية زيادة" : "Adjustment in"}
                </SelectItem>
                <SelectItem value="adjustment_out">
                  {isRTL ? "تسوية نقص" : "Adjustment out"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.quantity}</Label>
              <Input
                type="number"
                min="0.000001"
                step="0.000001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.unit}</Label>
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} />
            </div>
          </div>
          {mode === "receipt" && (
            <div className="space-y-1.5">
              <Label>{isRTL ? "تكلفة الوحدة المستلمة" : "Received unit cost"}</Label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{isRTL ? "رمز السبب" : "Reason code"}</Label>
            {mode === "waste" ? (
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expired">
                    {isRTL ? "منتهي الصلاحية" : "Expired"}
                  </SelectItem>
                  <SelectItem value="spoiled">
                    {isRTL ? "تالف" : "Spoiled"}
                  </SelectItem>
                  <SelectItem value="burnt">
                    {isRTL ? "محروق" : "Burnt"}
                  </SelectItem>
                  <SelectItem value="dropped">
                    {isRTL ? "مسكوب" : "Dropped"}
                  </SelectItem>
                  <SelectItem value="overportion">
                    {isRTL ? "زيادة حصة" : "Over-portion"}
                  </SelectItem>
                  <SelectItem value="other">
                    {isRTL ? "أخرى" : "Other"}
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{isRTL ? "التفسير" : "Explanation"}</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isRTL ? "تسجيل" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnitConversionDialog({
  item,
  onClose,
  onSaved,
}: {
  item: Ingredient;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const [unit, setUnit] = useState("");
  const [toBaseQuantity, setToBaseQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const conversionsQuery = useQuery({
    queryKey: ["inventory", "conversions", item.id],
    queryFn: async () =>
      apiFetch(
        `/api/inventory/conversions?ingredientId=${encodeURIComponent(item.id)}`
      ),
  });
  const conversions: Array<{
    id: string;
    unit: string;
    toBaseQuantity: number;
  }> = conversionsQuery.data?.conversions || [];

  const save = async () => {
    if (!unit.trim() || Number(toBaseQuantity) <= 0) {
      toast.error(isRTL ? "أدخل تحويلاً صحيحاً" : "Enter a valid conversion");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/inventory/conversions", {
        method: "POST",
        body: JSON.stringify({
          ingredientId: item.id,
          unit: unit.trim(),
          toBaseQuantity: Number(toBaseQuantity),
        }),
      });
      toast.success(isRTL ? "تم حفظ التحويل" : "Conversion saved");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            {isRTL ? "تحويل الوحدات" : "Unit conversions"}
          </DialogTitle>
          <DialogDescription>
            {item.name} · {isRTL ? "الوحدة الأساسية" : "base unit"}: {item.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {conversions.length > 0 && (
            <div className="space-y-1.5">
              {conversions.map((conversion) => (
                <div
                  key={conversion.id}
                  className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>1 {conversion.unit}</span>
                  <span className="font-mono">
                    {conversion.toBaseQuantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "الوحدة البديلة" : "Alternate unit"}</Label>
              <Input value={unit} onChange={(event) => setUnit(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>
                {isRTL ? `كم ${item.unit} في وحدة واحدة` : `${item.unit} per unit`}
              </Label>
              <Input
                type="number"
                min="0.000001"
                step="0.000001"
                value={toBaseQuantity}
                onChange={(event) => setToBaseQuantity(event.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditableRecipeComponent {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  modifierOptionId: string;
}

function RecipeDialog({
  ingredients,
  menuItems,
  onClose,
  onSaved,
}: {
  ingredients: Ingredient[];
  menuItems: MenuItemOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id || "");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [components, setComponents] = useState<EditableRecipeComponent[]>([
    {
      key: createIdempotencyKey("component"),
      ingredientId: ingredients[0]?.id || "",
      quantity: "1",
      unit: ingredients[0]?.unit || "pcs",
      modifierOptionId: "base",
    },
  ]);
  const [saving, setSaving] = useState(false);

  const selectedMenuItem = menuItems.find((item) => item.id === menuItemId);
  const modifierOptions =
    selectedMenuItem?.modifierGroups?.flatMap((group) =>
      group.options.map((option) => ({
        ...option,
        groupNameEn: group.nameEn,
        groupNameAr: group.nameAr,
      }))
    ) || [];

  const updateComponent = (
    key: string,
    change: Partial<EditableRecipeComponent>
  ) => {
    setComponents((current) =>
      current.map((component) =>
        component.key === key ? { ...component, ...change } : component
      )
    );
  };

  const save = async () => {
    if (!menuItemId || Number(yieldQuantity) <= 0 || components.length === 0) {
      toast.error(isRTL ? "الوصفة غير مكتملة" : "Recipe is incomplete");
      return;
    }
    if (
      components.some(
        (component) =>
          !component.ingredientId || Number(component.quantity) <= 0 || !component.unit
      )
    ) {
      toast.error(isRTL ? "تحقق من مكوّنات الوصفة" : "Check recipe components");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/inventory/recipes", {
        method: "POST",
        headers: {
          "Idempotency-Key": createIdempotencyKey("recipe-version"),
        },
        body: JSON.stringify({
          menuItemId,
          yieldQuantity: Number(yieldQuantity),
          components: components.map((component) => ({
            ingredientId: component.ingredientId,
            quantity: Number(component.quantity),
            unit: component.unit,
            modifierOptionId:
              component.modifierOptionId === "base"
                ? null
                : component.modifierOptionId,
          })),
        }),
      });
      toast.success(isRTL ? "تم نشر الوصفة" : "Recipe published");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            {isRTL ? "نشر إصدار وصفة" : "Publish recipe version"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "الإصدار السابق سيبقى محفوظاً وغير قابل للتعديل."
              : "The previous version remains preserved and immutable."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_160px] gap-3">
            <div className="space-y-1.5">
              <Label>{isRTL ? "صنف القائمة" : "Menu item"}</Label>
              <Select value={menuItemId} onValueChange={setMenuItemId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {isRTL ? item.nameAr : item.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isRTL ? "ناتج الوصفة" : "Recipe yield"}</Label>
              <Input
                type="number"
                min="0.000001"
                step="0.000001"
                value={yieldQuantity}
                onChange={(event) => setYieldQuantity(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{isRTL ? "المكوّنات" : "Components"}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setComponents((current) => [
                    ...current,
                    {
                      key: createIdempotencyKey("component"),
                      ingredientId: ingredients[0]?.id || "",
                      quantity: "1",
                      unit: ingredients[0]?.unit || "pcs",
                      modifierOptionId: "base",
                    },
                  ])
                }
              >
                <Plus className="size-3.5" />
                {isRTL ? "إضافة" : "Add"}
              </Button>
            </div>
            {components.map((component, index) => {
              const selectedIngredient = ingredients.find(
                (ingredient) => ingredient.id === component.ingredientId
              );
              return (
                <div
                  key={component.key}
                  className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_110px_100px_1fr_auto]"
                >
                  <Select
                    value={component.ingredientId}
                    onValueChange={(value) => {
                      const ingredient = ingredients.find(
                        (entry) => entry.id === value
                      );
                      updateComponent(component.key, {
                        ingredientId: value,
                        unit: ingredient?.unit || "pcs",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? "مكوّن" : "Ingredient"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((ingredient) => (
                        <SelectItem key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={component.quantity}
                    onChange={(event) =>
                      updateComponent(component.key, {
                        quantity: event.target.value,
                      })
                    }
                    aria-label={`${isRTL ? "كمية" : "Quantity"} ${index + 1}`}
                  />
                  <Input
                    value={component.unit}
                    onChange={(event) =>
                      updateComponent(component.key, {
                        unit: event.target.value,
                      })
                    }
                    aria-label={`${isRTL ? "وحدة" : "Unit"} ${index + 1}`}
                    placeholder={selectedIngredient?.unit || "unit"}
                  />
                  <Select
                    value={component.modifierOptionId}
                    onValueChange={(value) =>
                      updateComponent(component.key, {
                        modifierOptionId: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">
                        {isRTL ? "أساسي دائماً" : "Always included"}
                      </SelectItem>
                      {modifierOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {isRTL ? option.nameAr : option.nameEn} ·{" "}
                          {isRTL ? option.groupNameAr : option.groupNameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={components.length === 1}
                    onClick={() =>
                      setComponents((current) =>
                        current.filter((entry) => entry.key !== component.key)
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isRTL ? "نشر" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementLedger({
  movements,
  isLoading,
  isRTL,
  fmtNumber,
  fmtCurrency,
  onReverse,
}: {
  movements: StockMovement[];
  isLoading: boolean;
  isRTL: boolean;
  fmtNumber: (value: number) => string;
  fmtCurrency: (value: number) => string;
  onReverse: (movement: StockMovement) => void | Promise<void>;
}) {
  if (isLoading) return <AdminLoading />;
  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {movements.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" />}
            title={isRTL ? "لا توجد حركات" : "No stock movements"}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {isRTL ? "المكوّن" : "Ingredient"}
                  </TableHead>
                  <TableHead>{isRTL ? "الحركة" : "Movement"}</TableHead>
                  <TableHead>{isRTL ? "التغيير" : "Change"}</TableHead>
                  <TableHead>{isRTL ? "الرصيد" : "Balance"}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {isRTL ? "الأثر المالي" : "Cost impact"}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {isRTL ? "المرجع / السبب" : "Source / reason"}
                  </TableHead>
                  <TableHead className="text-end pe-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="ps-4 font-medium text-sm">
                      {movement.ingredientName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {movementLabel(movement.movementType, isRTL)}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`font-mono text-sm ${
                        movement.quantityDelta < 0
                          ? "text-rose-600"
                          : "text-emerald-700"
                      }`}
                    >
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {fmtNumber(movement.quantityDelta)} {movement.baseUnit}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {fmtNumber(movement.balanceAfter)} {movement.baseUnit}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {fmtCurrency(movement.totalCost)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[280px]">
                      <div className="truncate">
                        {movement.sourceType || "—"}
                        {movement.sourceId ? ` · ${movement.sourceId}` : ""}
                      </div>
                      <div className="truncate">
                        {movement.reason || movement.reasonCode || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-end pe-4">
                      {movement.movementType !== "reversal" &&
                        !movement.reversalOfId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title={isRTL ? "عكس الحركة" : "Reverse movement"}
                            onClick={() => void onReverse(movement)}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WasteTable({
  waste,
  isRTL,
}: {
  waste: WasteEntry[];
  isRTL: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="size-4 text-violet-600" />
          {isRTL ? "سجل الهدر" : "Waste log"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {waste.length === 0 ? (
          <EmptyState
            icon={<TrendingDown className="size-6" />}
            title={isRTL ? "لا يوجد هدر مسجل" : "No waste logged"}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">
                    {isRTL ? "المكوّن" : "Ingredient"}
                  </TableHead>
                  <TableHead>{isRTL ? "الكمية الأساسية" : "Base quantity"}</TableHead>
                  <TableHead>{isRTL ? "السبب" : "Reason"}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {isRTL ? "التفسير" : "Explanation"}
                  </TableHead>
                  <TableHead className="text-end pe-4">
                    {isRTL ? "التاريخ" : "Date"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waste.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="ps-4 font-medium text-sm">
                      {entry.ingredientName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.reason}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell className="text-end pe-4 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
