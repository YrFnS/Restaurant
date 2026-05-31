"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Plus, Minus, Sparkles, Star, Clock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { categoryGradients, defaultGradient, dietaryBadgeColors } from "./constants";
import { NutritionalInfo } from "@/components/restaurant/NutritionalInfo";
import type { MenuItem, MenuCategory } from "./types";

interface ItemDetailSheetProps {
  item: MenuItem | null;
  open: boolean;
  locale: string;
  t: Record<string, any>;
  currency: string;
  categories: MenuCategory[];
  isRTL: boolean;
  isMobile: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: MenuItem, selectedVariant: string | null, selectedAddons: string[], quantity: number, specialInstructions: string) => void;
  onOpenNutritionalModal: () => void;
  hasCalories: boolean;
}

export function ItemDetailSheet({
  item,
  open,
  locale,
  t,
  currency,
  categories,
  isRTL,
  isMobile,
  onOpenChange,
  onAddToCart,
  onOpenNutritionalModal,
  hasCalories,
}: ItemDetailSheetProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSelectedVariant(null);
      setSelectedAddons([]);
      setQuantity(1);
      setSpecialInstructions("");
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Separate modifiers
  const variants = useMemo(
    () => item?.modifiers.filter((m) => m.type === "variant") || [],
    [item]
  );
  const addons = useMemo(
    () => item?.modifiers.filter((m) => m.type === "addon") || [],
    [item]
  );

  // Compute total price
  const detailTotalPrice = useMemo(() => {
    if (!item) return 0;
    let total = item.price;

    if (selectedVariant) {
      const variant = item.modifiers.find(
        (m) => m.id === selectedVariant && m.type === "variant"
      );
      if (variant) total += variant.price;
    }

    selectedAddons.forEach((addonId) => {
      const addon = item.modifiers.find(
        (m) => m.id === addonId && m.type === "addon"
      );
      if (addon) total += addon.price;
    });

    return total * quantity;
  }, [item, selectedVariant, selectedAddons, quantity]);

  const handleToggleAddon = useCallback((addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!item) return;
    onAddToCart(item, selectedVariant, selectedAddons, quantity, specialInstructions);
  }, [item, selectedVariant, selectedAddons, quantity, specialInstructions, onAddToCart]);

  const categoryIcon = item
    ? categories.find((c) => c.id === item.categoryId)?.icon || ""
    : "";

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : isRTL ? "left" : "right"}
        className={
          isMobile
            ? "h-[85vh] rounded-t-2xl"
            : "w-full sm:max-w-md"
        }
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="space-y-0 pb-0">
            <SheetTitle className="text-start text-lg">
              {locale === "ar" ? item.nameAr : item.nameEn}
            </SheetTitle>
            <SheetDescription className="text-start text-sm">
              {locale === "ar"
                ? item.descriptionAr
                : item.descriptionEn}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6 py-4">
            <div className="space-y-5">
              {/* Food Image */}
              <div className="relative h-40 rounded-xl overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={locale === "ar" ? item.nameAr : item.nameEn}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${
                      categoryGradients[categoryIcon] || defaultGradient
                    } flex items-center justify-center rounded-xl`}
                  >
                    <span className="text-5xl drop-shadow-md">
                      {categoryIcon || "🍽️"}
                    </span>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
                {item.isSpecial && (
                  <Badge className="absolute top-3 start-3 bg-white/90 text-amber-700 border-0 gap-1 z-10">
                    <Sparkles className="size-3" />
                    {t.menu.special}
                  </Badge>
                )}
                {item.isPopular && (
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
                  {item.price.toFixed(2)}
                </span>
                {item.calories > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Flame className="size-3" />
                    {item.calories} {t.menu.calories}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs gap-1">
                  <Clock className="size-3" />
                  {item.preparationTime} {t.menu.minutes}
                </Badge>
              </div>

              {/* Dietary badges */}
              {item.dietary && (
                <div className="flex flex-wrap gap-1.5">
                  {item.dietary
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
              {item.allergens && (
                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t.menu.allergens}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.allergens
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
                onClick={() => hasCalories && onOpenNutritionalModal()}
                role={hasCalories ? "button" : undefined}
                tabIndex={hasCalories ? 0 : undefined}
              >
                <NutritionalInfo
                  calories={item.calories}
                  allergens={item.allergens}
                  dietary={item.dietary}
                />
                {hasCalories && (
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
              onClick={handleAddToCart}
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
      </SheetContent>
    </Sheet>
  );
}
