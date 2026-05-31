"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import {
  useRestaurantStore,
  type CartItem,
  type CartModifier,
} from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications } from "@/hooks/use-notifications";
import { QRCodeMenu } from "@/components/restaurant/QRCodeMenu";
import { NutritionalInfoModal } from "@/components/restaurant/NutritionalInfoModal";
import { MenuFilters } from "./menu/MenuFilters";
import { MenuGrid } from "./menu/MenuGrid";
import { ItemDetailSheet } from "./menu/ItemDetailSheet";
import type { MenuItem, MenuCategory } from "./menu/types";
import type { SortOption } from "./menu/constants";

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
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

  // Handlers
  const handleCategoryClick = useCallback(
    (categoryId: string | null) => {
      setActiveCategoryId(categoryId);
      setSelectedCategoryId(categoryId);
    },
    [setSelectedCategoryId]
  );

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

  const handleAllergenToggle = useCallback((key: string) => {
    setAllergenExclusions((prev) =>
      prev.includes(key)
        ? prev.filter((a) => a !== key)
        : [...prev, key]
    );
  }, []);

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

  const handleToggleFavorites = useCallback(() => {
    setShowFavoritesOnly((prev) => !prev);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setSearchFocused(false), 200);
  }, []);

  const handleSortChange = useCallback((value: SortOption) => {
    setSortOption(value);
  }, []);

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
    requestAnimationFrame(() => {
      setDetailOpen(true);
    });
  }, []);

  // Close detail
  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailItem(null);
    }
  }, []);

  // Detail: add to cart
  const handleDetailAddToCart = useCallback(
    (item: MenuItem, selectedVariant: string | null, selectedAddons: string[], quantity: number, specialInstructions: string) => {
      const modifiers: CartModifier[] = [];

      if (selectedVariant) {
        const variant = item.modifiers.find(
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
        const addon = item.modifiers.find(
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

      const unitPrice = item.price + modifiers.reduce((sum, m) => sum + m.price, 0);

      const cartItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        price: unitPrice,
        quantity,
        image: item.image,
        modifiers,
        notes: specialInstructions,
        totalPrice: unitPrice * quantity,
      };

      addToCart(cartItem);
      notifications.cartAdded(locale === "ar" ? item.nameAr : item.nameEn);
      setDetailOpen(false);
      setDetailItem(null);
      setAddedItemId(item.id);
      setTimeout(() => setAddedItemId(null), 600);
    },
    [addToCart, notifications, locale]
  );

  // Filter & sort items
  const filteredCategories = useMemo(() => {
    const searchLower = storeSearchQuery.toLowerCase().trim();

    const filtered = categories
      .map((cat) => {
        if (activeCategoryId && cat.id !== activeCategoryId) return null;

        let filteredItems = cat.items.filter((item) => {
          if (searchLower) {
            const matchesSearch =
              item.nameEn.toLowerCase().includes(searchLower) ||
              item.nameAr.includes(storeSearchQuery) ||
              item.descriptionEn.toLowerCase().includes(searchLower) ||
              item.descriptionAr.includes(storeSearchQuery);
            if (!matchesSearch) return false;
          }

          if (activeDietary.length > 0) {
            const itemDietary = item.dietary
              ? item.dietary.split(",").filter(Boolean)
              : [];
            const matchesAll = activeDietary.every((d) =>
              itemDietary.includes(d)
            );
            if (!matchesAll) return false;
          }

          if (showFavoritesOnly && !favorites.includes(item.id)) return false;

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

  const totalFilteredItems = filteredCategories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  );

  const hasActiveFilters = !!(activeCategoryId || storeSearchQuery || activeDietary.length > 0 || sortOption !== "default" || showFavoritesOnly || allergenExclusions.length > 0);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const settings = useRestaurantStore((s) => s.settings);
  const currency = settings?.currencySymbol ?? "";

  return (
    <div className="pb-4 space-y-4">
      <MenuFilters
        t={t}
        locale={locale}
        categories={categories}
        activeCategoryId={activeCategoryId}
        localSearch={localSearch}
        sortOption={sortOption}
        activeDietary={activeDietary}
        allergenExclusions={allergenExclusions}
        showFavoritesOnly={showFavoritesOnly}
        favoritesCount={favorites.length}
        totalFilteredItems={totalFilteredItems}
        hasActiveFilters={hasActiveFilters}
        recentSearches={recentSearches}
        searchFocused={searchFocused}
        onCategoryClick={handleCategoryClick}
        onSearchChange={handleSearchChange}
        onSearchFocus={handleSearchFocus}
        onSearchBlur={handleSearchBlur}
        onSortChange={handleSortChange}
        onDietaryToggle={handleDietaryToggle}
        onAllergenToggle={handleAllergenToggle}
        onToggleFavorites={handleToggleFavorites}
        onClearFilters={handleClearFilters}
        onClearRecentSearches={clearRecentSearches}
        onRemoveRecentSearch={removeRecentSearch}
        onQrCodeOpen={() => setQrCodeOpen(true)}
      />

      <MenuGrid
        loading={loading}
        showFavoritesOnly={showFavoritesOnly}
        totalFilteredItems={totalFilteredItems}
        filteredCategories={filteredCategories}
        addedItemId={addedItemId}
        currency={currency}
        locale={locale}
        t={t}
        onOpenDetail={handleOpenDetail}
        onQuickAdd={handleQuickAdd}
        onClearFilters={handleClearFilters}
        onToggleFavoritesOff={() => setShowFavoritesOnly(false)}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
      />

      <ItemDetailSheet
        item={detailItem}
        open={detailOpen}
        locale={locale}
        t={t}
        currency={currency}
        categories={categories}
        isRTL={isRTL}
        isMobile={isMobile}
        onOpenChange={handleDetailOpenChange}
        onAddToCart={handleDetailAddToCart}
        onOpenNutritionalModal={() => setNutritionalModalOpen(true)}
        hasCalories={!!(detailItem && detailItem.calories > 0)}
      />

      <QRCodeMenu open={qrCodeOpen} onOpenChange={setQrCodeOpen} />

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
