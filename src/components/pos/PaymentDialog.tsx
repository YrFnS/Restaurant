"use client";

import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Banknote, CreditCard, Delete, Check, Loader2, Receipt, HandCoins,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type PaymentMethod,
  type PosOrderItem,
  type RestaurantTable,
  type OrderType,
} from "./types";
import { posSubtotal, posTax, posTotal } from "./types";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pos-payment-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

interface PaymentDialogProps {
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
  /** After order is created and payment marked, hand control back to parent */
  onComplete: (result: {
    orderId: string;
    orderNumber: string;
    method: PaymentMethod;
    tendered: number;
    change: number;
  }) => void;
}

export function PaymentDialog(props: PaymentDialogProps) {
  const {
    open, onOpenChange, items, orderType, table,
    serverName, customerName, customerPhone, deliveryAddress, notes,
    taxRate, deliveryFee, tip, onComplete,
  } = props;

  const { t, isRTL, fmtCurrency } = useI18n();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tenderedStr, setTenderedStr] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTenderedStr("");
      setIsProcessing(false);
      idempotencyKeyRef.current = null;
    }
  }, [open]);

  const subtotal = useMemo(() => posSubtotal(items), [items]);
  const tax = useMemo(() => posTax(subtotal, taxRate), [subtotal, taxRate]);
  const total = useMemo(
    () => posTotal(subtotal, tax, orderType === "delivery" ? deliveryFee : 0, 0, tip),
    [subtotal, tax, orderType, deliveryFee, tip]
  );

  const tendered = method === "cash" ? parseFloat(tenderedStr || "0") || 0 : total;
  const change = method === "cash" ? Math.max(0, tendered - total) : 0;
  const canComplete = method === "card" || tendered >= total;

  const quickCash = [
    total,
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 20) * 20,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v > 0).slice(0, 5);

  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

  const pressKey = (k: string) => {
    if (k === "del") {
      setTenderedStr((s) => s.slice(0, -1));
      return;
    }
    if (k === "." && tenderedStr.includes(".")) return;
    if (tenderedStr === "0" && k !== ".") {
      setTenderedStr(k);
      return;
    }
    if (tenderedStr.length >= 8) return;
    setTenderedStr((s) => s + k);
  };

  async function handleComplete() {
    if (!canComplete || isProcessing) return;
    if (method === "card") {
      toast.error(
        isRTL
          ? "الدفع بالبطاقة معطل حتى يتم ربط مزود دفع"
          : "Card payment is disabled until a payment processor is configured"
      );
      return;
    }
    if (orderType === "dine_in" && !table) {
      toast.error(t.pos.noTableSelected);
      return;
    }
    if (orderType === "delivery" && (!deliveryAddress.trim() || !customerPhone.trim())) {
      toast.error(t.cart.deliveryAddress);
      return;
    }

    setIsProcessing(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const orderPayload = {
        type: orderType,
        customerName:
          customerName || (table ? `Table ${table.number}` : "Walk-in"),
        customerPhone,
        deliveryAddress:
          orderType === "delivery" ? deliveryAddress : null,
        tableNumber: orderType === "dine_in" ? table?.number : undefined,
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
      };

      const createResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(orderPayload),
      });
      const createData = await createResponse.json().catch(() => null);
      if (!createResponse.ok || !createData?.order) {
        throw new Error(createData?.error || t.common.error);
      }

      const checkoutResponse = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: createData.order.id,
          paymentMethod: "cash",
          tendered,
        }),
      });
      const checkoutData = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok || !checkoutData?.order || !checkoutData?.payment) {
        throw new Error(checkoutData?.error || t.common.error);
      }

      idempotencyKeyRef.current = null;
      toast.success(`${t.pos.saleCompleted} ${checkoutData.order.orderNumber}`, {
        description:
          checkoutData.payment.change > 0
            ? `${t.pos.change}: ${fmtCurrency(checkoutData.payment.change)}`
            : undefined,
      });

      onComplete({
        orderId: checkoutData.order.id,
        orderNumber: checkoutData.order.orderNumber,
        method: "cash",
        tendered: checkoutData.payment.tendered,
        change: checkoutData.payment.change,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setIsProcessing(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={!isProcessing}
        className="sm:max-w-md p-0 overflow-hidden gap-0"
      >
        <DialogTitle className="sr-only">{t.pos.payment}</DialogTitle>
        <DialogDescription className="sr-only">
          {t.pos.amountDue}: {fmtCurrency(total)}
        </DialogDescription>

        {/* Amount due banner */}
        <div className="bg-gradient-to-br from-primary to-amber-600 text-primary-foreground p-5 text-center">
          <p className="text-xs uppercase tracking-wide opacity-80 font-medium">
            {t.pos.amountDue}
          </p>
          <p className="text-4xl font-bold tabular-nums mt-1">{fmtCurrency(total)}</p>
          {table && (
            <p className="text-xs mt-1 opacity-90">
              {t.pos.tables} #{table.number}
              {serverName ? ` · ${serverName}` : ""}
            </p>
          )}
        </div>

        {/* Method toggle */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <MethodButton
            active={method === "cash"}
            onClick={() => setMethod("cash")}
            icon={<Banknote className="size-5" />}
            label={t.pos.cash}
          />
          <MethodButton
            active={false}
            onClick={() =>
              toast.error(
                isRTL
                  ? "الدفع بالبطاقة غير متاح حالياً"
                  : "Card payment is not available yet"
              )
            }
            icon={<CreditCard className="size-5" />}
            label={`${t.pos.card} · ${isRTL ? "غير متاح" : "Unavailable"}`}
          />
        </div>

        {method === "cash" ? (
          <>
            {/* Quick cash chips */}
            <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
              {quickCash.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTenderedStr(amt.toFixed(2))}
                  className="px-3 h-9 rounded-md border border-border bg-background text-sm font-semibold hover:bg-accent hover:border-primary tabular-nums"
                >
                  {fmtCurrency(amt)}
                </button>
              ))}
              <button
                onClick={() => setTenderedStr(total.toFixed(2))}
                className="px-3 h-9 rounded-md border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 tabular-nums"
              >
                {t.pos.amountDue}
              </button>
            </div>

            {/* Tendered display */}
            <div className="px-4 pb-3 grid grid-cols-2 gap-3 items-center">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {t.pos.amountTendered}
                </p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">
                  {fmtCurrency(tendered)}
                </p>
              </div>
              <div
                className={`rounded-lg p-3 text-center border-2 ${
                  change > 0
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                    : "bg-muted/50 border-transparent"
                }`}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {t.pos.change}
                </p>
                <p className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-300">
                  {fmtCurrency(change)}
                </p>
              </div>
            </div>

            {/* Numeric keypad */}
            <div className="px-4 pb-4 grid grid-cols-3 gap-2">
              {keypad.map((k) => (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  className={`h-14 rounded-lg text-xl font-bold tabular-nums border transition-all active:scale-95 ${
                    k === "del"
                      ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                      : "bg-background border-border hover:bg-accent"
                  }`}
                  aria-label={k === "del" ? "Delete" : k}
                >
                  {k === "del" ? <Delete className="size-5 mx-auto" /> : k}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center bg-muted/30">
              <CreditCard className="size-12 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t.pos.card} · {t.pos.completeSale}
              </p>
              <p className="text-xl font-bold mt-1 tabular-nums">{fmtCurrency(total)}</p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="p-4 pt-0 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-14"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {t.common.cancel}
          </Button>
          <Button
            size="lg"
            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleComplete}
            disabled={!canComplete || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span className="ms-1">{t.common.loading}</span>
              </>
            ) : method === "cash" ? (
              <>
                <HandCoins className="size-5" />
                <span className="ms-1">{t.pos.completeSale}</span>
              </>
            ) : (
              <>
                <Check className="size-5" />
                <span className="ms-1">{t.pos.completeSale}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MethodButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center gap-1 h-16 rounded-lg border-2 transition-all active:scale-95 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-foreground border-border hover:bg-accent"
      }`}
      aria-pressed={active}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

// Receipt-style confirmation dialog after sale completes
export function ReceiptDialog({
  open, onOpenChange, orderNumber, total, method, change,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  total: number;
  method: PaymentMethod;
  change: number;
}) {
  const { t, fmtCurrency } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden text-center" showCloseButton>
        <DialogTitle className="sr-only">{t.pos.saleCompleted}</DialogTitle>
        <div className="p-6">
          <div className="mx-auto mb-4 size-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <Check className="size-9 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold">{t.pos.saleCompleted}</h2>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Receipt className="size-3.5" />
            {orderNumber}
          </p>
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.cart.total}</span>
              <span className="font-semibold tabular-nums">{fmtCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.orders.paymentMethod}</span>
              <span className="font-semibold">
                {method === "cash" ? t.pos.cash : t.pos.card}
              </span>
            </div>
            {method === "cash" && change > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{t.pos.change}</span>
                <span className="font-bold tabular-nums">{fmtCurrency(change)}</span>
              </div>
            )}
          </div>
          <Button
            className="w-full mt-5 h-12"
            onClick={() => onOpenChange(false)}
          >
            {t.common.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
