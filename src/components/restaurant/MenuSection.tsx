"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  X,
  UtensilsCrossed,
  Sparkles,
  Star,
  Clock,
  Flame,
  Leaf,
  Wheat,
  ShieldCheck,
  Zap,
  SearchX,
  FilterX,
  ChevronUp,
  Heart,
  ArrowUpDown,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import {
  useRestaurantStore,
  type CartItem,
  type CartModifier,
} from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/hooks/use-notifications";
import { QRCodeMenu } from "@/components/restaurant/QRCodeMenu";
import { NutritionalInfo } from "@/components/restaurant/NutritionalInfo";
import { NutritionalInfoModal } from "@/components/restaurant/NutritionalInfoModal";

/* ─── Type Definitions ─── */

interface MenuItemModifier {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
  price: number;
}

interface MenuItem {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isPopular: boolean;
  isSpecial: boolean;
  preparationTime: number;
  calories: number;
  allergens: string;
  dietary: string;
  sortOrder: number;
  categoryId: string;
  modifiers: MenuItemModifier[];
}

interface MenuCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  sortOrder: number;
  isAvailable: boolean;
  items: MenuItem[];
}

/* ─── Constants ─── */

const categoryGradients: Record<string, string> = {
  "🥗": "from-green-400/80 to-emerald-500/80",
  "🍲": "from-amber-400/80 to-orange-500/80",
  "🥩": "from-red-400/80 to-rose-500/80",
  "🦐": "from-cyan-400/80 to-teal-500/80",
  "🍝": "from-yellow-400/80 to-amber-500/80",
  "🍕": "from-orange-400/80 to-red-500/80",
  "🥬": "from-lime-400/80 to-green-500/80",
  "🍰": "from-pink-400/80 to-rose-500/80",
  "🥤": "from-sky-400/80 to-blue-500/80",
  "🍟": "from-amber-300/80 to-yellow-500/80",
};

const defaultGradient = "from-amber-400/80 to-orange-500/80";

