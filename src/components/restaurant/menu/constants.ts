import { ShieldCheck, Wheat, Zap, Leaf } from "lucide-react";

export const categoryGradients: Record<string, string> = {
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

export const defaultGradient = "from-amber-400/80 to-orange-500/80";

export const dietaryFilterConfig = [
  { key: "vegetarian", icon: Leaf, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", activeColor: "bg-green-500 text-white dark:bg-green-600" },
  { key: "vegan", icon: Leaf, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", activeColor: "bg-emerald-500 text-white dark:bg-emerald-600" },
  { key: "gluten-free", icon: Wheat, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeColor: "bg-amber-500 text-white dark:bg-amber-600" },
  { key: "halal", icon: ShieldCheck, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400", activeColor: "bg-teal-500 text-white dark:bg-teal-600" },
  { key: "spicy", icon: Zap, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", activeColor: "bg-red-500 text-white dark:bg-red-600" },
];

export const allergenFilterConfig = [
  { key: "nuts", emoji: "🥜", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", activeColor: "bg-orange-500 text-white dark:bg-orange-600" },
  { key: "dairy", emoji: "🥛", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", activeColor: "bg-sky-500 text-white dark:bg-sky-600" },
  { key: "gluten", emoji: "🌾", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", activeColor: "bg-amber-500 text-white dark:bg-amber-600" },
  { key: "shellfish", emoji: "🦐", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", activeColor: "bg-rose-500 text-white dark:bg-rose-600" },
  { key: "eggs", emoji: "🥚", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", activeColor: "bg-yellow-500 text-white dark:bg-yellow-600" },
  { key: "soy", emoji: "🫘", color: "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400", activeColor: "bg-lime-500 text-white dark:bg-lime-600" },
  { key: "fish", emoji: "🐟", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", activeColor: "bg-cyan-500 text-white dark:bg-cyan-600" },
];

export const dietaryBadgeColors: Record<string, string> = {
  vegetarian: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  vegan: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "gluten-free": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  halal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  spicy: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export type SortOption = "default" | "price-low" | "price-high" | "popular" | "prep-time";
