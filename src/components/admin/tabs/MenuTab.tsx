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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, UtensilsCrossed, FolderTree, Search,
  Flame, Leaf, Star, Sparkles, Loader2, ImageOff, Tag,
} from "lucide-react";

type Category = {
  id: string; nameEn: string; nameAr: string; icon: string;
  color: string; sortOrder: number; isAvailable: boolean; stationSlugs: string;
  items: MenuItem[];
};
type MenuItem = {
  id: string; nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string;
  price: number; image: string; isAvailable: boolean; isPopular: boolean;
  isSpecial: boolean; isNew: boolean; preparationTime: number; calories: number;
  allergens: string; dietary: string; sortOrder: number; categoryId: string;
};

export function MenuTab() {
  const { t, isRTL, locale, fmtCurrency } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"items" | "categories">("items");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: MenuItem }>({ open: false });
  const [catDialog, setCatDialog] = useState<{ open: boolean; cat?: Category }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ["menu", "admin"],
    queryFn: async () => (await fetch("/api/menu?all=true")).json(),
  });
  const categories: Category[] = data?.categories || [];

  const allItems = categories.flatMap((c) => c.items.map((it) => ({ ...it, categoryName: locale === "ar" ? c.nameAr : c.nameEn })));

  const filteredItems = allItems.filter((it) => {
    if (filterCat !== "all" && it.categoryId !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!it.nameEn.toLowerCase().includes(q) && !it.nameAr.includes(search) && !it.descriptionEn.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const deleteItem = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذا الصنف؟" : "Delete this item?")) return;
    try {
      await apiFetch(`/api/menu/${id}?kind=item`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["menu"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteCat = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذه الفئة وكل أصنافها؟" : "Delete this category and all its items?")) return;
    try {
      await apiFetch(`/api/menu/${id}?kind=category`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["menu"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="items" className="gap-1.5">
              <UtensilsCrossed className="size-3.5" />
              {t.admin.menu}
              <Badge variant="secondary" className="ms-1 text-[10px]">{allItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5">
              <FolderTree className="size-3.5" />
              {isRTL ? "الفئات" : "Categories"}
              <Badge variant="secondary" className="ms-1 text-[10px]">{categories.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "items" ? (
          <Button onClick={() => setItemDialog({ open: true })} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            {t.admin.addItem}
          </Button>
        ) : (
          <Button onClick={() => setCatDialog({ open: true })} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            {t.admin.addCategory}
          </Button>
        )}
      </div>

      {tab === "items" ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.menu.search}
                className="ps-9"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.admin.category} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.menu.all}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {locale === "ar" ? c.nameAr : c.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {filteredItems.length === 0 ? (
                <EmptyState
                  icon={<UtensilsCrossed className="size-6" />}
                  title={t.menu.noResults}
                  description={isRTL ? "جرّب تعديل الفلاتر أو أضف صنفاً جديداً" : "Try adjusting filters or add a new item"}
                  action={
                    <Button size="sm" className="gap-1.5" onClick={() => setItemDialog({ open: true })}>
                      <Plus className="size-4" />
                      {t.admin.addItem}
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "الصنف" : "Item"}</TableHead>
                        <TableHead className="hidden md:table-cell">{t.admin.category}</TableHead>
                        <TableHead>{t.admin.price}</TableHead>
                        <TableHead className="hidden lg:table-cell">{isRTL ? "العلامات" : "Tags"}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t.admin.status}</TableHead>
                        <TableHead className="text-end pe-4">{t.admin.edit}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((it) => (
                        <TableRow key={it.id} className="hover:bg-muted/30">
                          <TableCell className="ps-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                {it.image ? (
                                  <img src={it.image} alt={it.nameEn} className="size-full object-cover" />
                                ) : (
                                  <ImageOff className="size-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{locale === "ar" ? it.nameAr : it.nameEn}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {locale === "ar" ? it.nameAr : it.nameEn}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="font-normal">
                              {it.categoryName}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {fmtCurrency(it.price)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex gap-1 flex-wrap">
                              {it.isPopular && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Flame className="size-3 me-0.5" />{t.admin.popular}</Badge>}
                              {it.isSpecial && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100"><Star className="size-3 me-0.5" />{t.admin.special}</Badge>}
                              {it.isNew && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><Sparkles className="size-3 me-0.5" />{t.admin.newItem}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {it.isAvailable ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{t.common.available}</Badge>
                            ) : (
                              <Badge variant="secondary">{t.common.unavailable}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-end pe-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={() => setItemDialog({ open: true, item: it })}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => deleteItem(it.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Categories grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <Card key={c.id} className="border-border/60 overflow-hidden">
              <div
                className="h-1.5"
                style={{ backgroundColor: c.color }}
              />
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="size-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${c.color}20` }}
                  >
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {locale === "ar" ? c.nameEn : c.nameAr}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {c.items.length} {isRTL ? "صنف" : "items"} · {c.stationSlugs || (isRTL ? "الكل" : "all")}
                    </div>
                  </div>
                  <Badge variant={c.isAvailable ? "default" : "secondary"} className="text-[10px]">
                    {c.isAvailable ? t.common.available : t.common.unavailable}
                  </Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 h-8"
                    onClick={() => setCatDialog({ open: true, cat: c })}
                  >
                    <Pencil className="size-3.5" />
                    {t.admin.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => deleteCat(c.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {categories.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-0">
                <EmptyState
                  icon={<FolderTree className="size-6" />}
                  title={isRTL ? "لا فئات" : "No categories"}
                  action={
                    <Button size="sm" className="gap-1.5" onClick={() => setCatDialog({ open: true })}>
                      <Plus className="size-4" />
                      {t.admin.addCategory}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Item dialog */}
      {itemDialog.open && (
        <ItemDialog
          open={itemDialog.open}
          item={itemDialog.item}
          categories={categories}
          onClose={() => setItemDialog({ open: false })}
          onSaved={() => {
            setItemDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["menu"] });
          }}
        />
      )}

      {/* Category dialog */}
      {catDialog.open && (
        <CategoryDialog
          open={catDialog.open}
          category={catDialog.cat}
          onClose={() => setCatDialog({ open: false })}
          onSaved={() => {
            setCatDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["menu"] });
          }}
        />
      )}
    </div>
  );
}

function ItemDialog({
  open, item, categories, onClose, onSaved,
}: {
  open: boolean;
  item?: MenuItem;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState<any>({
    nameEn: item?.nameEn || "",
    nameAr: item?.nameAr || "",
    descriptionEn: item?.descriptionEn || "",
    descriptionAr: item?.descriptionAr || "",
    price: item?.price || 0,
    image: item?.image || "",
    categoryId: item?.categoryId || categories[0]?.id || "",
    isAvailable: item?.isAvailable ?? true,
    isPopular: item?.isPopular || false,
    isSpecial: item?.isSpecial || false,
    isNew: item?.isNew || false,
    preparationTime: item?.preparationTime || 15,
    calories: item?.calories || 0,
    allergens: item?.allergens || "",
    dietary: item?.dietary || "",
    sortOrder: item?.sortOrder || 0,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.nameEn || !form.nameAr || !form.categoryId) {
      toast.error(isRTL ? "أكمل الحقول المطلوبة" : "Please fill required fields");
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await apiFetch(`/api/menu/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success(isRTL ? "تم الحفظ" : "Saved");
      } else {
        await apiFetch("/api/menu", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success(isRTL ? "تمت الإضافة" : "Created");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? t.admin.editItem : t.admin.addItem}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? "املأ تفاصيل الصنف باللغتين" : "Fill item details in both languages"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t.admin.nameEn} *</Label>
            <Input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.nameAr} *</Label>
            <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t.admin.descriptionEn}</Label>
            <Textarea value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} dir="ltr" rows={2} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t.admin.descriptionAr}</Label>
            <Textarea value={form.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} dir="rtl" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.price}</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", parseFloat(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.category}</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>{t.admin.image}</Label>
            <Input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://..." dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.preparationTime}</Label>
            <Input type="number" value={form.preparationTime} onChange={(e) => set("preparationTime", parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.calories}</Label>
            <Input type="number" value={form.calories} onChange={(e) => set("calories", parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.allergens}</Label>
            <Input value={form.allergens} onChange={(e) => set("allergens", e.target.value)} placeholder="gluten,dairy,nuts" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.dietary}</Label>
            <Input value={form.dietary} onChange={(e) => set("dietary", e.target.value)} placeholder="halal,spicy,vegan" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.sortOrder}</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} />
          </div>
        </div>

        {/* Flags */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <FlagToggle label={t.admin.available} checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} />
          <FlagToggle label={t.admin.popular} checked={form.isPopular} onChange={(v) => set("isPopular", v)} />
          <FlagToggle label={t.admin.special} checked={form.isSpecial} onChange={(v) => set("isSpecial", v)} />
          <FlagToggle label={t.admin.newItem} checked={form.isNew} onChange={(v) => set("isNew", v)} />
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

function FlagToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
      <span className="text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CategoryDialog({
  open, category, onClose, onSaved,
}: {
  open: boolean;
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState<any>({
    nameEn: category?.nameEn || "",
    nameAr: category?.nameAr || "",
    icon: category?.icon || "🍽️",
    color: category?.color || "#f59e0b",
    sortOrder: category?.sortOrder || 0,
    stationSlugs: category?.stationSlugs || "",
    isAvailable: category?.isAvailable ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.nameEn || !form.nameAr) {
      toast.error(isRTL ? "أكمل الأسماء" : "Names required");
      return;
    }
    setSaving(true);
    try {
      const payload = { type: "category", ...form };
      if (category) {
        await apiFetch(`/api/menu/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/menu", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success(isRTL ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? t.admin.editCategory : t.admin.addCategory}
          </DialogTitle>
          <DialogDescription>{t.admin.menu}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.nameEn} *</Label>
              <Input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.nameAr} *</Label>
              <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t.admin.icon}</Label>
              <Input value={form.icon} onChange={(e) => set("icon", e.target.value)} className="text-center text-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.color}</Label>
              <div className="flex gap-2">
                <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="size-9 rounded-md border border-border cursor-pointer" />
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.sortOrder}</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Tag className="size-3.5" />
              {t.admin.assignCategories}
            </Label>
            <Input
              value={form.stationSlugs}
              onChange={(e) => set("stationSlugs", e.target.value)}
              placeholder="grill,prep,bar,dessert (empty = all)"
              dir="ltr"
            />
          </div>
          <FlagToggle label={t.admin.available} checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} />
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
