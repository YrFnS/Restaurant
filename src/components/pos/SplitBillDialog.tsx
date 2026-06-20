"use client";

import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Split, Users, ListOrdered, Divide, Plus, Minus, Check, X,
  CreditCard, Banknote, Loader2, ArrowLeft, ArrowRight, Receipt,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { type PosOrderItem, type PaymentMethod, type OrderType, type RestaurantTable, posSubtotal, posTax, posTotal } from "./types";

interface SplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PosOrderItem[];
  orderType: OrderType;
  table: RestaurantTable | null;
  serverName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  notes: string;
  taxRate: number;
  deliveryFee: number;
  tip: number;
  onComplete: (result: { orderId: string; orderNumber: string }) => void;
}

type SplitMode = "even" | "items" | "custom";
type Guest = { name: string; itemIds: string[]; customAmount: number; method: PaymentMethod };

export function SplitBillDialog(props: SplitBillDialogProps) {
  const {
    open, onOpenChange, items, orderType, table,
    serverName, customerName, customerPhone, deliveryAddress, notes,
    taxRate, deliveryFee, tip, onComplete,
  } = props;

  const { t, isRTL, fmtCurrency } = useI18n();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [mode, setMode] = useState<SplitMode>("even");
  const [guestCount, setGuestCount] = useState(2);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [currentGuest, setCurrentGuest] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedPayments, setCompletedPayments] = useState<number[]>([]);

  const subtotal = useMemo(() => posSubtotal(items), [items]);
  const tax = useMemo(() => posTax(subtotal, taxRate), [subtotal, taxRate]);
  const total = useMemo(
    () => posTotal(subtotal, tax, orderType === "delivery" ? deliveryFee : 0, 0, tip),
    [subtotal, tax, orderType, deliveryFee, tip]
  );

  // reset state when dialog opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("even");
      setGuestCount(2);
      setGuests([
        { name: "Guest 1", itemIds: [], customAmount: 0, method: "card" },
        { name: "Guest 2", itemIds: [], customAmount: 0, method: "card" },
      ]);
      setCurrentGuest(0);
      setCompletedPayments([]);
      setIsProcessing(false);
    }
  }, [open]);

  // update guest count
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuests((prev) => {
      const next = [...prev];
      while (next.length < guestCount) {
        next.push({ name: `Guest ${next.length + 1}`, itemIds: [], customAmount: 0, method: "card" });
      }
      next.length = guestCount;
      return next;
    });
  }, [guestCount, open]);

  // Calculate per-guest amount based on mode
  const guestAmounts = useMemo(() => {
    if (mode === "even") {
      const per = total / guestCount;
      return Array(guestCount).fill(per);
    }
    if (mode === "items") {
      return guests.map((g) => {
        const guestSub = g.itemIds.reduce((sum, id) => {
          const it = items.find((i) => i.id === id);
          return sum + (it ? it.totalPrice : 0);
        }, 0);
        const ratio = subtotal > 0 ? guestSub / subtotal : 0;
        return guestSub + tax * ratio + (orderType === "delivery" ? deliveryFee * ratio : 0) + tip * ratio;
      });
    }
    // custom
    return guests.map((g) => g.customAmount);
  }, [mode, guests, items, total, guestCount, subtotal, tax, deliveryFee, tip, orderType]);

  const assignedItemIds = useMemo(() => new Set(guests.flatMap((g) => g.itemIds)), [guests]);
  const unassignedItems = items.filter((i) => !assignedItemIds.has(i.id));
  const allAssigned = mode !== "items" || unassignedItems.length === 0;
  const customSum = mode === "custom" ? guests.reduce((s, g) => s + g.customAmount, 0) : 0;
  const customValid = mode !== "custom" || Math.abs(customSum - total) < 0.01;

  const toggleItem = (itemId: string, guestIdx: number) => {
    setGuests((prev) => prev.map((g, i) => {
      if (i !== guestIdx) {
        // remove from other guests
        return { ...g, itemIds: g.itemIds.filter((id) => id !== itemId) };
      }
      // toggle for current guest
      const has = g.itemIds.includes(itemId);
      return { ...g, itemIds: has ? g.itemIds.filter((id) => id !== itemId) : [...g.itemIds, itemId] };
    }));
  };

  const setGuestMethod = (guestIdx: number, method: PaymentMethod) => {
    setGuests((prev) => prev.map((g, i) => i === guestIdx ? { ...g, method } : g));
  };

  const setGuestCustom = (guestIdx: number, amount: number) => {
    setGuests((prev) => prev.map((g, i) => i === guestIdx ? { ...g, customAmount: amount } : g));
  };

  const payGuest = async (guestIdx: number) => {
    const amount = guestAmounts[guestIdx];
    if (amount <= 0) return;
    const guest = guests[guestIdx];
    setIsProcessing(true);
    try {
      // For split: create a single order for this guest's portion if items mode, or a partial payment
      // Simplest approach: create the full order once on first payment, then mark subsequent as partial
      const isLastPayment = completedPayments.length + 1 >= guestCount;
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          customerName: customerName || guest.name,
          customerPhone,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
          notes: notes ? `${notes} (Split ${guestIdx + 1}/${guestCount})` : `Split ${guestIdx + 1}/${guestCount}`,
          subtotal: mode === "items" ? guest.itemIds.reduce((s, id) => s + (items.find((i) => i.id === id)?.totalPrice || 0), 0) : amount,
          taxAmount: mode === "items" ? tax * (subtotal > 0 ? guest.itemIds.reduce((s, id) => s + (items.find((i) => i.id === id)?.totalPrice || 0), 0) / subtotal : 0) : 0,
          deliveryFee: 0,
          tipAmount: 0,
          total: amount,
          paymentMethod: guest.method,
          paymentStatus: "paid",
          serverName,
          tableId: table?.id,
          items: mode === "items" ? items.filter((i) => guest.itemIds.includes(i.id)).map((i) => ({
            menuItemId: i.menuItemId, quantity: i.quantity, unitPrice: i.unitPrice,
            modifiers: i.modifiers, notes: i.notes, totalPrice: i.totalPrice,
          })) : [],
          estimatedReady: new Date(),
        }),
      });
      if (r.ok) {
        const { order } = await r.json();
        setCompletedPayments((prev) => [...prev, guestIdx]);
        toast.success(`${guest.name}: ${fmtCurrency(amount)} ${isRTL ? "مدفوع" : "paid"}`);
        if (isLastPayment) {
          if (table) {
            await fetch("/api/tables", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "update", id: table.id, status: "paid" }),
            });
          }
          onComplete({ orderId: order.id, orderNumber: order.orderNumber });
        }
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setIsProcessing(false);
    }
  };

  const modes: { id: SplitMode; icon: any; label: string; desc: string }[] = [
    { id: "even", icon: Divide, label: isRTL ? "تقسيم متساوي" : "Even Split", desc: isRTL ? "بالعدد" : "By count" },
    { id: "items", icon: ListOrdered, label: isRTL ? "حسب الأصناف" : "By Items", desc: isRTL ? "لكل ضيف" : "Per guest" },
    { id: "custom", icon: Users, label: isRTL ? "مبلغ مخصص" : "Custom", desc: isRTL ? "يدوي" : "Manual" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isProcessing} className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">{t.pos.splitBill}</DialogTitle>
        <DialogDescription className="sr-only">
          {fmtCurrency(total)} · {items.length} {t.pos.items || "items"}
        </DialogDescription>

        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-amber-600 text-primary-foreground p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Split className="size-5" />
              <h2 className="font-bold text-lg">{t.pos.splitBill}</h2>
            </div>
            <div className="text-end">
              <p className="text-xs opacity-80 uppercase tracking-wide">{t.pos.amountDue}</p>
              <p className="text-2xl font-bold tabular-nums">{fmtCurrency(total)}</p>
            </div>
          </div>
          {table && (
            <p className="text-xs mt-2 opacity-90">
              {t.pos.tables} #{table.number} · {items.length} {isRTL ? "صنف" : "items"}
            </p>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Mode selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {isRTL ? "طريقة التقسيم" : "Split Method"}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {modes.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`size-5 mx-auto mb-1.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-xs font-semibold">{m.label}</div>
                    <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guest count (for even mode) */}
          {mode === "even" && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/40">
              <span className="text-sm font-medium">{isRTL ? "عدد الضيوف" : "Number of Guests"}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setGuestCount((c) => Math.max(2, c - 1))} className="size-8 rounded-full border border-border hover:bg-background flex items-center justify-center">
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center font-bold text-lg">{guestCount}</span>
                <button onClick={() => setGuestCount((c) => Math.min(12, c + 1))} className="size-8 rounded-full border border-border hover:bg-background flex items-center justify-center">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Custom mode warning */}
          {mode === "custom" && (
            <div className={`p-3 rounded-xl text-xs ${customValid ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"}`}>
              {customValid ? (
                <span className="flex items-center gap-1.5"><Check className="size-3.5" /> {isRTL ? "المجموع صحيح" : "Sum matches total"}</span>
              ) : (
                <span className="flex items-center gap-1.5"><X className="size-3.5" /> {isRTL ? `الفرق: ${fmtCurrency(Math.abs(customSum - total))}` : `Difference: ${fmtCurrency(Math.abs(customSum - total))}`}</span>
              )}
            </div>
          )}

          {/* Items mode: assign items to guests */}
          {mode === "items" && (
            <div>
              {/* Guest tabs */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3">
                {guests.map((g, i) => {
                  const paid = completedPayments.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentGuest(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        currentGuest === i ? "bg-primary text-primary-foreground" : paid ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-accent"
                      }`}
                    >
                      {paid && <Check className="size-3" />}
                      {g.name}
                      {guestAmounts[i] > 0 && <span className="opacity-70">{fmtCurrency(guestAmounts[i])}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Items to assign */}
              <p className="text-xs text-muted-foreground mb-2">
                {isRTL ? "اختر الأصناف للضيف" : "Tap items to assign to"} {guests[currentGuest]?.name}
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-thin pe-1">
                {items.map((item) => {
                  const assignedTo = guests.findIndex((g) => g.itemIds.includes(item.id));
                  const isSelected = guests[currentGuest]?.itemIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id, currentGuest)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-start ${
                        isSelected ? "border-primary bg-primary/5" : assignedTo >= 0 ? "border-transparent bg-muted/30 opacity-60" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                        {isSelected && <Check className="size-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.quantity}× {isRTL ? item.nameAr : item.nameEn}</p>
                      </div>
                      {assignedTo >= 0 && !isSelected && (
                        <Badge variant="secondary" className="text-[10px]">{guests[assignedTo].name}</Badge>
                      )}
                      <span className="text-sm font-medium shrink-0">{fmtCurrency(item.totalPrice)}</span>
                    </button>
                  );
                })}
              </div>
              {unassignedItems.length > 0 && (
                <p className="text-[11px] text-amber-600 mt-2">{unassignedItems.length} {isRTL ? "صنف غير مخصص" : "items unassigned"}</p>
              )}
            </div>
          )}

          {/* Guest payment list */}
          <div className="space-y-2">
            {guests.map((g, i) => {
              const amount = guestAmounts[i];
              const paid = completedPayments.includes(i);
              return (
                <div key={i} className={`p-3 rounded-xl border ${paid ? "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-900" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {paid ? (
                        <Check className="size-4 text-green-600" />
                      ) : (
                        <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
                      )}
                      <span className="font-semibold text-sm">{g.name}</span>
                    </div>
                    <span className="font-bold text-primary">{fmtCurrency(amount)}</span>
                  </div>
                  {!paid && (
                    <div className="flex items-center gap-2">
                      {/* Method toggle for this guest */}
                      <button
                        onClick={() => setGuestMethod(i, "card")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${g.method === "card" ? "bg-primary text-primary-foreground" : "bg-accent"}`}
                      >
                        <CreditCard className="size-3" /> {t.pos.card}
                      </button>
                      <button
                        onClick={() => setGuestMethod(i, "cash")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${g.method === "cash" ? "bg-primary text-primary-foreground" : "bg-accent"}`}
                      >
                        <Banknote className="size-3" /> {t.pos.cash}
                      </button>
                      {mode === "custom" && (
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={g.customAmount || ""}
                          onChange={(e) => setGuestCustom(i, parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs w-24"
                          dir="ltr"
                        />
                      )}
                      <Button
                        size="sm"
                        className="ms-auto h-8 gap-1.5"
                        disabled={isProcessing || (mode === "items" && g.itemIds.length === 0) || (mode === "custom" && !customValid)}
                        onClick={() => payGuest(i)}
                      >
                        {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        {isRTL ? "ادفع" : "Pay"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-accent/40 text-sm">
            <span className="text-muted-foreground">{isRTL ? "تقدم الدفع" : "Payment Progress"}</span>
            <span className="font-semibold">
              {completedPayments.length} / {guests.length} {isRTL ? "مدفوع" : "paid"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
