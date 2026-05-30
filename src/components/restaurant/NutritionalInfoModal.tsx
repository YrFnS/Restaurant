"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Beef,
  Wheat,
  Droplets,
  Leaf,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

interface NutritionalInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  calories: number;
  allergens: string;
  dietary: string;
  servingSize?: string;
}

// Generate reasonable nutritional values based on calories
function generateNutrition(calories: number) {
  const protein = Math.round((calories * 0.25) / 4);
  const carbs = Math.round((calories * 0.45) / 4);
  const fat = Math.round((calories * 0.30) / 9);
  const fiber = Math.round(Math.max(1, calories / 150));
  const sugar = Math.round(Math.max(1, calories * 0.1 / 4));
  const sodium = Math.round(Math.max(50, calories * 1.5));
  const cholesterol = Math.round(Math.max(5, calories * 0.08));
  return { protein, carbs, fat, fiber, sugar, sodium, cholesterol };
}

// Daily value percentages (based on 2000 cal diet)
const dailyValues: Record<string, { dv: number; unit: string }> = {
  protein: { dv: 50, unit: "g" },
  carbs: { dv: 300, unit: "g" },
  fat: { dv: 65, unit: "g" },
  fiber: { dv: 25, unit: "g" },
  sugar: { dv: 50, unit: "g" },
  sodium: { dv: 2300, unit: "mg" },
  cholesterol: { dv: 300, unit: "mg" },
};

const allergenIcons: Record<string, string> = {
  nuts: "🥜",
  dairy: "🥛",
  gluten: "🌾",
  shellfish: "🦐",
  eggs: "🥚",
  soy: "🫘",
  fish: "🐟",
};

const dietaryConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  vegetarian: { icon: Leaf, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
  vegan: { icon: Leaf, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  "gluten-free": { icon: Wheat, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  halal: { icon: ShieldCheck, color: "text-teal-600 dark:text-teal-400", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  spicy: { icon: Zap, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

export function NutritionalInfoModal({
  open,
  onOpenChange,
  itemName,
  calories,
  allergens,
  dietary,
  servingSize,
}: NutritionalInfoModalProps) {
  const { t } = useI18n();

  const nutrition = useMemo(() => generateNutrition(calories), [calories]);
  const allergenList = useMemo(
    () => allergens ? allergens.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) : [],
    [allergens]
  );
  const dietaryList = useMemo(
    () => dietary ? dietary.split(",").map((d) => d.trim()).filter(Boolean) : [],
    [dietary]
  );

  const nutritionItems = [
    { key: "calories", label: t.menu.calories, value: calories, dv: 2000, icon: Flame, color: "text-orange-500", bg: "bg-orange-500" },
    { key: "protein", label: t.menu.protein, value: nutrition.protein, dv: dailyValues.protein.dv, icon: Beef, color: "text-red-500", bg: "bg-red-500" },
    { key: "carbs", label: t.menu.carbs, value: nutrition.carbs, dv: dailyValues.carbs.dv, icon: Wheat, color: "text-amber-500", bg: "bg-amber-500" },
    { key: "fat", label: t.menu.fat, value: nutrition.fat, dv: dailyValues.fat.dv, icon: Droplets, color: "text-yellow-500", bg: "bg-yellow-500" },
    { key: "fiber", label: t.menu.fiber, value: nutrition.fiber, dv: dailyValues.fiber.dv, icon: Leaf, color: "text-green-500", bg: "bg-green-500" },
  ];

  const barChartData = [
    { key: "fat", label: t.menu.fat, value: nutrition.fat, max: dailyValues.fat.dv, color: "bg-yellow-500" },
    { key: "protein", label: t.menu.protein, value: nutrition.protein, max: dailyValues.protein.dv, color: "bg-red-500" },
    { key: "carbs", label: t.menu.carbs, value: nutrition.carbs, max: dailyValues.carbs.dv, color: "bg-amber-500" },
  ];

  if (calories <= 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="size-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Info className="size-3.5 text-white" />
            </div>
            {t.profile.nutritionalInfo}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {itemName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Calorie Breakdown - Visual Bar Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{t.profile.calorieBreakdown}</h4>
              <span className="text-2xl font-black text-primary">{calories} <span className="text-xs font-normal text-muted-foreground">{t.menu.calories}</span></span>
            </div>

            {/* Visual stacked calorie bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-muted">
              {barChartData.map((item) => {
                const totalMacro = barChartData.reduce((s, b) => s + b.value, 0);
                const widthPercent = totalMacro > 0 ? (item.value / totalMacro) * 100 : 0;
                return (
                  <div
                    key={item.key}
                    className={`${item.color} transition-all duration-700`}
                    style={{ width: `${Math.max(widthPercent, 2)}%` }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 justify-center">
              {barChartData.map((item) => (
                <div key={item.key} className="flex items-center gap-1.5 text-xs">
                  <span className={`size-2.5 rounded-full ${item.color}`} />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold">{item.value}g</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Serving Size */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t.profile.servingSize}</span>
            </div>
            <span className="text-sm font-medium">{servingSize || t.profile.servingDefault}</span>
          </div>

          <Separator />

          {/* Detailed Nutrition Table */}
          <div className="space-y-2.5">
            {nutritionItems.map((item) => {
              const Icon = item.icon;
              const dvPercent = Math.round((item.value / item.dv) * 100);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`size-3.5 ${item.color}`} />
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">
                        {item.value}{item.key === "calories" ? "" : "g"}
                      </span>
                      {item.key !== "calories" && (
                        <span className="text-[10px] text-muted-foreground w-8 text-end">
                          {dvPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(dvPercent, 100)}%` }}
                      transition={{ duration: 0.7, delay: 0.1 }}
                      className={`h-full ${item.bg} rounded-full`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-end">
            {t.menu.dailyValue}
          </p>

          {/* Allergen Warnings */}
          {allergenList.length > 0 && (
            <>
              <Separator />
              <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <h4 className="text-sm font-bold text-destructive">
                    {t.menu.allergenWarning}
                  </h4>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t.menu.allergenWarningDesc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allergenList.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className="text-xs text-destructive border-destructive/40 bg-destructive/10 gap-1"
                    >
                      <span>{allergenIcons[a] || "⚠️"}</span>
                      {t.menu[`allergen${a.charAt(0).toUpperCase() + a.slice(1)}` as keyof typeof t.menu] || a}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Dietary Labels */}
          {dietaryList.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t.menu.dietary}</h4>
                <div className="flex flex-wrap gap-2">
                  {dietaryList.map((d) => {
                    const config = dietaryConfig[d];
                    const Icon = config?.icon;
                    return (
                      <div
                        key={d}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                          config ? `${config.bgColor} ${config.color}` : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {Icon && <Icon className="size-3" />}
                        {t.menu[d as keyof typeof t.menu] || d}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
