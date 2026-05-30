"use client";

import React, { useMemo } from "react";
import { Flame, Beef, Wheat, Droplets, Leaf, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

interface NutritionalInfoProps {
  calories: number;
  allergens: string;
  dietary: string;
}

// Generate reasonable nutritional values based on calories
function generateNutrition(calories: number) {
  const protein = Math.round((calories * 0.25) / 4); // ~25% of cals from protein
  const carbs = Math.round((calories * 0.45) / 4); // ~45% from carbs
  const fat = Math.round((calories * 0.30) / 9); // ~30% from fat
  const fiber = Math.round(Math.max(1, calories / 150)); // rough fiber estimate
  return { protein, carbs, fat, fiber };
}

// Daily value percentages (based on 2000 cal diet)
const dailyValues: Record<string, { dv: number; unit: string }> = {
  protein: { dv: 50, unit: "g" },
  carbs: { dv: 300, unit: "g" },
  fat: { dv: 65, unit: "g" },
  fiber: { dv: 25, unit: "g" },
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

export function NutritionalInfo({ calories, allergens, dietary }: NutritionalInfoProps) {
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
    { key: "calories" as const, label: t.menu.calories, value: calories, dv: 2000, icon: Flame, color: "text-orange-500", bg: "bg-orange-500" },
    { key: "protein" as const, label: t.menu.protein, value: nutrition.protein, dv: dailyValues.protein.dv, icon: Beef, color: "text-red-500", bg: "bg-red-500" },
    { key: "carbs" as const, label: t.menu.carbs, value: nutrition.carbs, dv: dailyValues.carbs.dv, icon: Wheat, color: "text-amber-500", bg: "bg-amber-500" },
    { key: "fat" as const, label: t.menu.fat, value: nutrition.fat, dv: dailyValues.fat.dv, icon: Droplets, color: "text-yellow-500", bg: "bg-yellow-500" },
    { key: "fiber" as const, label: t.menu.fiber, value: nutrition.fiber, dv: dailyValues.fiber.dv, icon: Leaf, color: "text-green-500", bg: "bg-green-500" },
  ];

  if (calories <= 0) return null;

  return (
    <div className="space-y-3">
      {/* Nutrition Facts Header - styled like real nutrition label */}
      <div className="border-2 border-foreground rounded-lg overflow-hidden">
        <div className="bg-foreground text-background px-3 py-2">
          <h4 className="text-sm font-black uppercase tracking-wider">
            {t.menu.nutritionFacts}
          </h4>
        </div>
        <div className="px-3 py-2 space-y-2">
          {/* Serving info */}
          <div className="flex items-baseline justify-between border-b border-foreground/20 pb-1.5">
            <span className="text-xs font-bold uppercase">{t.menu.calories}</span>
            <span className="text-lg font-black">{calories}</span>
          </div>
          <p className="text-[10px] text-muted-foreground text-end">
            {t.menu.dailyValue}
          </p>

          {/* Nutrition bars */}
          <div className="space-y-2.5">
            {nutritionItems.map((item) => {
              const Icon = item.icon;
              const dvPercent = Math.round((item.value / item.dv) * 100);
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`size-3.5 ${item.color}`} />
                      <span className="text-xs font-semibold">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold">
                        {item.value}{item.key === "calories" ? "" : "g"}
                      </span>
                      {item.key !== "calories" && (
                        <span className="text-xs text-muted-foreground">
                          {dvPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.bg} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(dvPercent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Allergen Warning Section */}
      {allergenList.length > 0 && (
        <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h4 className="text-sm font-bold text-destructive">
              {t.menu.allergenWarning}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
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
      )}

      {/* Dietary badges */}
      {dietaryList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dietaryList.map((d) => (
            <Badge
              key={d}
              variant="secondary"
              className="text-xs gap-1"
            >
              {t.menu[d as keyof typeof t.menu] || d}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
