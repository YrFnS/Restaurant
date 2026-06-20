"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, cartSubtotal, type CartModifier, type CartItem } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Flame, Leaf, Clock, Heart, Plus, Minus, X,
  Check, ChevronDown, SlidersHorizontal, Utensils
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function MenuSection() {
  const { t, isRTL, fmtCurrency } = useI18n();
  const { addToCart, favorites, toggleFavorite, addRecentSearch, recentSearches } = useRestaurantStore();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [sort, setSort] = useState("popular");
  const [showFilters, setShowFilters] = useState(false);
  const [dietary, setDietary] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => (await fetch("/api/menu")).json(),
  });
  const categories: any[] = data?.categories || [];
  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);

  const filtered = useMemo(() => {
    let items = allItems;
    if (activeCat !== "all") items = items.filter((i) => i.categoryId === activeCat);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) => i.nameEn.toLowerCase().includes(q) || i.nameAr.includes(query) || i.descriptionEn.toLowerCase().includes(q)
      );
    }
    if (dietary.length) {
      items = items.filter((i) => dietary.every((d) => i.dietary?.includes(d)));
    }
    if (sort === "priceLow") items = [...items].sort((a, b) => a.price - b.price);
    else if (sort === "priceHigh") items = [...items].sort((a, b) => b.price - a.price);
    else if (sort === "prepTime") items = [...items].sort((a, b) => a.preparationTime - b.preparationTime);
    else if (sort === "popular") items = [...items].sort((a, b) => Number(b.isPopular) - Number(a.isPopular));
    return items;
  }, [allItems, activeCat, query, sort, dietary]);

  const favoriteItems = allItems.filter((i) => favorites.includes(i.id));

  const quickAdd = (item: any) => {
    const cartItem: CartItem = {
      id: `${item.id}_${Date.now()}`,
      menuItemId: item.id,
      nameEn: item.nameEn, nameAr: item.nameAr,
      price: item.price, basePrice: item.price,
      quantity: 1, image: item.image || "",
      modifiers: [], notes: "", course: 1,
      totalPrice: item.price,
    };
    addToCart(cartItem);
    toast.success(`${isRTL ? item.nameAr : item.nameEn} ${t.menu.added}`);
  };

  const dietaryFilters = [
    { id: "vegetarian", label: t.menu.vegetarian, icon: "🥬" },
    { id: "vegan", label: t.menu.vegan, icon: "🌱" },
    { id: "gluten_free", label: t.menu.glutenFree, icon: "🌾" },
    { id: "halal", label: t.menu.halal, icon: "清真" },
    { id: "spicy", label: t.menu.spicy, icon: "🌶️" },
  ];

  return (
    <div className="flex-1">
      {/* Header */}
      <div className="sticky top-14 md:top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold">{t.menu.title}</h1>
            <Badge variant="secondary" className="ms-auto">{allItems.length} {t.menu.items}</Badge>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <Input
                placeholder={t.menu.search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.length > 2) addRecentSearch(e.target.value);
                }}
                className="ps-9 bg-background"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>

          {/* Recent searches */}
          {!query && recentSearches.length > 0 && (
            <div className="flex items-center gap-2 mt-2 overflow-x-auto no-scrollbar">
              <span className="text-xs text-muted-foreground shrink-0">{t.menu.recentSearches}:</span>
              {recentSearches.slice(0, 5).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className="text-xs px-2.5 py-1 rounded-full bg-accent hover:bg-accent/70 shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Category pills */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveCat("all")}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
              }`}
            >
              {t.menu.all}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                }`}
              >
                <span>{c.icon}</span>
                {isRTL ? c.nameAr : c.nameEn}
              </button>
            ))}
          </div>

          {/* Filters panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-border">
                  {dietaryFilters.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setDietary((p) => p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        dietary.includes(f.id) ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                      }`}
                    >
                      <span>{f.icon}</span>
                      {f.label}
                    </button>
                  ))}
                  <div className="ms-auto flex items-center gap-2">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      className="text-xs bg-accent rounded-full px-3 py-1.5 border-0 focus:ring-1 focus:ring-primary"
                    >
                      <option value="popular">{t.menu.sortPopular}</option>
                      <option value="priceLow">{t.menu.sortPriceLow}</option>
                      <option value="priceHigh">{t.menu.sortPriceHigh}</option>
                      <option value="prepTime">{t.menu.sortPrepTime}</option>
                    </select>
                    {(dietary.length > 0 || query) && (
                      <Button variant="ghost" size="sm" onClick={() => { setDietary([]); setQuery(""); }} className="text-xs h-7">
                        {t.menu.clearFilters}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {favorites.length > 0 && !query && activeCat === "all" && (
          <div className="mb-8">
            <h2 className="flex items-center gap-2 text-lg font-bold mb-3">
              <Heart className="size-5 fill-red-500 text-red-500" />
              {t.menu.favorites}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favoriteItems.map((item) => (
                <MenuItemCard key={item.id} item={item} onOpen={() => setDetailItem(item)} onQuickAdd={() => quickAdd(item)} />
              ))}
            </div>
          </div>
        )}

        {activeCat === "all" && !query ? (
          // Group by category
          categories.map((cat) => (
            <div key={cat.id} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${cat.color}20` }}>
                  {cat.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{isRTL ? cat.nameAr : cat.nameEn}</h2>
                  <p className="text-xs text-muted-foreground">{cat.items.length} {t.menu.items}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.items.map((item: any) => (
                  <MenuItemCard key={item.id} item={item} onOpen={() => setDetailItem(item)} onQuickAdd={() => quickAdd(item)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {t.menu.showing} {filtered.length} {t.menu.items}
            </p>
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Utensils className="size-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">{t.menu.noResults}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((item) => (
                  <MenuItemCard key={item.id} item={item} onOpen={() => setDetailItem(item)} onQuickAdd={() => quickAdd(item)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item Detail Sheet */}
      <ItemDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
    </div>
  );
}

