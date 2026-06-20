"use client";

import { use, useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Utensils, ArrowLeft, ArrowRight,
  Clock, Flame, Leaf, Check, X, ChefHat, Phone, Send, ArrowUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface CartLine {
  menuItemId: string;
  nameEn: string; nameAr: string;
  price: number; quantity: number;
  image: string; modifiers: any[]; notes: string;
  totalPrice: number;
}

export default function QrMenuPage({ params }: { params: Promise<{ tableNumber: string }> }) {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const { tableNumber } = use(params);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [dietary, setDietary] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [detailItem, setDetailItem] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const { data: menuData } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => (await fetch("/api/menu")).json(),
  });
  const { data: tableData } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => (await fetch("/api/tables")).json(),
  });

  const s = settingsData?.settings;
  const categories: any[] = menuData?.categories || [];
  const tables: any[] = tableData?.tables || [];
  const table = tables.find((t) => String(t.number) === String(tableNumber));
  const allItems = categories.flatMap((c) => c.items);

  const filtered = allItems.filter((i) => {
    if (activeCat !== "all" && i.categoryId !== activeCat) return false;
    if (dietary.length > 0 && !dietary.every((d) => i.dietary?.includes(d))) return false;
    if (query) {
      const q = query.toLowerCase();
      return i.nameEn.toLowerCase().includes(q) || i.nameAr.includes(query) || i.descriptionEn.toLowerCase().includes(q);
    }
    return true;
  });

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + i.totalPrice, 0);
  const tax = subtotal * (s?.taxRate || 0.1);
  const total = subtotal + tax;

  const quickAdd = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id && c.notes === "" && c.modifiers.length === 0);
      if (existing) {
        return prev.map((c) => c.menuItemId === item.id && c.notes === "" && c.modifiers.length === 0
          ? { ...c, quantity: c.quantity + 1, totalPrice: (c.quantity + 1) * c.price }
          : c);
      }
      return [...prev, {
        menuItemId: item.id, nameEn: item.nameEn, nameAr: item.nameAr,
        price: item.price, quantity: 1, image: item.image || "",
        modifiers: [], notes: "", totalPrice: item.price,
      }];
    });
    toast.success(`${isRTL ? item.nameAr : item.nameEn} ✓`);
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: newQty, totalPrice: newQty * next[idx].price };
      }
      return next;
    });
  };

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!customerName) { toast.error(t.cart.customerName); return; }
    setPlacing(true);
    try {
      const tableId = table?.id;
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "dine_in",
          customerName,
          customerPhone,
          tableId,
          serverName: "QR Order",
          subtotal,
          taxAmount: tax,
          total,
          paymentMethod: "cash",
          paymentStatus: "unpaid",
          notes: orderNotes,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId, quantity: c.quantity,
            unitPrice: c.price, modifiers: c.modifiers,
            notes: c.notes, totalPrice: c.totalPrice,
            stationSlug: c.modifiers.stationSlug || "",
          })),
          estimatedReady: new Date(Date.now() + 25 * 60 * 1000),
        }),
      });
      if (r.ok) {
        const { order } = await r.json();
        toast.success(`${t.cart.orderPlaced} ${order.orderNumber}`);
        setCart([]); setCartOpen(false);
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = `/track/${order.orderNumber.replace(/^#/, "")}`;
      }
    } catch { toast.error(t.common.error); }
    finally { setPlacing(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-accent/20 via-background to-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🌶️</span>
            <span className="font-bold text-primary hidden sm:block">{isRTL ? "زعفران وبهارات" : "Saffron & Spice"}</span>
          </Link>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Utensils className="size-3.5" />
            {isRTL ? `طاولة ${tableNumber}` : `Table ${tableNumber}`}
          </Badge>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 bg-primary text-primary-foreground text-[10px] font-bold size-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        {/* Search + categories */}
        <div className="max-w-3xl mx-auto px-4 pb-2.5">
          <div className="relative mb-2">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
            <Input
              placeholder={t.menu.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-9 h-10 bg-background"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              onClick={() => setActiveCat("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
              }`}
            >
              {t.menu.all}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                  activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                }`}
              >
                <span>{c.icon}</span>
                {isRTL ? c.nameAr : c.nameEn}
              </button>
            ))}
          </div>
          {/* Dietary filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 font-medium uppercase tracking-wide">{isRTL ? "النظام:" : "Diet:"}</span>
            {[
              { id: "vegetarian", label: t.menu.vegetarian, icon: "🥬" },
              { id: "vegan", label: t.menu.vegan, icon: "🌱" },
              { id: "gluten_free", label: t.menu.glutenFree, icon: "🌾" },
              { id: "halal", label: t.menu.halal, icon: "清真" },
              { id: "spicy", label: t.menu.spicy, icon: "🌶️" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDietary((p) => p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id])}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                  dietary.includes(f.id) ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"
                }`}
              >
                <span>{f.icon}</span>
                {f.label}
              </button>
            ))}
            {dietary.length > 0 && (
              <button onClick={() => setDietary([])} className="shrink-0 text-[11px] text-muted-foreground hover:text-destructive px-1.5">
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/30 to-primary/5 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center text-2xl shrink-0">🍽️</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">
              {isRTL ? `أهلاً بكم — طاولة ${tableNumber}` : `Welcome — Table ${tableNumber}`}
            </h1>
            <p className="text-xs text-muted-foreground">{isRTL ? "تصفح القائمة واطلب مباشرة من طاولتك" : "Browse the menu and order directly from your table"}</p>
          </div>
          {s && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock className="size-3.5 text-primary" />
              {s.openTime} - {s.closeTime}
            </div>
          )}
        </div>
      </div>

      {/* Menu items */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4">
        {activeCat === "all" && !query && dietary.length === 0 ? (
          categories.map((cat) => (
            <div key={cat.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${cat.color}20` }}>
                  {cat.icon}
                </div>
                <div>
                  <h2 className="font-bold text-base">{isRTL ? cat.nameAr : cat.nameEn}</h2>
                  <p className="text-[10px] text-muted-foreground">{cat.items.length} {t.menu.items}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cat.items.map((item: any) => (
                  <QrItemCard key={item.id} item={item} onQuickAdd={() => quickAdd(item)} onOpen={() => setDetailItem(item)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filtered.map((item) => (
              <QrItemCard key={item.id} item={item} onQuickAdd={() => quickAdd(item)} onOpen={() => setDetailItem(item)} />
            ))}
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Utensils className="size-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground">{t.menu.noResults}</p>
          </div>
        )}
      </main>

      {/* Back to top button */}
      <BackToTop />

      {/* Floating cart bar */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 inset-x-4 z-40 max-w-sm mx-auto"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full bg-primary text-primary-foreground rounded-2xl shadow-xl p-4 flex items-center justify-between gap-3 hover:brightness-110 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart className="size-5" />
                  <span className="absolute -top-1.5 -end-1.5 bg-background text-primary text-[10px] font-bold size-4 rounded-full flex items-center justify-center">{cartCount}</span>
                </div>
                <span className="font-semibold text-sm">{t.cart.viewCart || "View Cart"}</span>
              </div>
              <span className="font-bold">{fmtCurrency(total)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              {t.cart.title}
              <Badge variant="secondary">{cartCount}</Badge>
            </SheetTitle>
          </SheetHeader>
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="size-16 rounded-full bg-accent flex items-center justify-center text-3xl mb-3">🛒</div>
              <p className="text-muted-foreground">{t.cart.empty}</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {/* Customer info */}
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={t.cart.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} dir="auto" />
                    <Input placeholder={t.cart.customerPhone} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} dir="ltr" />
                  </div>
                  {/* Cart lines */}
                  {cart.map((line, idx) => (
                    <div key={idx} className="flex gap-3 p-3 rounded-xl bg-accent/50">
                      <div className="size-12 rounded-lg overflow-hidden bg-background shrink-0">
                        {line.image ? (
                          <img src={line.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm">{isRTL ? line.nameAr : line.nameEn}</h4>
                          <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {line.modifiers.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">{line.modifiers.map((m: any) => isRTL ? m.nameAr : m.nameEn).join(", ")}</p>
                        )}
                        {line.notes && <p className="text-[11px] text-muted-foreground italic">📝 {line.notes}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5 border rounded-full p-0.5 bg-background">
                            <button onClick={() => updateQty(idx, -1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center"><Minus className="size-3" /></button>
                            <span className="w-5 text-center text-xs font-semibold">{line.quantity}</span>
                            <button onClick={() => updateQty(idx, 1)} className="size-6 rounded-full hover:bg-accent flex items-center justify-center"><Plus className="size-3" /></button>
                          </div>
                          <span className="font-bold text-primary text-sm">{fmtCurrency(line.totalPrice)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <textarea
                    placeholder={t.cart.notesPlaceholder}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                    dir="auto"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </ScrollArea>
              <SheetFooter className="border-t border-border p-4 space-y-2">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.subtotal}</span><span>{fmtCurrency(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t.cart.tax}</span><span>{fmtCurrency(tax)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>{t.cart.total}</span><span className="text-primary">{fmtCurrency(total)}</span></div>
                </div>
                <Button onClick={placeOrder} disabled={placing || !customerName} className="w-full h-12 gap-2">
                  <Send className="size-4" />
                  {placing ? "..." : `${t.cart.placeOrder} · ${fmtCurrency(total)}`}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Item detail */}
      {detailItem && <QrItemDetail item={detailItem} onClose={() => setDetailItem(null)} onAdd={(line) => {
        setCart((prev) => [...prev, line]);
        toast.success(`${isRTL ? detailItem.nameAr : detailItem.nameEn} ✓`);
        setDetailItem(null);
      }} />}

      <footer className="mt-auto border-t border-border bg-card py-3">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-muted-foreground">
          {s?.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {s.phone}</span>}
          <span className="mx-2">·</span>
          <span>© {new Date().getFullYear()} {isRTL ? s?.nameAr : s?.nameEn}</span>
        </div>
      </footer>
    </div>
  );
}

function QrItemCard({ item, onQuickAdd, onOpen }: { item: any; onQuickAdd: () => void; onOpen: () => void }) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;
  return (
    <Card className="group overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="flex">
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-sm leading-tight line-clamp-1">{isRTL ? item.nameAr : item.nameEn}</h3>
            <span className="font-bold text-primary shrink-0 text-sm">{fmtCurrency(item.price)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 min-h-[1.75rem]">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="size-2.5" />{item.preparationTime}{t.common.minutes}</span>
            {item.dietary?.includes("spicy") && <span className="flex items-center gap-0.5 text-[10px] text-red-500"><Flame className="size-2.5" />{t.menu.spicy}</span>}
            {item.dietary?.includes("vegetarian") && <span className="flex items-center gap-0.5 text-[10px] text-green-600"><Leaf className="size-2.5" />{t.menu.vegetarian}</span>}
          </div>
          <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={hasModifiers ? onOpen : onQuickAdd}>
            {hasModifiers ? <><ChefHat className="size-3" />{t.menu.customize}</> : <><Plus className="size-3.5" />{t.menu.addToCart}</>}
          </Button>
        </div>
        <button onClick={onOpen} className="w-24 sm:w-28 bg-gradient-to-br from-primary/15 to-accent/40 overflow-hidden shrink-0">
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
          )}
        </button>
      </div>
    </Card>
  );
}

function QrItemDetail({ item, onClose, onAdd }: { item: any; onClose: () => void; onAdd: (line: CartLine) => void }) {
  const { t, isRTL, fmtCurrency } = useI18n();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const unitPrice = item.price + Object.entries(selected).flatMap(([gid, oids]) => {
    const g = item.modifierGroups?.find((g: any) => g.id === gid);
    return oids.map((oid) => g?.options.find((o: any) => o.id === oid)?.price || 0);
  }).reduce((a, b) => a + b, 0);
  const totalPrice = unitPrice * qty;

  const toggle = (gid: string, oid: string, max: number) => {
    setSelected((prev) => {
      const cur = prev[gid] || [];
      if (cur.includes(oid)) return { ...prev, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...prev, [gid]: [oid] };
      if (cur.length >= max) return prev;
      return { ...prev, [gid]: [...cur, oid] };
    });
  };

  const validate = () => {
    for (const g of item.modifierGroups || []) {
      if (g.isRequired && (!selected[g.id] || selected[g.id].length === 0)) return false;
    }
    return true;
  };

  const handleAdd = () => {
    if (!validate()) { toast.error(t.menu.modifierRequired); return; }
    const modifiers: any[] = [];
    Object.entries(selected).forEach(([gid, oids]) => {
      const g = item.modifierGroups?.find((g: any) => g.id === gid);
      oids.forEach((oid) => {
        const opt = g?.options.find((o: any) => o.id === oid);
        if (opt) modifiers.push({ id: opt.id, nameEn: opt.nameEn, nameAr: opt.nameAr, price: opt.price, preset: opt.preset });
      });
    });
    onAdd({
      menuItemId: item.id, nameEn: item.nameEn, nameAr: item.nameAr,
      price: unitPrice, quantity: qty, image: item.image || "",
      modifiers, notes, totalPrice,
    });
  };

  return (
    <Sheet open onClose={onClose} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-0">
          <div className="relative h-44 bg-gradient-to-br from-primary/20 to-accent overflow-hidden">
            {item.image ? (
              <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <span className="text-6xl opacity-50">🍽️</span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <button onClick={onClose} className="absolute top-3 end-3 size-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center">
              <X className="size-4" />
            </button>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <SheetTitle className="text-xl">{isRTL ? item.nameAr : item.nameEn}</SheetTitle>
              <span className="text-2xl font-bold text-primary shrink-0">{fmtCurrency(item.price)}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="gap-1"><Clock className="size-3" />{item.preparationTime}{t.common.minutes}</Badge>
              {item.calories > 0 && <Badge variant="outline" className="gap-1">🔥 {item.calories} {t.menu.calories}</Badge>}
              {item.allergens && <Badge variant="outline" className="gap-1 text-red-600">⚠ {item.allergens}</Badge>}
            </div>
            <div className="space-y-4">
              {(item.modifierGroups || []).map((g: any) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{isRTL ? g.nameAr : g.nameEn}</h4>
                    <span className="text-xs text-muted-foreground">
                      {g.isRequired ? t.menu.required : t.menu.optional}
                      {g.maxSelect > 1 && ` · ${t.menu.chooseUpTo.replace("{n}", g.maxSelect)}`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {g.options.map((opt: any) => {
                      const isSel = (selected[g.id] || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggle(g.id, opt.id, g.maxSelect)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start ${
                            isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSel ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                            {isSel && <Check className="size-3 text-primary-foreground" />}
                          </div>
                          <span className="flex-1 text-sm">{isRTL ? opt.nameAr : opt.nameEn}</span>
                          {opt.price > 0 && <span className="text-sm font-medium text-primary">+{fmtCurrency(opt.price)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-sm mb-2">{t.menu.specialInstructions}</h4>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.menu.specialInstructionsPlaceholder}
                rows={2}
                dir="auto"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </ScrollArea>
        <SheetFooter className="border-t border-border p-4 flex-row items-center gap-3">
          <div className="flex items-center gap-2 border rounded-full p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="size-8 rounded-full hover:bg-accent flex items-center justify-center"><Minus className="size-4" /></button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="size-8 rounded-full hover:bg-accent flex items-center justify-center"><Plus className="size-4" /></button>
          </div>
          <Button onClick={handleAdd} className="flex-1 h-12 text-base gap-2">
            {t.menu.addToCart} · {fmtCurrency(totalPrice)}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-4 start-4 z-30 size-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:brightness-110 transition-all"
      aria-label="Back to top"
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