const dietaryFilterConfig = [
  { key: "vegetarian", icon: Leaf, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", activeColor: "bg-green-500 text-white dark:bg-green-600" },
  { key: "vegan", icon: Leaf, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", activeColor: "bg-emerald-500 text-white dark:bg-emerald-600" },
  { key: "gluten-free", icon: Wheat, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeColor: "bg-amber-500 text-white dark:bg-amber-600" },
  { key: "halal", icon: ShieldCheck, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", activeColor: "bg-teal-500 text-white dark:bg-teal-600" },
  { key: "spicy", icon: Zap, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", activeColor: "bg-red-500 text-white dark:bg-red-600" },
];

const allergenFilterConfig = [
  { key: "nuts", emoji: "🥜", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", activeColor: "bg-orange-500 text-white dark:bg-orange-600" },
  { key: "dairy", emoji: "🥛", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", activeColor: "bg-sky-500 text-white dark:bg-sky-600" },
  { key: "gluten", emoji: "🌾", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeColor: "bg-amber-500 text-white dark:bg-amber-600" },
  { key: "shellfish", emoji: "🦐", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", activeColor: "bg-rose-500 text-white dark:bg-rose-600" },
  { key: "eggs", emoji: "🥚", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", activeColor: "bg-yellow-500 text-white dark:bg-yellow-600" },
  { key: "soy", emoji: "🫘", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400", activeColor: "bg-lime-500 text-white dark:bg-lime-600" },
  { key: "fish", emoji: "🐟", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", activeColor: "bg-cyan-500 text-white dark:bg-cyan-600" },
];

const dietaryBadgeColors: Record<string, string> = {
  vegetarian: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  vegan: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "gluten-free": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  halal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  spicy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/* ─── Sort Types ─── */
type SortOption = "default" | "price-low" | "price-high" | "popular" | "prep-time";

/* ─── Main Component ─── */

export function MenuSection() {
  const { t, locale, isRTL } = useI18n();
  const isMobile = useIsMobile();
  const addToCart = useRestaurantStore((s) => s.addToCart);
  const storeSelectedCategoryId = useRestaurantStore((s) => s.selectedCategoryId);
  const storeSearchQuery = useRestaurantStore((s) => s.searchQuery);
  const storeDietaryFilters = useRestaurantStore((s) => s.dietaryFilters);
  const setSelectedCategoryId = useRestaurantStore((s) => s.setSelectedCategoryId);
  const setSearchQuery = useRestaurantStore((s) => s.setSearchQuery);
  const setDietaryFilters = useRestaurantStore((s) => s.setDietaryFilters);
  const favorites = useRestaurantStore((s) => s.favorites);
  const toggleFavorite = useRestaurantStore((s) => s.toggleFavorite);
  const notifications = useNotifications();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState(storeSearchQuery);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(storeSelectedCategoryId);
  const [activeDietary, setActiveDietary] = useState<string[]>(storeDietaryFilters);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [allergenExclusions, setAllergenExclusions] = useState<string[]>([]);
  const [nutritionalModalOpen, setNutritionalModalOpen] = useState(false);

  // Detail dialog state
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Tabs scroll ref
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recentMenuSearches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("recentMenuSearches", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== query);
      try {
        localStorage.setItem("recentMenuSearches", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("recentMenuSearches");
    } catch {
      // ignore
    }
  }, []);

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
      // Save to recent searches when search has content
      if (localSearch.trim().length >= 2) {
        saveRecentSearch(localSearch.trim());
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery, saveRecentSearch]);

  // Sync with store
  useEffect(() => {
    setActiveCategoryId(storeSelectedCategoryId);
  }, [storeSelectedCategoryId]);

  useEffect(() => {
    setActiveDietary(storeDietaryFilters);
  }, [storeDietaryFilters]);

  // Fetch menu data
  useEffect(() => {
    async function fetchMenu() {
      setLoading(true);
      try {
        const res = await fetch("/api/menu");
        const data = await res.json();
        if (data.categories) setCategories(data.categories);
      } catch (err) {
        console.error("Error fetching menu:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, []);

  // Handle category tab click
  const handleCategoryClick = useCallback(
    (categoryId: string | null) => {
      setActiveCategoryId(categoryId);
      setSelectedCategoryId(categoryId);
    },
    [setSelectedCategoryId]
  );

  // Handle dietary filter toggle
  const handleDietaryToggle = useCallback(
    (key: string) => {
      setActiveDietary((prev) => {
        const newFilters = prev.includes(key)
          ? prev.filter((f) => f !== key)
          : [...prev, key];
        setDietaryFilters(newFilters);
        return newFilters;
      });
    },
    [setDietaryFilters]
  );

  // Handle allergen exclusion toggle
  const handleAllergenToggle = useCallback((key: string) => {
    setAllergenExclusions((prev) =>
      prev.includes(key)
        ? prev.filter((a) => a !== key)
        : [...prev, key]
    );
  }, []);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setLocalSearch("");
    setSearchQuery("");
    setActiveCategoryId(null);
    setSelectedCategoryId(null);
    setActiveDietary([]);
    setDietaryFilters([]);
    setSortOption("default");
    setShowFavoritesOnly(false);
    setAllergenExclusions([]);
  }, [setSearchQuery, setSelectedCategoryId, setDietaryFilters]);

  // Filter & sort items
  const filteredCategories = useMemo(() => {
    const searchLower = storeSearchQuery.toLowerCase().trim();

    const filtered = categories
      .map((cat) => {
        // Filter by category
        if (activeCategoryId && cat.id !== activeCategoryId) return null;

        let filteredItems = cat.items.filter((item) => {
          // Search filter
          if (searchLower) {
            const matchesSearch =
              item.nameEn.toLowerCase().includes(searchLower) ||
              item.nameAr.includes(storeSearchQuery) ||
              item.descriptionEn.toLowerCase().includes(searchLower) ||
              item.descriptionAr.includes(storeSearchQuery);
            if (!matchesSearch) return false;
          }

          // Dietary filter
          if (activeDietary.length > 0) {
            const itemDietary = item.dietary
              ? item.dietary.split(",").filter(Boolean)
              : [];
            const matchesAll = activeDietary.every((d) =>
              itemDietary.includes(d)
            );
            if (!matchesAll) return false;
          }

          // Favorites filter
          if (showFavoritesOnly && !favorites.includes(item.id)) return false;

          // Allergen exclusion filter
          if (allergenExclusions.length > 0) {
            const itemAllergens = item.allergens
              ? item.allergens.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
              : [];
            const hasExcludedAllergen = allergenExclusions.some((excluded) =>
              itemAllergens.includes(excluded)
            );
            if (hasExcludedAllergen) return false;
          }

          return true;
        });

        // Sort items
        filteredItems = [...filteredItems].sort((a, b) => {
          switch (sortOption) {
            case "price-low":
              return a.price - b.price;
            case "price-high":
              return b.price - a.price;
            case "popular":
              if (a.isPopular && !b.isPopular) return -1;
              if (!a.isPopular && b.isPopular) return 1;
              return 0;
            case "prep-time":
              return a.preparationTime - b.preparationTime;
            default:
              return a.sortOrder - b.sortOrder;
          }
        });

        return { ...cat, items: filteredItems };
      })
      .filter(Boolean) as MenuCategory[];

    return filtered;
  }, [categories, activeCategoryId, storeSearchQuery, activeDietary, sortOption, showFavoritesOnly, favorites, allergenExclusions]);

  // Total items count
  const totalFilteredItems = filteredCategories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  );

  // Quick add (no modifiers dialog)
  const handleQuickAdd = useCallback(
    (item: MenuItem, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const cartItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        price: item.price,
        quantity: 1,
        image: item.image,
        modifiers: [],
        notes: "",
        totalPrice: item.price,
      };
      addToCart(cartItem);
      notifications.cartAdded(locale === "ar" ? item.nameAr : item.nameEn);
      setAddedItemId(item.id);
      setTimeout(() => setAddedItemId(null), 600);
    },
    [addToCart, notifications, locale]
  );

  // Open detail dialog
  const handleOpenDetail = useCallback((item: MenuItem) => {
    setDetailItem(item);
    setSelectedVariant(null);
    setSelectedAddons([]);
    setQuantity(1);
    setSpecialInstructions("");
    requestAnimationFrame(() => {
      setDetailOpen(true);
    });
  }, []);

  // Detail dialog: compute total price
  const detailTotalPrice = useMemo(() => {
    if (!detailItem) return 0;
    let total = detailItem.price;

    if (selectedVariant) {
      const variant = detailItem.modifiers.find(
        (m) => m.id === selectedVariant && m.type === "variant"
      );
      if (variant) total += variant.price;
    }

    selectedAddons.forEach((addonId) => {
      const addon = detailItem.modifiers.find(
        (m) => m.id === addonId && m.type === "addon"
      );
      if (addon) total += addon.price;
    });

    return total * quantity;
  }, [detailItem, selectedVariant, selectedAddons, quantity]);

  // Detail dialog: add to cart
  const handleDetailAddToCart = useCallback(() => {
    if (!detailItem) return;

    const modifiers: CartModifier[] = [];

    if (selectedVariant) {
      const variant = detailItem.modifiers.find(
        (m) => m.id === selectedVariant && m.type === "variant"
      );
      if (variant) {
        modifiers.push({
          id: variant.id,
          nameEn: variant.nameEn,
          nameAr: variant.nameAr,
          price: variant.price,
          type: "variant",
        });
      }
    }

    selectedAddons.forEach((addonId) => {
      const addon = detailItem.modifiers.find(
        (m) => m.id === addonId && m.type === "addon"
      );
      if (addon) {
        modifiers.push({
          id: addon.id,
          nameEn: addon.nameEn,
          nameAr: addon.nameAr,
          price: addon.price,
          type: "addon",
        });
      }
    });

    const unitPrice = detailItem.price + modifiers.reduce((sum, m) => sum + m.price, 0);

    const cartItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      menuItemId: detailItem.id,
      nameEn: detailItem.nameEn,
      nameAr: detailItem.nameAr,
      price: unitPrice,
      quantity,
      image: detailItem.image,
      modifiers,
      notes: specialInstructions,
      totalPrice: unitPrice * quantity,
    };

    addToCart(cartItem);
    notifications.cartAdded(locale === "ar" ? detailItem.nameAr : detailItem.nameEn);
    setDetailOpen(false);
    setDetailItem(null);
    setAddedItemId(detailItem.id);
    setTimeout(() => setAddedItemId(null), 600);
  }, [detailItem, selectedVariant, selectedAddons, quantity, specialInstructions, addToCart, notifications, locale]);

  // Toggle addon
  const handleToggleAddon = useCallback((addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  }, []);

  // Separate modifiers
  const variants = detailItem?.modifiers.filter((m) => m.type === "variant") || [];
  const addons = detailItem?.modifiers.filter((m) => m.type === "addon") || [];

  const settings = useRestaurantStore((s) => s.settings);
  const currency = settings?.currencySymbol ?? "";

  return (
    <div className="pb-4 space-y-4">
      {/* ─── Category Tabs ─── */}
      <div className="sticky top-14 md:top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="bg-gradient-to-r from-amber-50/50 via-orange-50/30 to-rose-50/50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-rose-950/20">
        <div
          ref={tabsScrollRef}
          className="flex gap-1 overflow-x-auto custom-scrollbar px-4 py-2.5 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* "All" tab */}
          <button
            onClick={() => handleCategoryClick(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              !activeCategoryId
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-current={!activeCategoryId ? "true" : undefined}
          >
            <UtensilsCrossed className="size-3.5" />
            {t.menu.all}
            <span className={`text-xs ${!activeCategoryId ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {categories.reduce((sum, c) => sum + c.items.length, 0)}
            </span>
          </button>

          {/* Favorites tab */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              showFavoritesOnly
                ? "bg-red-500 text-white shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-pressed={showFavoritesOnly}
          >
            <Heart className={`size-3.5 ${showFavoritesOnly ? "fill-white" : ""}`} />
            {t.menu.favorites}
            {favorites.length > 0 && (
              <span className={`text-xs ${showFavoritesOnly ? "text-white/80" : "text-muted-foreground"}`}>
                ({favorites.length})
              </span>
            )}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategoryId === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-current={activeCategoryId === cat.id ? "true" : undefined}
            >
              <span className="text-base">{cat.icon}</span>
              {locale === "ar" ? cat.nameAr : cat.nameEn}
              <span className={`text-xs ${activeCategoryId === cat.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {cat.items.length}
              </span>
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ─── Search Bar, QR Share & Sort ─── */}
      <div className="px-4 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-10 shrink-0 bg-muted/30 border-0"
          onClick={() => setQrCodeOpen(true)}
          aria-label={t.menu.shareMenu}
        >
          <QrCode className="size-4" />
        </Button>
        <div className="relative flex-1">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder={t.menu.search}
            className="ps-11 pe-9 h-12 bg-background rounded-xl shadow-sm border border-border/50 focus-visible:ring-2 focus-visible:ring-primary text-base"
            aria-label={t.menu.search}
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t.common.cancel}
            >
              <X className="size-4" />
            </button>
          )}
          {/* Recent Searches Dropdown */}
          {searchFocused && !localSearch && recentSearches.length > 0 && (
            <div className="absolute top-full start-0 end-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground">{t.menu.recentSearches}</span>
                <button
                  onClick={clearRecentSearches}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t.menu.clearRecentSearches}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {recentSearches.map((search, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setLocalSearch(search);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{search}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(search);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t.common.cancel}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-auto min-w-[120px] h-12 bg-background rounded-xl shadow-sm border border-border/50">
            <ArrowUpDown className="size-3.5 me-1" />
            <SelectValue placeholder={t.menu.sortBy} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t.menu.sortBy}</SelectItem>
            <SelectItem value="price-low">{t.menu.sortPriceLow}</SelectItem>
            <SelectItem value="price-high">{t.menu.sortPriceHigh}</SelectItem>
            <SelectItem value="popular">{t.menu.sortPopular}</SelectItem>
            <SelectItem value="prep-time">{t.menu.sortPrepTime}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Dietary Filters ─── */}
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {dietaryFilterConfig.map((filter) => {
          const isActive = activeDietary.includes(filter.key);
          const Icon = filter.icon;

          return (
            <motion.button
              key={filter.key}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => handleDietaryToggle(filter.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                isActive
                  ? `${filter.activeColor} border-transparent shadow-sm`
                  : `${filter.color} border-transparent hover:shadow-sm hover:scale-105`
              }`}
              aria-pressed={isActive}
            >
              <Icon className="size-3" />
              {t.menu[filter.key as keyof typeof t.menu] || filter.key}
            </motion.button>
          );
        })}
      </div>

      {/* ─── Allergen Exclusion Filters ─── */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 text-orange-500" />
          <h3 className="text-xs font-semibold text-muted-foreground">{t.menu.allergenFilterTitle}</h3>
          <span className="text-[10px] text-muted-foreground">— {t.menu.allergenFilterDesc}</span>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {allergenFilterConfig.map((filter) => {
            const isActive = allergenExclusions.includes(filter.key);
            return (
              <motion.button
                key={filter.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAllergenToggle(filter.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                  isActive
                    ? `${filter.activeColor} border-transparent`
                    : `${filter.color} border-transparent`
                }`}
                aria-pressed={isActive}
              >
                <span className="text-sm">{filter.emoji}</span>
                {t.menu[`allergen${filter.key.charAt(0).toUpperCase() + filter.key.slice(1)}` as keyof typeof t.menu] || filter.key}
              </motion.button>
            );
          })}
        </div>
        {/* Allergen filter active warning banner */}
        {allergenExclusions.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="size-3.5 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-400">{t.menu.allergenFilterActive}</p>
          </div>
        )}
      </div>

      {/* ─── Results Count ─── */}
      <div className="px-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t.menu.showing}{" "}
          <span className="font-semibold text-foreground">
            {totalFilteredItems}
          </span>{" "}
          {t.menu.items}
        </p>
        {(activeCategoryId || storeSearchQuery || activeDietary.length > 0 || sortOption !== "default" || showFavoritesOnly || allergenExclusions.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={handleClearFilters}
          >
            <FilterX className="size-3" />
            {t.menu.clearFilters}
          </Button>
        )}
      </div>

      {/* ─── Favorites Empty State ─── */}
      {showFavoritesOnly && totalFilteredItems === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Heart className="size-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t.menu.favorites}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            {t.menu.noFavorites}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowFavoritesOnly(false)}
          >
            {t.menu.clearFilters}
          </Button>
        </div>
      ) : null}

      {/* ─── Menu Items Grid ─── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border border-border/50 shadow-sm rounded-xl animate-pulse">
              <div className="h-36 bg-muted rounded-t-xl" />
              <CardContent className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="flex items-center justify-between mt-2">
                  <div className="h-5 w-16 bg-muted rounded" />
                  <div className="size-7 bg-muted rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : totalFilteredItems === 0 && !showFavoritesOnly ? (
        /* ─── Empty State ─── */
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <SearchX className="size-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t.menu.noResults}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            {t.common.noResults}
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleClearFilters}
          >
            <FilterX className="size-4" />
            {t.menu.clearFilters}
          </Button>
        </div>
      ) : !showFavoritesOnly || totalFilteredItems > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
          {filteredCategories.map((cat) =>
            cat.items.map((item, itemIdx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: itemIdx * 0.03, duration: 0.3 }}
              >
              <MenuCard
                item={item}
                categoryIcon={cat.icon}
                categoryGradient={categoryGradients[cat.icon] || defaultGradient}
                currency={currency}
                locale={locale}
                t={t}
                isAdded={addedItemId === item.id}
                isFavorite={favorites.includes(item.id)}
                onToggleFavorite={toggleFavorite}
                onOpenDetail={handleOpenDetail}
                onQuickAdd={handleQuickAdd}
              />
              </motion.div>
            ))
          )}
        </div>
      ) : null}

      {/* ─── Item Detail Sheet ─── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side={isMobile ? "bottom" : isRTL ? "left" : "right"}
          className={
            isMobile
              ? "h-[85vh] rounded-t-2xl"
              : "w-full sm:max-w-md"
          }
        >
          {detailItem && (
            <div className="flex flex-col h-full">
              <SheetHeader className="space-y-0 pb-0">
                <SheetTitle className="text-start text-lg">
                  {locale === "ar" ? detailItem.nameAr : detailItem.nameEn}
                </SheetTitle>
                <SheetDescription className="text-start text-sm">
                  {locale === "ar"
                    ? detailItem.descriptionAr
                    : detailItem.descriptionEn}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1 -mx-6 px-6 py-4">
                <div className="space-y-5">
                  {/* Food Image */}
                  <div className="relative h-40 rounded-xl overflow-hidden">
                    {detailItem.image ? (
                      <img
                        src={detailItem.image}
                        alt={locale === "ar" ? detailItem.nameAr : detailItem.nameEn}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${
                          categoryGradients[
                            categories.find((c) => c.id === detailItem.categoryId)
                              ?.icon || ""
                          ] || defaultGradient
                        } flex items-center justify-center rounded-xl`}
                      >
                        <span className="text-5xl drop-shadow-md">
                          {categories.find((c) => c.id === detailItem.categoryId)
                            ?.icon || "🍽️"}
                        </span>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                    {detailItem.isSpecial && (
                      <Badge className="absolute top-3 start-3 bg-white/90 text-amber-700 border-0 gap-1 z-10">
                        <Sparkles className="size-3" />
                        {t.menu.special}
                      </Badge>
                    )}
                    {detailItem.isPopular && (
                      <Badge className="absolute top-3 end-3 bg-white/90 text-amber-700 border-0 gap-1 z-10">
                        <Star className="size-3" />
                        {t.menu.popular}
                      </Badge>
                    )}
                  </div>

                  {/* Price, Calories, Prep Time */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xl font-bold text-primary">
                      {currency}
                      {detailItem.price.toFixed(2)}
                    </span>
                    {detailItem.calories > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Flame className="size-3" />
                        {detailItem.calories} {t.menu.calories}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Clock className="size-3" />
                      {detailItem.preparationTime} {t.menu.minutes}
                    </Badge>
                  </div>

                  {/* Dietary badges */}
                  {detailItem.dietary && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailItem.dietary
                        .split(",")
                        .filter(Boolean)
                        .map((d) => (
                          <span
                            key={d}
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              dietaryBadgeColors[d] ||
                              "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t.menu[d as keyof typeof t.menu] || d}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Allergens */}
                  {detailItem.allergens && (
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-semibold text-foreground">
                        {t.menu.allergens}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {detailItem.allergens
                          .split(",")
                          .filter(Boolean)
                          .map((a) => (
                            <Badge
                              key={a}
                              variant="outline"
                              className="text-xs text-destructive border-destructive/30"
                            >
                              {a.trim()}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Nutritional Information */}
                  <div
                    className="cursor-pointer group"
                    onClick={() => detailItem.calories > 0 && setNutritionalModalOpen(true)}
                    role={detailItem.calories > 0 ? "button" : undefined}
                    tabIndex={detailItem.calories > 0 ? 0 : undefined}
                  >
                    <NutritionalInfo
                      calories={detailItem.calories}
                      allergens={detailItem.allergens}
                      dietary={detailItem.dietary}
                    />
                    {detailItem.calories > 0 && (
                      <p className="text-[10px] text-muted-foreground text-center mt-2 group-hover:text-primary transition-colors">
                        {t.profile.nutritionalInfo} →
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Variants (Radio) */}
                  {variants.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        {t.menu.variants}
                      </h4>
                      <RadioGroup
                        value={selectedVariant || ""}
                        onValueChange={setSelectedVariant}
                        className="space-y-2"
                      >
                        {variants.map((variant) => (
                          <div
                            key={variant.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedVariant === variant.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => setSelectedVariant(variant.id)}
                          >
                            <RadioGroupItem
                              value={variant.id}
                              id={`variant-${variant.id}`}
                            />
                            <Label
                              htmlFor={`variant-${variant.id}`}
                              className="flex-1 cursor-pointer text-sm font-medium"
                            >
                              {locale === "ar"
                                ? variant.nameAr
                                : variant.nameEn}
                            </Label>
                            {variant.price > 0 && (
                              <span className="text-sm text-primary font-semibold">
                                +{currency}
                                {variant.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {/* Add-ons (Checkboxes) */}
                  {addons.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        {t.menu.addons}
                      </h4>
                      <div className="space-y-2">
                        {addons.map((addon) => (
                          <div
                            key={addon.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedAddons.includes(addon.id)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => handleToggleAddon(addon.id)}
                          >
                            <Checkbox
                              id={`addon-${addon.id}`}
                              checked={selectedAddons.includes(addon.id)}
                              onCheckedChange={() =>
                                handleToggleAddon(addon.id)
                              }
                            />
                            <Label
                              htmlFor={`addon-${addon.id}`}
                              className="flex-1 cursor-pointer text-sm font-medium"
                            >
                              {locale === "ar"
                                ? addon.nameAr
                                : addon.nameEn}
                            </Label>
                            {addon.price > 0 && (
                              <span className="text-sm text-primary font-semibold">
                                +{currency}
                                {addon.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Quantity */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t.menu.quantity}
                    </h4>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-full"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="text-xl font-bold w-10 text-center">
                        {quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-full"
                        onClick={() => setQuantity((q) => q + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t.menu.specialInstructions}
                    </h4>
                    <Textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder={t.menu.specialInstructionsPlaceholder}
                      className="resize-none h-20 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              </ScrollArea>

              {/* Footer with total and add to cart */}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t.menu.total}
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {currency}
                    {detailTotalPrice.toFixed(2)}
                  </span>
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleDetailAddToCart}
                  disabled={variants.length > 0 && !selectedVariant}
                >
                  <Plus className="size-4" />
                  {t.menu.addToCart}
                  {quantity > 1 && (
                    <Badge className="bg-white/20 text-white border-0 ms-1">
                      {quantity}
                    </Badge>
                  )}
                </Button>
                {variants.length > 0 && !selectedVariant && (
                  <p className="text-xs text-center text-muted-foreground">
                    {t.menu.selectVariant}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* QR Code Menu Dialog */}
      <QRCodeMenu open={qrCodeOpen} onOpenChange={setQrCodeOpen} />

      {/* Nutritional Info Modal */}
      {detailItem && (
        <NutritionalInfoModal
          open={nutritionalModalOpen}
          onOpenChange={setNutritionalModalOpen}
          itemName={locale === "ar" ? detailItem.nameAr : detailItem.nameEn}
          calories={detailItem.calories}
          allergens={detailItem.allergens}
          dietary={detailItem.dietary}
        />
      )}
    </div>
  );
}

/* ─── Menu Card Sub-component ─── */

interface MenuCardProps {
  item: MenuItem;
  categoryIcon: string;
  categoryGradient: string;
  currency: string;
  locale: string;
  t: Record<string, any>;
  isAdded: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem, e?: React.MouseEvent) => void;
}

function MenuCard({
  item,
  categoryIcon,
  categoryGradient,
  currency,
  locale,
  t,
  isAdded,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  onQuickAdd,
}: MenuCardProps) {
  const cart = useRestaurantStore((s) => s.cart);
  const dietaryList = item.dietary
    ? item.dietary.split(",").filter(Boolean)
    : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group overflow-hidden border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full flex flex-col rounded-xl gradient-border-hover"
        onClick={() => onOpenDetail(item)}
      >
        {/* Food Image with zoom-on-hover */}
        <div className="relative h-36 overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={locale === "ar" ? item.nameAr : item.nameEn}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${categoryGradient} flex items-center justify-center`}>
              <span className="text-4xl drop-shadow-md">{categoryIcon}</span>
            </div>
          )}
          {/* Gradient overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          {/* Badges overlay */}
          <div className="absolute top-2 start-2 flex flex-wrap gap-1 z-10">
            {item.isPopular && (
              <Badge className="bg-white/90 text-amber-700 border-0 text-[10px] font-bold gap-0.5">
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <Flame className="size-2.5" />
                </motion.span>
                {t.menu.popular}
              </Badge>
            )}
            {item.isSpecial && (
              <Badge className="bg-white/90 text-emerald-600 border-0 text-[10px] font-bold gap-0.5">
                <Sparkles className="size-2.5" />
                {t.menu.new}
              </Badge>
            )}
            {/* Featured badge for top popular items */}
            {item.isPopular && !item.isSpecial && (cart.findIndex(c => c.menuItemId === item.id) === -1) && (
              <Badge className="bg-amber-500 text-white border-0 text-[9px] font-black gap-0.5 shadow-sm shadow-amber-500/30">
                ★ {t.menu.featured || 'Featured'}
              </Badge>
            )}
          </div>

          {/* Favorite heart */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className="absolute top-2 end-2 z-10 size-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-black/60 hover:scale-110"
            aria-label={isFavorite ? t.menu.removedFromFavorites : t.menu.addedToFavorites}
          >
            <Heart
              className={`size-3.5 transition-all ${
                isFavorite ? "text-red-400 fill-red-400 scale-110" : "text-white/80"
              }`}
            />
          </button>

          {/* Prep time & calories */}
          <div className="absolute bottom-2 end-2 flex gap-1 z-10">
            {item.calories > 0 && (
              <Badge className="bg-black/40 text-white border-0 text-[9px] gap-0.5 backdrop-blur-sm">
                {item.calories} {t.menu.calories}
              </Badge>
            )}
            <Badge className="bg-black/40 text-white border-0 text-[10px] gap-1 backdrop-blur-sm">
              <Clock className="size-2.5" />
              {item.preparationTime} {t.menu.minutes}
            </Badge>
          </div>
        </div>

        <CardContent className="p-3 flex flex-col flex-1">
          {/* Name & Description */}
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-0.5">
            {locale === "ar" ? item.nameAr : item.nameEn}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {locale === "ar" ? item.descriptionAr : item.descriptionEn}
          </p>

          {/* Dietary badges */}
          {dietaryList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {dietaryList.slice(0, 3).map((d) => (
                <span
                  key={d}
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                    dietaryBadgeColors[d] || "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.menu[d as keyof typeof t.menu] || d}
                </span>
              ))}
              {dietaryList.length > 3 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  +{dietaryList.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Price & Add button */}
          <div className="mt-auto flex items-center justify-between gap-1">
            <span className="font-bold text-primary text-base whitespace-nowrap shrink-0">
              {currency}{item.price.toFixed(2)}
            </span>
            <motion.div
              animate={isAdded ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Button
                size="sm"
                variant={isAdded ? "default" : "outline"}
                className="h-8 gap-1.5 text-xs shrink-0 ripple-effect"
                onClick={(e) => onQuickAdd(item, e)}
                aria-label={`${t.menu.addToCart} ${
                  locale === "ar" ? item.nameAr : item.nameEn
                }`}
              >
                <Plus className="size-3.5" />
                {isAdded ? t.menu.added : t.menu.addToList}
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
