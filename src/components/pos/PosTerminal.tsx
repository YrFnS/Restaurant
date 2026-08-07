"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LayoutGrid, Map, ShoppingCart, Languages, LogOut, Flame, Store,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FloorPlan } from "./FloorPlan";
import { MenuBrowser } from "./MenuBrowser";
import { OrderTicket } from "./OrderTicket";
import { PaymentDialog, ReceiptDialog } from "./PaymentDialog";
import { SplitBillDialog } from "./SplitBillDialog";
import { ModifierDialog } from "./ModifierDialog";
import {
  type MenuItem,
  type OrderType,
  type PaymentMethod,
  type PosOrderItem,
  type RestaurantSettings,
  type RestaurantTable,
} from "./types";

type LeftView = "menu" | "floor";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pos-kitchen-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function PosTerminal() {
  const { t, isRTL, locale, toggleLocale } = useI18n();
  const { staffName, clearStaff } = useRestaurantStore();
  const qc = useQueryClient();

  // ─── State ───
  const [leftView, setLeftView] = useState<LeftView>("menu");
  const [mobileTab, setMobileTab] = useState<"floor" | "menu" | "ticket">("menu");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [items, setItems] = useState<PosOrderItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tip, setTip] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const kitchenIdempotencyKeyRef = useRef<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderNumber: string;
    total: number;
    method: PaymentMethod;
    change: number;
  } | null>(null);

  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [modifierOpen, setModifierOpen] = useState(false);
  const [modifierSession, setModifierSession] = useState(0);

  // ─── Settings (tax rate, delivery fee) ───
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["pos-settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      return (await r.json()) as { settings: RestaurantSettings };
    },
    staleTime: 120_000,
  });
  const settings = settingsData?.settings;
  const taxRate = settings?.taxRate ?? 0.1;
  const deliveryFee = settings?.deliveryFee ?? 4.99;
  const kitchenOrderPayload = useMemo(
    () => ({
      type: orderType,
      customerName:
        customerName ||
        (selectedTable ? `Table ${selectedTable.number}` : "Walk-in"),
      customerPhone,
      deliveryAddress:
        orderType === "delivery" ? deliveryAddress : null,
      tableNumber:
        orderType === "dine_in" ? selectedTable?.number : undefined,
      notes: notes || null,
      promoCode: null,
      tip:
        tip > 0
          ? { mode: "amount" as const, value: tip }
          : { mode: "none" as const },
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierOptionIds: item.modifiers.map((modifier) => modifier.id),
        notes: item.notes || null,
        course: item.course,
      })),
    }),
    [
      customerName,
      customerPhone,
      deliveryAddress,
      items,
      notes,
      orderType,
      selectedTable,
      tip,
    ]
  );
  const kitchenOrderFingerprint = useMemo(
    () => JSON.stringify(kitchenOrderPayload),
    [kitchenOrderPayload]
  );

  useEffect(() => {
    kitchenIdempotencyKeyRef.current = null;
  }, [kitchenOrderFingerprint]);

  // ─── Item ops ───
  const addItem = (item: PosOrderItem) => {
    setItems((prev) => {
      // Merge identical lines (same menuItem + modifiers + notes)
      const existing = prev.find(
        (c) =>
          c.menuItemId === item.menuItemId &&
          c.notes === item.notes &&
          JSON.stringify(c.modifiers) === JSON.stringify(item.modifiers)
      );
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                quantity: c.quantity + item.quantity,
                totalPrice: (c.quantity + item.quantity) * c.price,
              }
            : c
        );
      }
      return [...prev, item];
    });
    toast.success(`${isRTL ? item.nameAr : item.nameEn} · ${t.pos.addToOrder}`, {
      duration: 1200,
    });
  };

  const incItem = (id: string) =>
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, quantity: c.quantity + 1, totalPrice: (c.quantity + 1) * c.price }
          : c
      )
    );

  const decItem = (id: string) =>
    setItems((prev) =>
      prev
        .map((c) =>
          c.id === id
            ? {
                ...c,
                quantity: c.quantity - 1,
                totalPrice: (c.quantity - 1) * c.price,
              }
            : c
        )
        .filter((c) => c.quantity > 0)
    );

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((c) => c.id !== id));

  const clearAll = () => {
    setItems([]);
    setNotes("");
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setTip(0);
    setSelectedTable(null);
  };

  // ─── Floor → menu auto-switch when occupying a table ───
  const handleOccupy = (table: RestaurantTable) => {
    setSelectedTable(table);
    if (orderType !== "dine_in") setOrderType("dine_in");
    setLeftView("menu");
    setMobileTab("menu");
    toast.success(`${t.pos.dineIn} — ${t.pos.tables} #${table.number}`);
  };

  // When a table is selected from floor plan, auto-switch to menu view
  const handleSelectTable = (table: RestaurantTable | null) => {
    setSelectedTable(table);
    if (table && orderType !== "dine_in") {
      setOrderType("dine_in");
    }
  };

  // When switching order type away from dine-in, deselect table
  const handleChangeOrderType = (type: OrderType) => {
    setOrderType(type);
    if (type !== "dine_in") setSelectedTable(null);
  };

  // ─── Send to kitchen ───
  const handleSendToKitchen = async () => {
    if (items.length === 0) return;
    if (orderType === "dine_in" && !selectedTable) {
      toast.error(t.pos.noTableSelected);
      setLeftView("floor");
      setMobileTab("floor");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error(t.cart.deliveryAddress);
      return;
    }
    if (orderType === "delivery" && !customerPhone.trim()) {
      toast.error(t.cart.customerPhone);
      return;
    }

    setIsSending(true);
    kitchenIdempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": kitchenIdempotencyKeyRef.current,
        },
        body: JSON.stringify(kitchenOrderPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order) {
        throw new Error(data?.error || t.common.error);
      }

      qc.invalidateQueries({ queryKey: ["pos-tables"] });
      toast.success(`${t.pos.sentToKitchen} — ${data.order.orderNumber}`);
      kitchenIdempotencyKeyRef.current = null;
      clearAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setIsSending(false);
    }
  };


  const handlePayComplete = (result: {
    orderId: string;
    orderNumber: string;
    method: PaymentMethod;
    tendered: number;
    change: number;
  }) => {
    const total = items.reduce((s, i) => s + i.totalPrice, 0)
      + Math.round(items.reduce((s, i) => s + i.totalPrice, 0) * taxRate * 100) / 100
      + (orderType === "delivery" ? deliveryFee : 0)
      + tip;
    setPayOpen(false);
    setReceipt({
      orderNumber: result.orderNumber,
      total,
      method: result.method,
      change: result.change,
    });
    qc.invalidateQueries({ queryKey: ["pos-tables"] });
    clearAll();
  };

  // Open modifier dialog when item requires modifiers
  const handleItemNeedsModifiers = (item: MenuItem) => {
    setModifierItem(item);
    setModifierSession((s) => s + 1);
    setModifierOpen(true);
  };

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  const restaurantName = isRTL ? settings?.nameAr : settings?.nameEn;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ─── Top bar ─── */}
      <header className="shrink-0 border-b border-border bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Flame className="size-5" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="font-bold text-sm leading-tight truncate">
                {restaurantName || t.app.name}
              </p>
              <p className="text-[10px] opacity-90 leading-tight truncate">
                {t.pos.title}
              </p>
            </div>
          </div>

          {/* Desktop view switcher */}
          <div className="hidden md:flex items-center gap-1 bg-white/15 backdrop-blur rounded-lg p-1 ms-2">
            <button
              onClick={() => setLeftView("menu")}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                leftView === "menu" ? "bg-white text-amber-700 shadow-sm" : "text-white hover:bg-white/10"
              }`}
            >
              <LayoutGrid className="size-4" />
              {t.menu.title}
            </button>
            <button
              onClick={() => setLeftView("floor")}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                leftView === "floor" ? "bg-white text-amber-700 shadow-sm" : "text-white hover:bg-white/10"
              }`}
            >
              <Map className="size-4" />
              {t.pos.floorPlan}
            </button>
          </div>

          <div className="flex-1" />

          {/* Server badge */}
          <div className="hidden sm:flex items-center gap-2 bg-white/15 backdrop-blur rounded-lg px-3 py-1.5">
            <div className="size-7 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">
              {(staffName || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight">
              <p className="text-[10px] opacity-90">{t.pos.server}</p>
              <p className="text-xs font-semibold">{staffName || "—"}</p>
            </div>
          </div>

          {/* Language toggle */}
          <button
            onClick={toggleLocale}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 text-sm font-medium transition-colors"
            aria-label={t.common.language}
          >
            <Languages className="size-4" />
            <span>{locale === "en" ? "العربية" : "English"}</span>
          </button>

          {/* Back to restaurant */}
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            aria-label="Back to restaurant"
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors h-9 text-white hover:bg-white/15 hover:text-white px-2"
          >
            <Store className="size-4" />
            <span className="hidden sm:inline ms-1">{t.app.name}</span>
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              }).catch(() => undefined);
              clearStaff();
              toast.success(t.admin.logout);
              setTimeout(() => window.location.reload(), 400);
            }}
            className="inline-flex items-center justify-center size-9 rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 transition-colors"
            aria-label={t.admin.logout}
          >
            <LogOut className={`size-4 ${isRTL ? "rotate-180" : ""}`} />
          </button>
        </div>
      </header>

      {/* ─── Desktop: two-panel layout ─── */}
      <main className="hidden md:grid md:grid-cols-[1fr_400px] lg:grid-cols-[1fr_440px] flex-1 min-h-0">
        {/* LEFT: floor / menu */}
        <section className="border-e border-border bg-background min-h-0 overflow-hidden">
          {leftView === "floor" ? (
            <FloorPlan
              selectedTableId={selectedTable?.id ?? null}
              onSelectTable={handleSelectTable}
              onOccupy={handleOccupy}
            />
          ) : (
            <MenuBrowser
              onAddItem={addItem}
              onItemNeedsModifiers={handleItemNeedsModifiers}
            />
          )}
        </section>

        {/* RIGHT: order ticket (sticky) */}
        <aside className="bg-card min-h-0 overflow-hidden">
          {settingsLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <OrderTicket
              items={items}
              orderType={orderType}
              table={selectedTable}
              serverName={staffName || ""}
              customerName={customerName}
              customerPhone={customerPhone}
              deliveryAddress={deliveryAddress}
              notes={notes}
              taxRate={taxRate}
              deliveryFee={deliveryFee}
              discount={0}
              tip={tip}
              isSending={isSending}
              onChangeOrderType={handleChangeOrderType}
              onIncItem={incItem}
              onDecItem={decItem}
              onRemoveItem={removeItem}
              onClearAll={clearAll}
              onSetCustomerName={setCustomerName}
              onSetCustomerPhone={setCustomerPhone}
              onSetDeliveryAddress={setDeliveryAddress}
              onSetNotes={setNotes}
              onSendToKitchen={handleSendToKitchen}
              onCharge={() => setPayOpen(true)}
              onSplitBill={() => setSplitOpen(true)}
            />
          )}
        </aside>
      </main>

      {/* ─── Mobile: tabs ─── */}
      <main className="flex-1 min-h-0 md:hidden">
        <Tabs
          value={mobileTab}
          onValueChange={(v) => setMobileTab(v as typeof mobileTab)}
          className="h-full flex flex-col"
        >
          <TabsList className="grid grid-cols-3 h-12 rounded-none border-b border-border bg-card">
            <TabsTrigger value="floor" className="h-10 flex-col text-xs gap-0.5">
              <Map className="size-4" />
              {t.pos.floorPlan}
            </TabsTrigger>
            <TabsTrigger value="menu" className="h-10 flex-col text-xs gap-0.5">
              <LayoutGrid className="size-4" />
              {t.menu.title}
            </TabsTrigger>
            <TabsTrigger value="ticket" className="h-10 flex-col text-xs gap-0.5 relative">
              <ShoppingCart className="size-4" />
              {t.pos.orderSummary}
              {itemCount > 0 && (
                <span className="absolute top-1 end-2 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold inline-flex items-center justify-center tabular-nums">
                  {itemCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="floor" className="flex-1 min-h-0 overflow-hidden">
            <FloorPlan
              selectedTableId={selectedTable?.id ?? null}
              onSelectTable={(table) => {
                handleSelectTable(table);
                if (table) setMobileTab("menu");
              }}
              onOccupy={(table) => {
                handleOccupy(table);
                setMobileTab("menu");
              }}
            />
          </TabsContent>
          <TabsContent value="menu" className="flex-1 min-h-0 overflow-hidden">
            <MenuBrowser
              onAddItem={(it) => {
                addItem(it);
                setMobileTab("ticket");
              }}
              onItemNeedsModifiers={(item) => {
                setModifierItem(item);
                setModifierOpen(true);
              }}
            />
          </TabsContent>
          <TabsContent value="ticket" className="flex-1 min-h-0 overflow-hidden">
            {settingsLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <OrderTicket
                items={items}
                orderType={orderType}
                table={selectedTable}
                serverName={staffName || ""}
                customerName={customerName}
                customerPhone={customerPhone}
                deliveryAddress={deliveryAddress}
                notes={notes}
                taxRate={taxRate}
                deliveryFee={deliveryFee}
                discount={0}
                tip={tip}
                isSending={isSending}
                onChangeOrderType={handleChangeOrderType}
                onIncItem={incItem}
                onDecItem={decItem}
                onRemoveItem={removeItem}
                onClearAll={clearAll}
                onSetCustomerName={setCustomerName}
                onSetCustomerPhone={setCustomerPhone}
                onSetDeliveryAddress={setDeliveryAddress}
                onSetNotes={setNotes}
                onSendToKitchen={handleSendToKitchen}
                onCharge={() => setPayOpen(true)}
              onSplitBill={() => setSplitOpen(true)}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ─── Payment dialog ─── */}
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        items={items}
        orderType={orderType}
        table={selectedTable}
        serverName={staffName || ""}
        customerName={customerName}
        customerPhone={customerPhone}
        deliveryAddress={deliveryAddress}
        notes={notes}
        taxRate={taxRate}
        deliveryFee={deliveryFee}
        tip={tip}
        onComplete={handlePayComplete}
      />

      {/* ─── Split bill dialog ─── */}
      <SplitBillDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        items={items}
        orderType={orderType}
        table={selectedTable}
        serverName={staffName || ""}
        customerName={customerName}
        customerPhone={customerPhone}
        deliveryAddress={deliveryAddress}
        notes={notes}
        taxRate={taxRate}
        deliveryFee={deliveryFee}
        tip={tip}
        onComplete={(result) => {
          setSplitOpen(false);
          setItems([]);
          setCustomerName("");
          setCustomerPhone("");
          setDeliveryAddress("");
          setNotes("");
          setTip(0);
          setSelectedTable(null);
          setReceipt({
            orderNumber: result.orderNumber,
            total: items.reduce((s, i) => s + i.totalPrice, 0),
            method: "card" as PaymentMethod,
            change: 0,
          });
          toast.success(`${t.pos.saleCompleted} ${result.orderNumber}`);
        }}
      />

      {/* ─── Receipt dialog ─── */}
      <ReceiptDialog
        open={!!receipt}
        onOpenChange={(o) => !o && setReceipt(null)}
        orderNumber={receipt?.orderNumber ?? ""}
        total={receipt?.total ?? 0}
        method={receipt?.method ?? "cash"}
        change={receipt?.change ?? 0}
      />

      {/* ─── Modifier dialog ─── */}
      <ModifierDialog
        key={`modifier-${modifierSession}`}
        item={modifierItem}
        stationSlug={
          modifierItem ? guessStationSlug(modifierItem) : ""
        }
        open={modifierOpen}
        onOpenChange={setModifierOpen}
        onAddItem={(it) => {
          addItem(it);
          setMobileTab("ticket");
        }}
      />
    </div>
  );

  function guessStationSlug(item: MenuItem): string {
    // Use the categories query to look up stationSlugs. To avoid a re-fetch,
    // we cache via queryClient inside this closure on first use.
    const data = qc.getQueryData<{ categories: any[] }>(["pos-menu"]);
    const cat = data?.categories?.find((c) => c.id === item.categoryId);
    return cat?.stationSlugs || "prep";
  }
}
