// Shared types for the KDS frontend

export interface KdsModifierOption {
  id: string;
  nameEn: string;
  nameAr: string;
  price?: number;
  preset?: string;
}

export interface KdsMenuItem {
  id: string;
  nameEn: string;
  nameAr: string;
  allergens?: string;
  dietary?: string;
}

export interface KdsOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: KdsMenuItem;
  quantity: number;
  unitPrice: number;
  modifiers: string; // JSON string of KdsModifierOption[]
  notes: string | null;
  totalPrice: number;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  stationSlug: string;
  course: number;
  hold: boolean;
  firedAt: string | null;
  readyAt: string | null;
  seatNumber?: number | null;
}

export interface KdsTable {
  id: string;
  number: number;
  section: string;
}

export interface KdsOrder {
  id: string;
  orderNumber: string;
  type: "dine_in" | "takeout" | "delivery";
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  customerName: string;
  customerPhone: string;
  notes: string | null;
  serverName: string;
  tableId: string | null;
  table: KdsTable | null;
  items: KdsOrderItem[];
  estimatedReady: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KdsAllDayItem {
  nameEn: string;
  nameAr: string;
  count: number;
}

export interface KdsKitchenResponse {
  orders: KdsOrder[];
  allDay: KdsAllDayItem[];
}

export interface KdsStation {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  targetPrepMin: number;
  isActive: boolean;
}

export interface KdsScreen {
  id: string;
  name: string;
  slug: string;
  description: string;
  stationFilter: string;
  screenType: "prep" | "expo" | "all";
  layoutType: "grid" | "compact";
  autoRefreshSec: number;
  showCompleted: boolean;
  maxOrders: number;
  isActive: boolean;
}

export interface KdsScreenResponse {
  screen: KdsScreen | null;
  stations: KdsStation[];
}

export interface KdsSettings {
  id: string;
  nameEn: string;
  nameAr: string;
  currency: string;
  currencySymbol: string;
  kdsGreenMin: number;
  kdsYellowMin: number;
  kdsRedMin: number;
  soundOnNewTicket: boolean;
  avgPrepTimeMin: number;
}

// Ticket age bucket — drives border/background color
export type AgeBucket = "fresh" | "warning" | "urgent" | "overdue";

export function getAgeBucket(elapsedMin: number, settings: KdsSettings): AgeBucket {
  if (elapsedMin >= settings.kdsRedMin) return "overdue";
  if (elapsedMin >= settings.kdsYellowMin) return "urgent";
  if (elapsedMin >= settings.kdsGreenMin) return "warning";
  return "fresh";
}
