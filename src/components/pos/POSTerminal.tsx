"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  UtensilsCrossed, ShoppingBag, Truck, Car,
  Search, Armchair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { OrderReview } from "./terminal/OrderReview";
import { PaymentPanel } from "./terminal/PaymentPanel";

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: string[];
  notes: string;
  seatNumber: number | null;
  hold: boolean;
}

interface MenuCategoryData {
  id: string; nameEn: string; nameAr: string; icon: string;
  items: MenuItemData[];
}

interface MenuItemData {
  id: string; nameEn: string; nameAr: string; price: number;
  isAvailable: boolean; image: string; preparationTime: number;
  modifiers: ModifierData[];
}

interface ModifierData {
  id: string; nameEn: string; nameAr: string; type: string; price: number;
}

interface TableData {
  id: string; number: number; capacity: number; section: string; status: string; shape: string;
}

const ORDER_TYPES = [
  { value: "dine_in", labelKey: "dineIn" as const, icon: UtensilsCrossed, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "takeout", labelKey: "takeout" as const, icon: ShoppingBag, color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "delivery", labelKey: "delivery" as const, icon: Truck, color: "bg-sky-100 text-sky-700 border-sky-300" },
  { value: "drive_thru", labelKey: "driveThru" as const, icon: Car, color: "bg-purple-100 text-purple-700 border-purple-300" },
];

