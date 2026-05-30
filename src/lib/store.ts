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
  type: "addon" | "variant";
}

export interface CartItem {
  id: string; // unique cart item id
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  price: number;
  quantity: number;
  image: string;
  modifiers: CartModifier[];
  notes: string;
  totalPrice: number;
}

export interface RestaurantSettings {
  id: string;
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  descriptionEn: string;
  descriptionAr: string;
  phone: string;
  email: string;
  addressEn: string;
  addressAr: string;
  latitude: number;
  longitude: number;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  deliveryFee: number;
  minDeliveryOrder: number;
  deliveryRadius: number;
  avgPrepTime: number;
  tipPresets: string;
  openTime: string;
  closeTime: string;
  logoUrl: string;
  heroImageUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  giftCardAmounts: string;
  statsOrdersServed: number;
  statsHappyCustomers: number;
  statsYearsService: number;
}

interface RestaurantState {
  // Navigation
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;

  // Cart
  cart: CartItem[];
  orderType: "dine_in" | "takeout" | "delivery";
  deliveryAddress: string;
  orderNotes: string;
  tipAmount: number;
  promoCode: string;
  promoDiscount: number;

  addToCart: (item: CartItem) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartItemQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setOrderType: (type: "dine_in" | "takeout" | "delivery") => void;
  setDeliveryAddress: (address: string) => void;
  setOrderNotes: (notes: string) => void;
  setTipAmount: (amount: number) => void;
  setPromoCode: (code: string) => void;
  setPromoDiscount: (discount: number) => void;

  // Table number for dine-in
  tableNumber: string;
  setTableNumber: (number: string) => void;

  // Customer
  customerPhone: string;
  customerName: string;
  setCustomerPhone: (phone: string) => void;
  setCustomerName: (name: string) => void;

  // Menu filters
  selectedCategoryId: string | null;
  searchQuery: string;
  dietaryFilters: string[];
  setSelectedCategoryId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setDietaryFilters: (filters: string[]) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (menuItemId: string) => void;
  isFavorite: (menuItemId: string) => boolean;

  // Settings
  settings: RestaurantSettings | null;
  settingsLoaded: boolean;
  fetchSettings: () => Promise<void>;

  // UI
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Last placed order
  lastOrderNumber: string | null;
  setLastOrderNumber: (number: string | null) => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  persist(
    (set, get) => ({
      // Navigation
      activeSection: "home",
      setActiveSection: (section) => set({ activeSection: section }),

      // Cart
      cart: [],
      orderType: "takeout",
      deliveryAddress: "",
      orderNotes: "",
      tipAmount: 0,
      promoCode: "",
      promoDiscount: 0,

      addToCart: (item) =>
        set((state) => {
          const existingIndex = state.cart.findIndex(
            (ci) =>
              ci.menuItemId === item.menuItemId &&
              JSON.stringify(ci.modifiers) === JSON.stringify(item.modifiers) &&
              ci.notes === item.notes
          );
          if (existingIndex >= 0) {
            const newCart = [...state.cart];
            newCart[existingIndex] = {
              ...newCart[existingIndex],
              quantity: newCart[existingIndex].quantity + item.quantity,
              totalPrice:
                (newCart[existingIndex].quantity + item.quantity) *
                newCart[existingIndex].price,
            };
            return { cart: newCart };
          }
          return { cart: [...state.cart, item] };
        }),

      removeFromCart: (cartItemId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== cartItemId),
        })),

      updateCartItemQuantity: (cartItemId, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === cartItemId
              ? { ...item, quantity, totalPrice: quantity * item.price }
              : item
          ),
        })),

      clearCart: () =>
        set({
          cart: [],
          orderNotes: "",
          tipAmount: 0,
          promoCode: "",
          promoDiscount: 0,
        }),

      setOrderType: (type) => set({ orderType: type }),
      setDeliveryAddress: (address) => set({ deliveryAddress: address }),
      setOrderNotes: (notes) => set({ orderNotes: notes }),
      setTipAmount: (amount) => set({ tipAmount: amount }),
      setPromoCode: (code) => set({ promoCode: code }),
      setPromoDiscount: (discount) => set({ promoDiscount: discount }),

      // Table number
      tableNumber: "",
      setTableNumber: (number) => set({ tableNumber: number }),

      // Customer
      customerPhone: "",
      customerName: "",
      setCustomerPhone: (phone) => set({ customerPhone: phone }),
      setCustomerName: (name) => set({ customerName: name }),

      // Menu filters
      selectedCategoryId: null,
      searchQuery: "",
      dietaryFilters: [],
      setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setDietaryFilters: (filters) => set({ dietaryFilters: filters }),

      // Favorites
      favorites: [],
      toggleFavorite: (menuItemId) =>
        set((state) => ({
          favorites: state.favorites.includes(menuItemId)
            ? state.favorites.filter((id) => id !== menuItemId)
            : [...state.favorites, menuItemId],
        })),
      isFavorite: (menuItemId) => get().favorites.includes(menuItemId),

      // Settings
      settings: null,
      settingsLoaded: false,
      fetchSettings: async () => {
        // Skip if already loaded
        if (get().settingsLoaded) return;
        try {
          const res = await fetch("/api/settings");
          if (!res.ok) return;
          const data = await res.json();
          if (data.settings) {
            set({ settings: data.settings, settingsLoaded: true });
          }
        } catch {
          // Settings fetch failed - leave as null
        }
      },

      // UI
      isCartOpen: false,
      setIsCartOpen: (open) => set({ isCartOpen: open }),

      // Last order
      lastOrderNumber: null,
      setLastOrderNumber: (number) => set({ lastOrderNumber: number }),
    }),
    {
      name: "restaurant-store",
      partialize: (state) => ({
        cart: state.cart,
        orderType: state.orderType,
        tableNumber: state.tableNumber,
        customerPhone: state.customerPhone,
        customerName: state.customerName,
        favorites: state.favorites,
      }),
    }
  )
);
