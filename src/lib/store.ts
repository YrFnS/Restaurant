"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveSection =
  | "home"
  | "menu"
  | "cart"
  | "reservations"
  | "orders"
  | "waitlist"
  | "rewards"
  | "contact";

export interface CartModifier {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  preset?: string;
}

export interface CartItem {
  id: string; // unique cart line id
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  price: number; // unit price including modifiers
  basePrice: number;
  quantity: number;
  image: string;
  modifiers: CartModifier[];
  notes: string;
  course: number;
  totalPrice: number;
  stationSlug?: string; // kitchen station routing
  categoryId?: string; // for station derivation
}

interface RestaurantState {
  // Navigation
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;

  // Cart
  cart: CartItem[];
  orderType: "dine_in" | "takeout" | "delivery";
  deliveryAddress: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  promoCode: string;
  promoDiscount: number;
  tipPercent: number;
  tipCustom: number;
  orderNotes: string;

  // Favorites
  favorites: string[];

  // Recent searches
  recentSearches: string[];

  // Non-sensitive staff display state. Authentication lives in an HTTP-only cookie.
  staffName: string | null;

  // Actions
  addToCart: (item: CartItem) => void;
  updateCartQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setOrderType: (t: "dine_in" | "takeout" | "delivery") => void;
  setDeliveryAddress: (a: string) => void;
  setTableNumber: (t: string) => void;
  setCustomerName: (n: string) => void;
  setCustomerPhone: (p: string) => void;
  setPromo: (code: string, discount: number) => void;
  clearPromo: () => void;
  setTip: (percent: number, custom?: number) => void;
  setOrderNotes: (n: string) => void;

  toggleFavorite: (id: string) => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;

  setStaff: (name: string) => void;
  clearStaff: () => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set) => ({
      activeSection: "home",
      setActiveSection: (section) => set({ activeSection: section }),

      cart: [],
      orderType: "dine_in",
      deliveryAddress: "",
      tableNumber: "",
      customerName: "",
      customerPhone: "",
      promoCode: "",
      promoDiscount: 0,
      tipPercent: 0,
      tipCustom: 0,
      orderNotes: "",

      favorites: [],
      recentSearches: [],

      staffName: null,

      addToCart: (item) =>
        set((s) => {
          // merge identical lines (same item + modifiers + notes)
          const existing = s.cart.find(
            (c) =>
              c.menuItemId === item.menuItemId &&
              c.notes === item.notes &&
              JSON.stringify(c.modifiers) === JSON.stringify(item.modifiers)
          );
          if (existing) {
            return {
              cart: s.cart.map((c) =>
                c.id === existing.id
                  ? { ...c, quantity: c.quantity + item.quantity, totalPrice: (c.quantity + item.quantity) * c.price }
                  : c
              ),
            };
          }
          return { cart: [...s.cart, item] };
        }),

      updateCartQty: (id, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((c) => c.id !== id)
              : s.cart.map((c) =>
                  c.id === id ? { ...c, quantity: qty, totalPrice: qty * c.price } : c
                ),
        })),

      removeFromCart: (id) =>
        set((s) => ({ cart: s.cart.filter((c) => c.id !== id) })),

      clearCart: () =>
        set({
          cart: [],
          promoCode: "",
          promoDiscount: 0,
          tipPercent: 0,
          tipCustom: 0,
          orderNotes: "",
          tableNumber: "",
          deliveryAddress: "",
        }),

      setOrderType: (t) => set({ orderType: t }),
      setDeliveryAddress: (a) => set({ deliveryAddress: a }),
      setTableNumber: (t) => set({ tableNumber: t }),
      setCustomerName: (n) => set({ customerName: n }),
      setCustomerPhone: (p) => set({ customerPhone: p }),
      setPromo: (code, discount) =>
        set({ promoCode: code, promoDiscount: discount }),
      clearPromo: () => set({ promoCode: "", promoDiscount: 0 }),
      setTip: (percent, custom = 0) =>
        set({ tipPercent: percent, tipCustom: custom }),
      setOrderNotes: (n) => set({ orderNotes: n }),

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),

      addRecentSearch: (q) =>
        set((s) => ({
          recentSearches: [
            q,
            ...s.recentSearches.filter((r) => r !== q),
          ].slice(0, 8),
        })),

      clearRecentSearches: () => set({ recentSearches: [] }),

      setStaff: (name) => set({ staffName: name }),
      clearStaff: () => set({ staffName: null }),
    }),
    {
      name: "rs-store",
      version: 1,
      migrate: (persistedState) => {
        const state = (persistedState || {}) as Record<string, unknown>;
        const { staffPin: _legacyStaffPin, staffName: _legacyStaffName, ...safeState } = state;
        return safeState as Partial<RestaurantState>;
      },
      partialize: (s) => ({
        cart: s.cart,
        orderType: s.orderType,
        favorites: s.favorites,
        recentSearches: s.recentSearches,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
      }),
    }
  )
);

// Cart helpers
export function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.totalPrice, 0);
}
