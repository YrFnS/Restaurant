"use client";

import React from "react";
import { motion } from "framer-motion";
import { SearchX, FilterX, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MenuCard } from "./MenuCard";
import { categoryGradients, defaultGradient } from "./constants";
import type { MenuItem, MenuCategory } from "./types";

interface MenuGridProps {
  loading: boolean;
  showFavoritesOnly: boolean;
  totalFilteredItems: number;
  filteredCategories: MenuCategory[];
  addedItemId: string | null;
  currency: string;
  locale: string;
  t: Record<string, any>;
  onOpenDetail: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem, e?: React.MouseEvent) => void;
  onClearFilters: () => void;
  onToggleFavoritesOff: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

export function MenuGrid({
  loading,
  showFavoritesOnly,
  totalFilteredItems,
  filteredCategories,
  addedItemId,
  currency,
  locale,
  t,
  onOpenDetail,
  onQuickAdd,
  onClearFilters,
  onToggleFavoritesOff,
  isFavorite,
  onToggleFavorite,
}: MenuGridProps) {
  if (loading) {
    return (
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
    );
  }

  // Favorites empty state
  if (showFavoritesOnly && totalFilteredItems === 0) {
    return (
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
          onClick={onToggleFavoritesOff}
        >
          {t.menu.clearFilters}
        </Button>
      </div>
    );
  }

  // General empty state
  if (totalFilteredItems === 0 && !showFavoritesOnly) {
    return (
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
          onClick={onClearFilters}
        >
          <FilterX className="size-4" />
          {t.menu.clearFilters}
        </Button>
      </div>
    );
  }

  // Grid of items
  if (!showFavoritesOnly || totalFilteredItems > 0) {
    return (
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
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={onToggleFavorite}
                onOpenDetail={onOpenDetail}
                onQuickAdd={onQuickAdd}
              />
            </motion.div>
          ))
        )}
      </div>
    );
  }

  return null;
}