export default function POSTerminal() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<MenuCategoryData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);

  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [modifierNotes, setModifierNotes] = useState("");
  const [modifierSeat, setModifierSeat] = useState<number | null>(null);
  const [modifierHold, setModifierHold] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);

  const storeSettings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  const itemName = useCallback((item: { nameEn: string; nameAr: string }) =>
    locale === "ar" ? item.nameAr : item.nameEn, [locale]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, tablesRes] = await Promise.all([fetch("/api/menu"), fetch("/api/tables")]);
        if (menuRes.ok) { const d = await menuRes.json(); setCategories(d.categories || []); if (d.categories?.length) setSelectedCategoryId(d.categories[0].id); }
        if (tablesRes.ok) { const d = await tablesRes.json(); setTables(d.tables || d || []); }
      } catch (e) { console.error("Failed to fetch POS data:", e); }
    };
    fetchData();
    fetchSettings();
  }, [fetchSettings]);

  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories]);
  const displayItems = useMemo(() => {
    if (searchQuery) return allItems.filter((i) => i.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) || i.nameAr.includes(searchQuery));
    if (!selectedCategoryId) return [];
    return categories.find((c) => c.id === selectedCategoryId)?.items || [];
  }, [categories, selectedCategoryId, searchQuery, allItems]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = storeSettings?.taxRate ?? 0;
  const taxAmount = subtotal * taxRate;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount + tipAmount;
  const currencySym = storeSettings?.currencySymbol ?? "";

  const quickAdd = (item: MenuItemData) => {
    const existing = cart.find((c) => c.menuItemId === item.id && c.modifiers.length === 0 && !c.notes && !c.hold);
    if (existing) {
      setCart(cart.map((c) => c.id === existing.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: item.id, name: itemName(item), price: item.price,
        quantity: 1, modifiers: [], notes: "", seatNumber: null, hold: false,
      }]);
    }
    toast.success(t.pos.itemAdded);
  };

  const openModifierDialog = (item: MenuItemData) => {
    setSelectedItem(item);
    const variants = item.modifiers.filter((m) => m.type === "variant");
    setSelectedVariant(variants.length > 0 ? variants[0].id : "");
    setSelectedAddons([]);
    setModifierNotes("");
    setModifierSeat(null);
    setModifierHold(false);
    setModifierDialogOpen(true);
  };

  const addWithModifiers = () => {
    if (!selectedItem) return;
    const variants = selectedItem.modifiers.filter((m) => m.type === "variant");
    const addons = selectedItem.modifiers.filter((m) => m.type === "addon");
    const selectedMods: string[] = [];
    let modPrice = 0;
    const variant = variants.find((v) => v.id === selectedVariant);
    if (variant) { selectedMods.push(itemName(variant)); modPrice += variant.price; }
    for (const addonId of selectedAddons) {
      const addon = addons.find((a) => a.id === addonId);
      if (addon) { selectedMods.push(itemName(addon)); modPrice += addon.price; }
    }
    setCart([...cart, {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: selectedItem.id, name: itemName(selectedItem), price: selectedItem.price + modPrice,
      quantity: 1, modifiers: selectedMods, notes: modifierNotes, seatNumber: modifierSeat, hold: modifierHold,
    }]);
    setModifierDialogOpen(false);
    toast.success(t.pos.itemAdded);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map((c) => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  };

  const removeItem = (id: string) => setCart(cart.filter((c) => c.id !== id));

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    try {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber, type: orderType,
          status: "pending", paymentStatus: paymentComplete ? "paid" : "unpaid",
          paymentMethod,
          customerName: "", customerPhone: "",
          notes: orderNotes, tableId: selectedTableId,
          subtotal, taxAmount, discountAmount, tipAmount, total,
          items: cart.map((item) => ({
            menuItemId: item.menuItemId, quantity: item.quantity,
            unitPrice: item.price, modifiers: JSON.stringify(item.modifiers),
            notes: item.notes, totalPrice: item.price * item.quantity,
            station: "prep", status: item.hold ? "pending" : "pending",
            hold: item.hold, seatNumber: item.seatNumber,
          })),
        }),
      });
      if (res.ok) {
        toast.success(t.pos.orderCreated);
        setCart([]);
        setOrderNotes("");
        setDiscountPercent(0);
        setTipAmount(0);
        setSelectedTableId(null);
        setPaymentComplete(false);
      }
    } catch { toast.error(t.common.error); }
  };

  const handlePayment = () => {
    setPaymentComplete(true);
    toast.success(t.pos.paymentSuccessful);
    handlePlaceOrder();
    setPaymentDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background pt-12 flex flex-col lg:flex-row">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Order Type Selector */}
        <div className="flex items-center gap-2 p-3 border-b bg-card">
          {ORDER_TYPES.map((ot) => (
            <button
              key={ot.value}
              onClick={() => setOrderType(ot.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                orderType === ot.value ? ot.color : "border-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              <ot.icon className="h-4 w-4" /> {t.pos[ot.labelKey]}
            </button>
          ))}
          {orderType === "dine_in" && (
            <Button variant="outline" size="sm" className="ms-2" onClick={() => setTableDialogOpen(true)}>
              <Armchair className="h-4 w-4 me-1" />
              {selectedTableId ? `${t.pos.tableSelect} ${tables.find((tbl) => tbl.id === selectedTableId)?.number}` : t.pos.tableSelect}
            </Button>
          )}
          <div className="ms-auto">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder={t.pos.searchMenu} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ps-8 h-8 w-48 text-sm" />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex gap-1 p-2 overflow-x-auto border-b bg-card">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  selectedCategoryId === cat.id ? "bg-amber-100 text-amber-800 font-medium" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat.icon} {itemName(cat)}
              </button>
            ))}
          </div>
        )}

        {/* Item Grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3">
            {displayItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => quickAdd(item)}
                onContextMenu={(e) => { e.preventDefault(); openModifierDialog(item); }}
                className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border bg-card text-center transition-colors ${
                  !item.isAvailable ? "opacity-40" : "hover:border-amber-300 hover:shadow-sm"
                }`}
              >
                {item.image && <div className="w-full h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  <img src={item.image} alt={itemName(item)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>}
                <span className="text-sm font-medium line-clamp-1">{itemName(item)}</span>
                <span className="text-amber-700 font-bold text-sm">{currencySym}{item.price.toFixed(2)}</span>
                {item.modifiers.length > 0 && <Badge variant="outline" className="text-[10px] px-1">+ {t.pos.modifiers}</Badge>}
                {!item.isAvailable && <Badge className="absolute top-1 end-1 bg-red-500 text-white text-[10px]">{t.pos.unavailable}</Badge>}
              </motion.button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Cart / OrderReview */}
      <OrderReview
        cart={cart} subtotal={subtotal} taxAmount={taxAmount}
        discountAmount={discountAmount} tipAmount={tipAmount} total={total}
        discountPercent={discountPercent} currencySym={currencySym} orderNotes={orderNotes}
        selectedItem={selectedItem} modifierDialogOpen={modifierDialogOpen}
        selectedVariant={selectedVariant} selectedAddons={selectedAddons}
        modifierNotes={modifierNotes} modifierSeat={modifierSeat} modifierHold={modifierHold}
        onUpdateQuantity={updateQuantity} onRemoveItem={removeItem} onClearCart={() => setCart([])}
        onDiscountPercentChange={setDiscountPercent} onTipAmountChange={setTipAmount} onOrderNotesChange={setOrderNotes}
        onPay={() => setPaymentDialogOpen(true)}
        onVariantChange={setSelectedVariant} onAddonToggle={(id) => setSelectedAddons((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
        onModifierNotesChange={setModifierNotes} onModifierSeatChange={setModifierSeat}
        onModifierHoldChange={setModifierHold} onModifierAdd={addWithModifiers} onModifierClose={() => setModifierDialogOpen(false)}
      />

      {/* Payment Dialog */}
      <PaymentPanel
        open={paymentDialogOpen} total={total} subtotal={subtotal} taxAmount={taxAmount}
        currencySym={currencySym} paymentMethod={paymentMethod} cashTendered={cashTendered}
        storeSettings={storeSettings}
        onPaymentMethodChange={setPaymentMethod} onCashTenderedChange={setCashTendered}
        onTipChange={setTipAmount} onComplete={handlePayment} onClose={() => setPaymentDialogOpen(false)}
      />

      {/* Table Selection Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Armchair className="h-5 w-5" /> {t.pos.tableSelect}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {tables.map((table) => {
              const isSelected = table.id === selectedTableId;
              const statusColors: Record<string, string> = { open: "bg-emerald-100 text-emerald-800 border-emerald-300", occupied: "bg-red-100 text-red-800 border-red-300", reserved: "bg-sky-100 text-sky-800 border-sky-300", cleaning: "bg-gray-100 text-gray-800 border-gray-300" };
              return (
                <button key={table.id} onClick={() => { setSelectedTableId(isSelected ? null : table.id); setTableDialogOpen(false); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${isSelected ? "border-emerald-500 bg-emerald-50 shadow-md" : `border-transparent ${statusColors[table.status] || "bg-muted"}`}`}
                >
                  <span className="font-bold text-sm">#{table.number}</span>
                  <span className="text-xs">{table.capacity} {t.pos.seats}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
