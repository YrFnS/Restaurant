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

/* ── Unique Unsplash images per item ── */
const itemImages: Record<string, string> = {
  "Hummus Platter": "https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&h=400&fit=crop",
  "Falafel Bites": "https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=600&h=400&fit=crop",
  "Stuffed Grape Leaves": "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=600&h=400&fit=crop",
  "Crispy Samosas": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=400&fit=crop",
  "Chicken Wings": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=400&fit=crop",
  "Lentil Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop",
  "Chicken Soup": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop",
  "Seafood Chowder": "https://images.unsplash.com/photo-1594756202469-9ff9799b2e4e?w=600&h=400&fit=crop",
  "Mixed Grill Platter": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=400&fit=crop",
  "Lamb Kebab": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&h=400&fit=crop",
  "Chicken Shawarma": "https://images.unsplash.com/photo-1567121938596-3d6802e57f43?w=600&h=400&fit=crop",
  "Beef Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
  "Lamb Chops": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop",
  "Grilled Salmon": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop",
  "Shrimp Scampi": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
  "Fish Tacos": "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&h=400&fit=crop",
  "Truffle Mushroom Pasta": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=400&fit=crop",
  "Chicken Alfredo": "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&h=400&fit=crop",
  "Spaghetti Bolognese": "https://images.unsplash.com/photo-1622973536968-3ead9e780960?w=600&h=400&fit=crop",
  "Margherita Pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop",
  "Meat Lovers Pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop",
  "Vegetable Supreme": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=400&fit=crop",
  "Caesar Salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop",
  "Fattoush": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop",
  "Tabbouleh": "https://images.unsplash.com/photo-1534483509719-8127d8931b93?w=600&h=400&fit=crop",
  "Baklava": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&h=400&fit=crop",
  "Kunafa": "https://images.unsplash.com/photo-1579888944880-d98341245702?w=600&h=400&fit=crop",
  "Tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=400&fit=crop",
  "Chocolate Lava Cake": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&h=400&fit=crop",
  "Fresh Lemonade": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&h=400&fit=crop",
  "Mint Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=400&fit=crop",
  "Turkish Coffee": "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=400&fit=crop",
  "Mango Smoothie": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&h=400&fit=crop",
  "French Fries": "https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=600&h=400&fit=crop",
  "Rice Pilaf": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop",
  "Garlic Bread": "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&h=400&fit=crop",
  "Grilled Vegetables": "https://images.unsplash.com/photo-1506354666786-959d6d497f1a?w=600&h=400&fit=crop",
};

function resolveImage(item: MenuItem): string {
  return itemImages[item.nameEn] || item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop";
}

export function MenuCard({
  item, categoryIcon, categoryGradient, currency, locale, t,
  isAdded, isFavorite, onToggleFavorite, onOpenDetail, onQuickAdd,
}: MenuCardProps) {
  const cart = useRestaurantStore((s) => s.cart);
  const dietaryList = item.dietary ? item.dietary.split(",").filter(Boolean) : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card
        className="group overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer h-full flex flex-col rounded-2xl"
        onClick={() => onOpenDetail(item)}
      >
        {/* Food Image — large, editorial */}
        <div className="relative h-44 overflow-hidden">
          <img
            src={resolveImage(item)}
            alt={locale === "ar" ? item.nameAr : item.nameEn}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {item.isPopular && (
              <Badge className="bg-white/90 text-[#c75b39] border-0 text-[10px] font-semibold gap-0.5 rounded-full px-2 py-0.5">
                <Flame className="size-2.5" />
                {t.menu.popular}
              </Badge>
            )}
            {item.isSpecial && (
              <Badge className="bg-white/90 text-[#7a8b6f] border-0 text-[10px] font-semibold gap-0.5 rounded-full px-2 py-0.5">
                <Sparkles className="size-2.5" />
                {t.menu.new}
              </Badge>
            )}
          </div>

          {/* Favorite */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
            className="absolute top-3 right-3 z-10 size-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-black/50"
            aria-label={isFavorite ? t.menu.removedFromFavorites : t.menu.addedToFavorites}
          >
            <Heart className={`size-4 transition-all ${isFavorite ? "text-red-400 fill-red-400" : "text-white/80"}`} />
          </button>

          {/* Prep time */}
          <div className="absolute bottom-3 right-3 z-10">
            <Badge className="bg-black/40 text-white border-0 text-[10px] gap-1 backdrop-blur-sm rounded-full px-2 py-0.5">
              <Clock className="size-2.5" />
              {item.preparationTime}m
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">{locale === "ar" ? item.nameAr : item.nameEn}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{locale === "ar" ? item.descriptionAr : item.descriptionEn}</p>

          {dietaryList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {dietaryList.slice(0, 3).map((d) => (
                <span key={d} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${dietaryBadgeColors[d] || "bg-muted text-muted-foreground"}`}>
                  {t.menu[d as keyof typeof t.menu] || d}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="font-bold text-lg text-foreground">{currency}{item.price.toFixed(2)}</span>
            <motion.div animate={isAdded ? { scale: [1, 1.2, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
              <Button
                size="sm"
                variant={isAdded ? "default" : "outline"}
                className={`h-9 gap-1.5 text-xs rounded-full ${isAdded ? "bg-[#c75b39] hover:bg-[#c75b39]/90 text-white" : "border-[#c75b39]/30 text-[#c75b39] hover:bg-[#c75b39]/5"}`}
                onClick={(e) => onQuickAdd(item, e)}
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