function MenuItemCard({ item, onOpen, onQuickAdd }: { item: any; onOpen: () => void; onQuickAdd: () => void }) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const { favorites, toggleFavorite } = useRestaurantStore();
  const isFav = favorites.includes(item.id);
  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;

  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      <div className="relative h-40 bg-gradient-to-br from-primary/15 to-accent/40 overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={isRTL ? item.nameAr : item.nameEn} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <span className="text-5xl opacity-50 group-hover:scale-110 transition-transform duration-500">🍽️</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 start-2 flex flex-col gap-1">
          {item.isPopular && <Badge variant="default" className="gap-1 text-[10px] py-0 backdrop-blur-md"><Flame className="size-2.5" />{t.menu.popular}</Badge>}
          {item.isSpecial && <Badge variant="secondary" className="gap-1 text-[10px] py-0 backdrop-blur-md"><Utensils className="size-2.5" />{t.menu.special}</Badge>}
          {item.isNew && <Badge className="bg-green-500 gap-1 text-[10px] py-0 backdrop-blur-md">NEW</Badge>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); toast.success(isFav ? t.menu.removedFromFavorites : t.menu.addedToFavorites); }}
          className="absolute top-2 end-2 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
        >
          <Heart className={`size-4 ${isFav ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm leading-tight line-clamp-1">{isRTL ? item.nameAr : item.nameEn}</h3>
          <span className="font-bold text-primary shrink-0">{fmtCurrency(item.price)}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[2rem]">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="size-3" />{item.preparationTime}{t.common.minutes}</span>
          {item.dietary?.includes("spicy") && <span className="flex items-center gap-0.5 text-[10px] text-red-500"><Flame className="size-3" />{t.menu.spicy}</span>}
          {item.dietary?.includes("vegetarian") && <span className="flex items-center gap-0.5 text-[10px] text-green-600"><Leaf className="size-3" />{t.menu.vegetarian}</span>}
        </div>
        <div className="flex gap-2">
          {hasModifiers ? (
            <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={onOpen}>
              <SlidersHorizontal className="size-3" />
              {t.menu.customize}
            </Button>
          ) : (
            <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={onQuickAdd}>
              <Plus className="size-3.5" />
              {t.menu.addToCart}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ItemDetailSheet({ item, onClose }: { item: any; onClose: () => void }) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const { addToCart } = useRestaurantStore();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  if (!item) return null;

  const computePrice = () => {
    let price = item.price;
    item.modifierGroups?.forEach((g: any) => {
      (selected[g.id] || []).forEach((optId) => {
        const opt = g.options.find((o: any) => o.id === optId);
        if (opt) price += opt.price;
      });
    });
    return price * qty;
  };

  const validate = () => {
    for (const g of item.modifierGroups || []) {
      if (g.isRequired && (!selected[g.id] || selected[g.id].length === 0)) {
        return false;
      }
    }
    return true;
  };

  const handleAdd = () => {
    if (!validate()) {
      toast.error(t.menu.modifierRequired);
      return;
    }
    const modifiers: CartModifier[] = [];
    item.modifierGroups?.forEach((g: any) => {
      (selected[g.id] || []).forEach((optId) => {
        const opt = g.options.find((o: any) => o.id === optId);
        if (opt) modifiers.push({ id: opt.id, nameEn: opt.nameEn, nameAr: opt.nameAr, price: opt.price, preset: opt.preset });
      });
    });
    const unitPrice = item.price + modifiers.reduce((s, m) => s + m.price, 0);
    addToCart({
      id: `${item.id}_${Date.now()}`,
      menuItemId: item.id,
      nameEn: item.nameEn, nameAr: item.nameAr,
      price: unitPrice, basePrice: item.price,
      quantity: qty, image: item.image || "",
      modifiers, notes, course: 1,
      totalPrice: unitPrice * qty,
    });
    toast.success(`${isRTL ? item.nameAr : item.nameEn} ${t.menu.added}`);
    onClose();
    setSelected({}); setQty(1); setNotes("");
  };

  const toggleOption = (groupId: string, optId: string, max: number) => {
    setSelected((prev) => {
      const cur = prev[groupId] || [];
      if (cur.includes(optId)) {
        return { ...prev, [groupId]: cur.filter((x) => x !== optId) };
      }
      if (max === 1) return { ...prev, [groupId]: [optId] };
      if (cur.length >= max) return prev;
      return { ...prev, [groupId]: [...cur, optId] };
    });
  };

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-0">
          <div className="relative h-48 bg-gradient-to-br from-primary/20 to-accent overflow-hidden">
            {item.image ? (
              <img src={item.image} alt={isRTL ? item.nameAr : item.nameEn} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-6xl opacity-50">🍽️</span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <button onClick={onClose} className="absolute top-3 end-3 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
              <X className="size-4" />
            </button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <SheetTitle className="text-xl">{isRTL ? item.nameAr : item.nameEn}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
              </div>
              <span className="text-2xl font-bold text-primary shrink-0">{fmtCurrency(item.price)}</span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-3 mb-4">
              <Badge variant="outline" className="gap-1"><Clock className="size-3" />{item.preparationTime}{t.common.minutes}</Badge>
              {item.calories > 0 && <Badge variant="outline" className="gap-1">🔥 {item.calories} {t.menu.calories}</Badge>}
              {item.allergens && <Badge variant="outline" className="gap-1 text-red-600">⚠ {item.allergens}</Badge>}
            </div>

            {/* Modifier groups */}
            <div className="space-y-5">
              {(item.modifierGroups || []).map((g: any) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{isRTL ? g.nameAr : g.nameEn}</h4>
                    <span className="text-xs text-muted-foreground">
                      {g.isRequired ? t.menu.required : t.menu.optional}
                      {g.maxSelect > 1 && ` · ${t.menu.chooseUpTo.replace("{n}", g.maxSelect)}`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.options.map((opt: any) => {
                      const isSel = (selected[g.id] || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleOption(g.id, opt.id, g.maxSelect)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start ${
                            isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                            isSel ? "bg-primary border-primary" : "border-muted-foreground/30"
                          }`}>
                            {isSel && <Check className="size-3 text-primary-foreground" />}
                          </div>
                          <span className="flex-1 text-sm">{isRTL ? opt.nameAr : opt.nameEn}</span>
                          {opt.price > 0 && <span className="text-sm font-medium text-primary">+{fmtCurrency(opt.price)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-5">
              <h4 className="font-semibold text-sm mb-2">{t.menu.specialInstructions}</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.menu.specialInstructionsPlaceholder}
                rows={2}
                dir="auto"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="border-t border-border p-4 flex-row items-center gap-3">
          <div className="flex items-center gap-2 border rounded-full p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-8 rounded-full hover:bg-accent flex items-center justify-center">
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="size-8 rounded-full hover:bg-accent flex items-center justify-center">
              <Plus className="size-4" />
            </button>
          </div>
          <Button onClick={(e) => { e.stopPropagation(); handleAdd(); }} className="flex-1 h-12 text-base gap-2">
            {t.menu.addToCart} · {fmtCurrency(computePrice())}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
