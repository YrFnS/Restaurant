'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  ShoppingCart, Plus, Minus, Trash2, UtensilsCrossed, ShoppingBag,
  Truck, Car, CreditCard, Banknote, Search, Flame, Pause, X,
  Check, Receipt, Users, Hash, DollarSign, Calculator, Coffee,
  ChefHat, StickyNote, Armchair, Map as MapIcon, LayoutGrid, List,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useRestaurantStore } from '@/lib/store';

// ============ TYPES ============
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
  { value: 'dine_in', labelKey: 'dineIn' as const, icon: UtensilsCrossed, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'takeout', labelKey: 'takeout' as const, icon: ShoppingBag, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'delivery', labelKey: 'delivery' as const, icon: Truck, color: 'bg-sky-100 text-sky-700 border-sky-300' },
  { value: 'drive_thru', labelKey: 'driveThru' as const, icon: Car, color: 'bg-purple-100 text-purple-700 border-purple-300' },
];

// ============ MAIN POS COMPONENT ============
export default function POSTerminal() {
  const { t, locale, isRTL } = useI18n();
  const [categories, setCategories] = useState<MenuCategoryData[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);

  // Dialogs
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItemData | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [activeOrdersOpen, setActiveOrdersOpen] = useState(false);

  // Modifier form
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [modifierNotes, setModifierNotes] = useState('');
  const [modifierSeat, setModifierSeat] = useState<number | null>(null);
  const [modifierHold, setModifierHold] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Settings from shared store
  const storeSettings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  // Helper for localized item/category name
  const itemName = useCallback((item: { nameEn: string; nameAr: string }) =>
    locale === 'ar' ? item.nameAr : item.nameEn
  , [locale]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, tablesRes] = await Promise.all([fetch('/api/menu'), fetch('/api/tables')]);
        if (menuRes.ok) { const d = await menuRes.json(); setCategories(d.categories || []); if (d.categories?.length) setSelectedCategoryId(d.categories[0].id); }
        if (tablesRes.ok) { const d = await tablesRes.json(); setTables(d.tables || d || []); }
      } catch (e) { console.error('Failed to fetch POS data:', e); }
    };
    fetchData();
    fetchSettings();
  }, [fetchSettings]);

  // All items for search (search both En and Ar names)
  const allItems = useMemo(() => categories.flatMap(c => c.items), [categories]);
  const displayItems = useMemo(() => {
    if (searchQuery) return allItems.filter(i =>
      i.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.nameAr.includes(searchQuery)
    );
    if (!selectedCategoryId) return [];
    return categories.find(c => c.id === selectedCategoryId)?.items || [];
  }, [categories, selectedCategoryId, searchQuery, allItems]);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = storeSettings?.taxRate ?? 0;
  const taxAmount = subtotal * taxRate;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount + tipAmount;
  const currencySym = storeSettings?.currencySymbol ?? "";

  // Add to cart (quick add)
  const quickAdd = (item: MenuItemData) => {
    const existing = cart.find(c => c.menuItemId === item.id && c.modifiers.length === 0 && !c.notes && !c.hold);
    if (existing) {
      setCart(cart.map(c => c.id === existing.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: item.id, name: itemName(item), price: item.price,
        quantity: 1, modifiers: [], notes: '', seatNumber: null, hold: false,
      }]);
    }
    toast.success(t.pos.itemAdded);
  };

  // Open modifier dialog
  const openModifierDialog = (item: MenuItemData) => {
    setSelectedItem(item);
    const variants = item.modifiers.filter(m => m.type === 'variant');
    setSelectedVariant(variants.length > 0 ? variants[0].id : '');
    setSelectedAddons([]);
    setModifierNotes('');
    setModifierSeat(null);
    setModifierHold(false);
    setModifierDialogOpen(true);
  };

  // Add with modifiers
  const addWithModifiers = () => {
    if (!selectedItem) return;
    const variants = selectedItem.modifiers.filter(m => m.type === 'variant');
    const addons = selectedItem.modifiers.filter(m => m.type === 'addon');
    const selectedMods: string[] = [];
    let modPrice = 0;
    const variant = variants.find(v => v.id === selectedVariant);
    if (variant) { selectedMods.push(itemName(variant)); modPrice += variant.price; }
    for (const addonId of selectedAddons) {
      const addon = addons.find(a => a.id === addonId);
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

  // Update cart item
  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(c => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const removeItem = (id: string) => setCart(cart.filter(c => c.id !== id));

  // Place order
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    try {
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber, type: orderType,
          status: 'pending', paymentStatus: paymentComplete ? 'paid' : 'unpaid',
          paymentMethod: paymentMethod,
          customerName: '', customerPhone: '',
          notes: orderNotes, tableId: selectedTableId,
          subtotal, taxAmount, discountAmount, tipAmount, total,
          items: cart.map(item => ({
            menuItemId: item.menuItemId, quantity: item.quantity,
            unitPrice: item.price, modifiers: JSON.stringify(item.modifiers),
            notes: item.notes, totalPrice: item.price * item.quantity,
            station: 'prep', status: item.hold ? 'pending' : 'pending',
            hold: item.hold, seatNumber: item.seatNumber,
          })),
        }),
      });
      if (res.ok) {
        toast.success(t.pos.orderCreated);
        setCart([]);
        setOrderNotes('');
        setDiscountPercent(0);
        setTipAmount(0);
        setSelectedTableId(null);
        setPaymentComplete(false);
      }
    } catch { toast.error(t.common.error); }
  };

  // Process payment
  const handlePayment = () => {
    setPaymentComplete(true);
    toast.success(t.pos.paymentSuccessful);
    handlePlaceOrder();
    setPaymentDialogOpen(false);
  };

  const change = parseFloat(cashTendered) - total;

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
                orderType === ot.value ? ot.color : 'border-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              <ot.icon className="h-4 w-4" /> {t.pos[ot.labelKey]}
            </button>
          ))}
          {orderType === 'dine_in' && (
            <Button variant="outline" size="sm" className="ms-2" onClick={() => setTableDialogOpen(true)}>
              <Armchair className="h-4 w-4 me-1" />
              {selectedTableId ? `${t.pos.tableSelect} ${tables.find(tbl => tbl.id === selectedTableId)?.number}` : t.pos.tableSelect}
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
                  selectedCategoryId === cat.id ? 'bg-amber-100 text-amber-800 font-medium' : 'text-muted-foreground hover:bg-muted'
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
                  !item.isAvailable ? 'opacity-40' : 'hover:border-amber-300 hover:shadow-sm'
                }`}
              >
                {item.image && <div className="w-full h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  <img src={item.image} alt={itemName(item)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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

      {/* Right: Cart */}
      <div className="w-full lg:w-96 border-s border-border bg-card flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> {t.pos.createOrder}</h2>
            {cart.length > 0 && <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => setCart([])}>{t.pos.clearOrder}</Button>}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">{t.pos.noItems}</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      {item.hold && <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0"><Pause className="h-2.5 w-2.5" /></Badge>}
                    </div>
                    {item.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{item.modifiers.join(', ')}</p>}
                    {item.notes && <p className="text-xs text-amber-600 italic">{item.notes}</p>}
                    {item.seatNumber && <Badge className="text-[10px] px-1 py-0 bg-zinc-200 text-zinc-700">{t.pos.seatNumber} {item.seatNumber}</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="text-end">
                    <span className="text-sm font-bold">{currencySym}{(item.price * item.quantity).toFixed(2)}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400 hover:text-red-600 block" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Order Summary */}
        {cart.length > 0 && (
          <div className="border-t p-3 space-y-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>{t.pos.subtotal}</span><span>{currencySym}{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t.pos.tax}</span><span>{currencySym}{taxAmount.toFixed(2)}</span></div>
              {discountPercent > 0 && <div className="flex justify-between text-green-600"><span>{t.pos.discount} ({discountPercent}%)</span><span>-{currencySym}{discountAmount.toFixed(2)}</span></div>}
              {tipAmount > 0 && <div className="flex justify-between"><span>{t.pos.tip}</span><span>{currencySym}{tipAmount.toFixed(2)}</span></div>}
              <Separator />
              <div className="flex justify-between text-base font-bold"><span>{t.pos.total}</span><span>{currencySym}{total.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Label className="text-xs">{t.pos.discount} %</Label>
                <Input type="number" className="w-14 h-7 text-xs" value={discountPercent || ''} onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs">{t.pos.tip} {currencySym}</Label>
                <Input type="number" step="0.5" className="w-14 h-7 text-xs" value={tipAmount || ''} onChange={(e) => setTipAmount(Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 h-11 text-base font-bold" onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="h-4 w-4 me-1" /> {t.pos.pay} {currencySym}{total.toFixed(2)}
              </Button>
            </div>
            <Input placeholder={t.pos.orderNotes} value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} className="h-8 text-xs" />
          </div>
        )}
      </div>

      {/* Modifier Dialog */}
      <Sheet open={modifierDialogOpen} onOpenChange={setModifierDialogOpen}>
        <SheetContent className="sm:max-w-lg w-full">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">{itemName(selectedItem)} <Badge variant="outline">{currencySym}{selectedItem.price.toFixed(2)}</Badge></SheetTitle>
                <SheetDescription>{t.pos.chooseOption}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4">
                {/* Variants */}
                {selectedItem.modifiers.filter(m => m.type === 'variant').length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t.pos.chooseOption}</Label>
                    <RadioGroup value={selectedVariant} onValueChange={setSelectedVariant}>
                      {selectedItem.modifiers.filter(m => m.type === 'variant').map(v => (
                        <div key={v.id} className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent/50">
                          <RadioGroupItem value={v.id} id={`v-${v.id}`} />
                          <Label htmlFor={`v-${v.id}`} className="flex-1 cursor-pointer text-sm">{itemName(v)}</Label>
                          {v.price > 0 && <span className="text-sm text-muted-foreground">+{currencySym}{v.price.toFixed(2)}</span>}
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                {/* Addons */}
                {selectedItem.modifiers.filter(m => m.type === 'addon').length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{t.pos.addons}</Label>
                    {selectedItem.modifiers.filter(m => m.type === 'addon').map(a => (
                      <div key={a.id} className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent/50">
                        <Checkbox id={`a-${a.id}`} checked={selectedAddons.includes(a.id)} onCheckedChange={() => setSelectedAddons(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])} />
                        <Label htmlFor={`a-${a.id}`} className="flex-1 cursor-pointer text-sm">{itemName(a)}</Label>
                        {a.price > 0 && <span className="text-sm text-muted-foreground">+{currencySym}{a.price.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div><Label>{t.pos.specialNotes}</Label><Input value={modifierNotes} onChange={(e) => setModifierNotes(e.target.value)} placeholder={t.pos.specialNotes} /></div>
                <div><Label>{t.pos.seatNumber}</Label>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                      <Button key={s} variant={modifierSeat === s ? 'default' : 'outline'} size="sm" className="min-w-[36px] h-9" onClick={() => setModifierSeat(modifierSeat === s ? null : s)}>{s}</Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2"><Pause className="h-4 w-4 text-amber-500" /><Label>{t.pos.holdItem}</Label></div>
                  <Switch checked={modifierHold} onCheckedChange={setModifierHold} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setModifierDialogOpen(false)}>{t.common.cancel}</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={addWithModifiers}>{t.pos.addToCart}</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> {t.pos.processPayment}</DialogTitle>
            <DialogDescription>{t.pos.total}: <span className="font-bold text-foreground">{currencySym}{total.toFixed(2)}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {[
                { value: 'cash', icon: Banknote, labelKey: 'cash' as const },
                { value: 'card', icon: CreditCard, labelKey: 'card' as const },
              ].map(pm => (
                <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-colors ${paymentMethod === pm.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-muted'}`}
                >
                  <pm.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{t.pos[pm.labelKey]}</span>
                </button>
              ))}
            </div>
            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <Label>{t.pos.amountTendered}</Label>
                <Input type="number" step="0.01" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} className="text-xl h-12" placeholder="0.00" />
                <div className="flex gap-2 flex-wrap">
                  {[total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, 50, 100].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amt) => (
                    <Button key={amt} variant="outline" size="sm" onClick={() => setCashTendered(amt.toFixed(2))}>{currencySym}{amt.toFixed(2)}</Button>
                  ))}
                </div>
                {parseFloat(cashTendered) >= total && <div className="text-lg font-semibold text-emerald-600">{t.pos.change}: {currencySym}{(parseFloat(cashTendered) - total).toFixed(2)}</div>}
              </div>
            )}
            {paymentMethod === 'card' && (
              <div className="space-y-2">
                <Label>{t.pos.addTip}</Label>
                <div className="flex gap-2">
                  {(storeSettings?.tipPresets ? storeSettings.tipPresets.split(',').map(Number).filter((n) => !isNaN(n) && n > 0) : []).map(pct => (
                    <Button key={pct} variant="outline" size="sm" onClick={() => setTipAmount(parseFloat(((subtotal + taxAmount) * pct / 100).toFixed(2)))}>{pct}%</Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>{t.common.cancel}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={handlePayment} disabled={paymentMethod === 'cash' && parseFloat(cashTendered) < total}>
              {t.pos.completePayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Selection Dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Armchair className="h-5 w-5" /> {t.pos.tableSelect}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {tables.map((table) => {
              const isSelected = table.id === selectedTableId;
              const statusColors: Record<string, string> = { open: 'bg-emerald-100 text-emerald-800 border-emerald-300', occupied: 'bg-red-100 text-red-800 border-red-300', reserved: 'bg-sky-100 text-sky-800 border-sky-300', cleaning: 'bg-gray-100 text-gray-800 border-gray-300' };
              return (
                <button key={table.id} onClick={() => { setSelectedTableId(isSelected ? null : table.id); setTableDialogOpen(false); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-md' : `border-transparent ${statusColors[table.status] || 'bg-muted'}`}`}
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
