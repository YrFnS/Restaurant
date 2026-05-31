"use client";

import React from "react";
import { motion } from "framer-motion";
import { Flame, Clock, Sparkles, Heart, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestaurantStore } from "@/lib/store";
import { dietaryBadgeColors } from "./constants";
import type { MenuItem } from "./types";

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

export function MenuCard({
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
