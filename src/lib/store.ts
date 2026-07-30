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

function purgeLegacyPersistedStaffCredentials() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem("rs-store");
    if (!raw) return;

    const persisted = JSON.parse(raw) as {
      state?: Record<string, unknown>;
      version?: number;
    };
    if (!persisted.state) return;

    const hadSensitiveState =
      Object.prototype.hasOwnProperty.call(persisted.state, "staffPin") ||
      Object.prototype.hasOwnProperty.call(persisted.state, "staffName");

    if (hadSensitiveState) {
      delete persisted.state.staffPin;
      delete persisted.state.staffName;
      window.localStorage.setItem("rs-store", JSON.stringify(persisted));
    }
  } catch {
    // Corrupt persisted state should not block the application from loading.
    window.localStorage.removeItem("rs-store");
  }
}

purgeLegacyPersistedStaffCredentials();

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
        set((state) => {
          // merge identical lines (same item + modifiers + notes)
          const existing = state.cart.find(
            (cartItem) =>
              cartItem.menuItemId === item.menuItemId &&
              cartItem.notes === item.notes &&
              JSON.stringify(cartItem.modifiers) === JSON.stringify(item.modifiers)
          );
          if (existing) {
            return {
              cart: state.cart.map((cartItem) =>
                cartItem.id === existing.id
                  ? {
                      ...cartItem,
                      quantity: cartItem.quantity + item.quantity,
                      totalPrice: (cartItem.quantity + item.quantity) * cartItem.price,
                    }
                  : cartItem
              ),
            };
          }
          return { cart: [...state.cart, item] };
        }),

      updateCartQty: (id, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((cartItem) => cartItem.id !== id)
              : state.cart.map((cartItem) =>
                  cartItem.id === id
                    ? { ...cartItem, quantity: qty, totalPrice: qty * cartItem.price }
                    : cartItem
                ),
        })),

      removeFromCart: (id) =>
        set((state) => ({ cart: state.cart.filter((cartItem) => cartItem.id !== id) })),

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

      setOrderType: (orderType) => set({ orderType }),
      setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
      setTableNumber: (tableNumber) => set({ tableNumber }),
      setCustomerName: (customerName) => set({ customerName }),
      setCustomerPhone: (customerPhone) => set({ customerPhone }),
      setPromo: (promoCode, promoDiscount) => set({ promoCode, promoDiscount }),
      clearPromo: () => set({ promoCode: "", promoDiscount: 0 }),
      setTip: (tipPercent, tipCustom = 0) => set({ tipPercent, tipCustom }),
      setOrderNotes: (orderNotes) => set({ orderNotes }),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favorite) => favorite !== id)
            : [...state.favorites, id],
        })),

      addRecentSearch: (query) =>
        set((state) => ({
          recentSearches: [
            query,
            ...state.recentSearches.filter((recent) => recent !== query),
          ].slice(0, 8),
        })),

      clearRecentSearches: () => set({ recentSearches: [] }),

      setStaff: (staffName) => set({ staffName }),
      clearStaff: () => set({ staffName: null }),
    }),
    {
      name: "rs-store",
      partialize: (state) => ({
        cart: state.cart,
        orderType: state.orderType,
        favorites: state.favorites,
        recentSearches: state.recentSearches,
        customerName: state.customerName,
        customerPhone: state.customerPhone,
      }),
    }
  )
);

// Cart helpers
export function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.totalPrice, 0);
}
