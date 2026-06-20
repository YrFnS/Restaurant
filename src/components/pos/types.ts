// Shared POS types & helpers — used across FloorPlan, MenuBrowser, OrderTicket, PaymentDialog

export type TableStatus =
  | "open"
  | "seated"
  | "ordered"
  | "served"
  | "paid"
  | "cleaning"
  | "reserved";

export type TableShape = "square" | "round";

export type TableSection = "main" | "patio" | "bar" | "private";

export interface RestaurantTable {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: TableStatus;
  shape: TableShape;
  x: number;
  y: number;
  width: number;
  height: number;
  serverName: string;
  seatedAt: string | null;
  orders?: {
    id: string;
    orderNumber: string;
    total: number;
    paymentStatus: string;
    status: string;
  }[];
}

export type OrderType = "dine_in" | "takeout" | "delivery";
export type PaymentMethod = "cash" | "card";

export interface PosModifier {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  preset?: string;
}

export interface PosOrderItem {
  id: string; // unique line id
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  price: number; // unit price including modifiers
  basePrice: number;
  quantity: number;
  image: string;
  modifiers: PosModifier[];
  notes: string;
  course: number;
  stationSlug: string;
  totalPrice: number;
  allergens?: string;
  dietary?: string;
}

export interface MenuCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  sortOrder: number;
  stationSlugs: string;
  items: MenuItem[];
}

export interface ModifierOption {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  isDefault: boolean;
  preset: string;
}

export interface ModifierGroup {
  id: string;
  nameEn: string;
  nameAr: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: ModifierOption[];
}

export interface MenuItem {
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
  isNew: boolean;
  preparationTime: number;
  calories: number;
  allergens: string;
  dietary: string;
  sortOrder: number;
  categoryId: string;
  modifierGroups: ModifierGroup[];
}

export interface RestaurantSettings {
  id: string;
  nameEn: string;
  nameAr: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  deliveryFee: number;
  minDeliveryOrder: number;
  avgPrepTimeMin: number;
  tipPresets: string;
}

// ─── Color coding for table statuses (warm saffron palette, NO blue) ───
export const TABLE_STATUS_COLORS: Record<
  TableStatus,
  { bg: string; border: string; text: string; ring: string; dot: string; label: string }
> = {
  open: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-800",
    text: "text-emerald-800 dark:text-emerald-300",
    ring: "ring-emerald-400",
    dot: "bg-emerald-500",
    label: "Open",
  },
  seated: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
    ring: "ring-amber-400",
    dot: "bg-amber-500",
    label: "Seated",
  },
  ordered: {
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-300 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-300",
    ring: "ring-orange-400",
    dot: "bg-orange-500",
    label: "Ordered",
  },
  served: {
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-300 dark:border-cyan-800",
    text: "text-cyan-800 dark:text-cyan-300",
    ring: "ring-cyan-400",
    dot: "bg-cyan-500",
    label: "Served",
  },
  paid: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-300 dark:border-teal-800",
    text: "text-teal-800 dark:text-teal-300",
    ring: "ring-teal-400",
    dot: "bg-teal-500",
    label: "Paid",
  },
  cleaning: {
    bg: "bg-stone-100 dark:bg-stone-900/60",
    border: "border-stone-300 dark:border-stone-700",
    text: "text-stone-700 dark:text-stone-300",
    ring: "ring-stone-400",
    dot: "bg-stone-500",
    label: "Cleaning",
  },
  reserved: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-800",
    text: "text-rose-800 dark:text-rose-300",
    ring: "ring-rose-400",
    dot: "bg-rose-500",
    label: "Reserved",
  },
};

export const SECTION_META: Record<
  string,
  { labelEn: string; labelAr: string; icon: string }
> = {
  main: { labelEn: "Main Hall", labelAr: "الصالة الرئيسية", icon: "🍽️" },
  patio: { labelEn: "Patio", labelAr: "الفناء", icon: "🌿" },
  bar: { labelEn: "Bar", labelAr: "البار", icon: "🍸" },
  private: { labelEn: "Private", labelAr: "خاص", icon: "✨" },
};

// ─── Money / tax helpers ───
export function posSubtotal(items: PosOrderItem[]): number {
  return items.reduce((sum, i) => sum + i.totalPrice, 0);
}

export function posTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

export function posTotal(
  subtotal: number,
  tax: number,
  deliveryFee: number,
  discount: number,
  tip: number
): number {
  return Math.max(0, subtotal + tax + deliveryFee - discount + tip);
}

// Generate a unique line id
export function lineId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
