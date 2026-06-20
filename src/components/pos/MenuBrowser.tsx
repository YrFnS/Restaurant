"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Flame, Leaf, Sparkles, Plus, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type MenuCategory,
  type MenuItem,
  type PosOrderItem,
} from "./types";
import { lineId } from "./types";

interface MenuBrowserProps {
  onAddItem: (item: PosOrderItem) => void;
  /** When true, tapping an item that has required modifier groups opens a dialog */
  onItemNeedsModifiers?: (item: MenuItem) => void;
  /** Search highlight hook (for "popular only" quick toggle) */
}

export function MenuBrowser({ onAddItem, onItemNeedsModifiers }: MenuBrowserProps) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [popularOnly, setPopularOnly] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const r = await fetch("/api/menu");
      return (await r.json()) as { categories: MenuCategory[] };
    },
    staleTime: 60_000,
  });

  const categories = data?.categories ?? [];
  const allItems = useMemo(
    () => categories.flatMap((c) => c.items),
    [categories]
  );

  const filtered = useMemo(() => {
    let items = allItems;
    if (activeCat !== "all") items = items.filter((i) => i.categoryId === activeCat);
    if (popularOnly) items = items.filter((i) => i.isPopular || i.isSpecial);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.nameEn.toLowerCase().includes(q) ||
          i.nameAr.includes(query.trim()) ||
          i.descriptionEn.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allItems, activeCat, popularOnly, query]);

  const dietaryIcon = (d: string): { icon: string; label: string } | null => {
    if (d.includes("spicy")) return { icon: "🌶️", label: t.menu.spicy };
    if (d.includes("vegan")) return { icon: "🌱", label: t.menu.vegan };
    if (d.includes("vegetarian")) return { icon: "🥬", label: t.menu.vegetarian };
    if (d.includes("halal")) return { icon: "清真", label: t.menu.halal };
    if (d.includes("gluten_free")) return { icon: "🌾", label: t.menu.glutenFree };
    return null;
  };

  const handleTap = (item: MenuItem) => {
    const hasRequired = item.modifierGroups?.some((g) => g.isRequired);
    if (hasRequired && onItemNeedsModifiers) {
      onItemNeedsModifiers(item);
      return;
    }
    // Quick add — no required modifiers
    const line: PosOrderItem = {
      id: lineId(),
      menuItemId: item.id,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      price: item.price,
      basePrice: item.price,
      quantity: 1,
      image: item.image || "",
      modifiers: [],
      notes: "",
      course: 1,
      stationSlug:
        categories.find((c) => c.id === item.categoryId)?.stationSlugs || "prep",
      totalPrice: item.price,
      allergens: item.allergens,
      dietary: item.dietary,
    };
    onAddItem(line);
    setRecentlyAdded(item.id);
    setTimeout(() => setRecentlyAdded(null), 600);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 space-y-2 border-b border-border">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-border bg-card/30 space-y-2">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t.pos.searchItems}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-9 pe-9 h-11 bg-background"
            aria-label={t.common.search}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 -translate-y-1/2 end-2.5 size-6 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground"
              aria-label={t.common.clear}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={popularOnly ? "default" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setPopularOnly((p) => !p)}
        >
          <Flame className="size-4" />
          {t.menu.popular}
        </Button>
      </div>

      {/* Category tabs */}
      <div className="border-b border-border bg-background">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-2">
          <CatTab
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            icon="🍽️"
            label={t.menu.all}
            count={allItems.length}
          />
          {categories.map((c) => (
            <CatTab
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              icon={c.icon}
              label={isRTL ? c.nameAr : c.nameEn}
              count={c.items.length}
            />
          ))}
        </div>
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
            <Search className="size-10 mb-3 opacity-40" />
            <p className="font-medium">{t.menu.noResults}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filtered.map((item) => {
              const diet = dietaryIcon(item.dietary);
              const justAdded = recentlyAdded === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTap(item)}
                  className="group relative flex flex-col text-start bg-card rounded-xl border border-border overflow-hidden transition-all hover:border-primary hover:shadow-md active:scale-[0.98]"
                  aria-label={`${isRTL ? item.nameAr : item.nameEn} — ${t.pos.addToOrder}`}
                >
                  {/* Image / placeholder */}
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/40 overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={isRTL ? item.nameAr : item.nameEn}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center text-4xl opacity-70">
                        {categories.find((c) => c.id === item.categoryId)?.icon || "🍽️"}
                      </div>
                    )}
                    {/* Badges */}
                    <div className="absolute top-1.5 start-1.5 flex flex-col gap-1">
                      {item.isPopular && (
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0 h-5 gap-0.5">
                          <Flame className="size-2.5" /> {t.menu.popular}
                        </Badge>
                      )}
                      {item.isSpecial && (
                        <Badge className="bg-rose-500 hover:bg-rose-500 text-white text-[10px] px-1.5 py-0 h-5 gap-0.5">
                          <Sparkles className="size-2.5" /> {t.menu.special}
                        </Badge>
                      )}
                      {item.isNew && (
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-5">
                          {t.menu.new}
                        </Badge>
                      )}
                    </div>
                    {/* Add button overlay */}
                    <div
                      className={`absolute bottom-1.5 end-1.5 size-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all ${
                        justAdded
                          ? "scale-110 bg-emerald-500"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {justAdded ? (
                        <Check className="size-4" />
                      ) : (
                        <Plus className="size-5" />
                      )}
                    </div>
                  </div>

                  {/* Text */}
                  <div className="p-2.5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                        {isRTL ? item.nameAr : item.nameEn}
                      </h3>
                      {diet && (
                        <span
                          title={diet.label}
                          className="text-xs shrink-0"
                          aria-label={diet.label}
                        >
                          {diet.icon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {isRTL ? item.descriptionAr : item.descriptionEn}
                    </p>
                    <div className="mt-auto pt-1.5 flex items-center justify-between">
                      <span className="font-bold text-primary text-base tabular-nums">
                        {fmtCurrency(item.price)}
                      </span>
                      {item.modifierGroups && item.modifierGroups.length > 0 && (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                          <Leaf className="size-2.5" />
                          {item.modifierGroups.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CatTab({
  active, onClick, icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-foreground border-border hover:bg-accent"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
      <span className={`text-xs tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}
