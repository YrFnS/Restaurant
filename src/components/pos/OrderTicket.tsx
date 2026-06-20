"use client";

import { useI18n } from "@/lib/i18n";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, ShoppingCart, Utensils, Bike, ShoppingBag,
  Table2, Send, CreditCard, StickyNote, X, Clock, Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type PosOrderItem,
  type OrderType,
  type RestaurantTable,
} from "./types";
import {
  posSubtotal, posTax, posTotal,
} from "./types";

interface OrderTicketProps {
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
  discount: number;
  tip: number;
  isSending: boolean;

  onChangeOrderType: (t: OrderType) => void;
  onIncItem: (id: string) => void;
  onDecItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onSetCustomerName: (n: string) => void;
  onSetCustomerPhone: (p: string) => void;
  onSetDeliveryAddress: (a: string) => void;
  onSetNotes: (n: string) => void;
  onSendToKitchen: () => void;
  onCharge: () => void;
  onSplitBill?: () => void;
}

export function OrderTicket(props: OrderTicketProps) {
  const {
    items, orderType, table, serverName,
    customerName, customerPhone, deliveryAddress, notes,
    taxRate, deliveryFee, discount, tip, isSending,
    onChangeOrderType, onIncItem, onDecItem, onRemoveItem, onClearAll,
    onSetCustomerName, onSetCustomerPhone, onSetDeliveryAddress, onSetNotes,
    onSendToKitchen, onCharge, onSplitBill,
  } = props;

  const { t, isRTL, fmtCurrency } = useI18n();

  const subtotal = useMemo(() => posSubtotal(items), [items]);
  const tax = useMemo(() => posTax(subtotal, taxRate), [subtotal, taxRate]);
  const total = useMemo(
    () => posTotal(subtotal, tax, orderType === "delivery" ? deliveryFee : 0, discount, tip),
    [subtotal, tax, orderType, deliveryFee, discount, tip]
  );

  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const isDineIn = orderType === "dine_in";
  const isDelivery = orderType === "delivery";
  const canSend = items.length > 0 && (!isDineIn || !!table) && (!isDelivery || deliveryAddress.trim().length > 0);

  const orderTypes: { id: OrderType; label: string; icon: React.ReactNode }[] = [
    { id: "dine_in", label: t.pos.dineIn, icon: <Utensils className="size-4" /> },
    { id: "takeout", label: t.pos.takeout, icon: <ShoppingBag className="size-4" /> },
    { id: "delivery", label: t.pos.delivery, icon: <Bike className="size-4" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header: order type + table info */}
      <div className="border-b border-border p-3 space-y-2.5">
        {/* Order type segmented control */}
        <div className="grid grid-cols-3 gap-1.5">
          {orderTypes.map((ot) => (
            <button
              key={ot.id}
              onClick={() => onChangeOrderType(ot.id)}
              className={`inline-flex flex-col items-center justify-center gap-1 h-14 rounded-lg border text-xs font-medium transition-all ${
                orderType === ot.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-accent"
              }`}
              aria-pressed={orderType === ot.id}
            >
              {ot.icon}
              <span>{ot.label}</span>
            </button>
          ))}
        </div>

        {/* Table / customer info */}
        {isDineIn && (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <Table2 className="size-4 text-amber-600 dark:text-amber-400" />
            {table ? (
              <>
                <span className="font-semibold text-sm text-amber-900 dark:text-amber-200">
                  {t.pos.tables} #{table.number}
                </span>
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  · {t.pos.capacity.replace("{n}", String(table.capacity))}
                </span>
                <button
                  className="ms-auto text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                  onClick={() => toast.info(t.pos.selectTable)}
                  aria-label={t.pos.selectTable}
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {t.pos.noTableSelected}
              </span>
            )}
          </div>
        )}

        {/* Server name */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          <span>{t.pos.server}:</span>
          <span className="font-semibold text-foreground">
            {serverName || "—"}
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10 px-6">
            <div className="size-16 rounded-2xl bg-accent flex items-center justify-center mb-3">
              <ShoppingCart className="size-8 opacity-50" />
            </div>
            <p className="font-semibold text-sm mb-3">{t.pos.noItems}</p>
            {/* Step-by-step guide */}
            <div className="space-y-1.5 text-start w-full max-w-[200px]">
              <div className="flex items-center gap-2 text-xs">
                <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${orderType === "dine_in" && !table ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1</span>
                <span>{orderType === "dine_in" ? (table ? "✓ " + t.pos.tables + " #" + table.number : t.pos.selectTable) : t.pos.orderType}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">2</span>
                <span>{isRTL ? "اختر أصناف من القائمة" : "Tap items from menu"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">3</span>
                <span>{isRTL ? "أرسل للمطبخ أو تحصّل" : "Send to kitchen or charge"}</span>
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="p-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-semibold text-sm leading-tight line-clamp-1">
                        {isRTL ? item.nameAr : item.nameEn}
                      </h4>
                      <span className="text-sm font-bold tabular-nums shrink-0">
                        {fmtCurrency(item.totalPrice)}
                      </span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {item.modifiers.map((m) => (
                          <li key={m.id} className="flex items-center gap-1.5">
                            <span className="size-1 rounded-full bg-primary/60" />
                            <span>{isRTL ? m.nameAr : m.nameEn}</span>
                            {m.price > 0 && (
                              <span className="text-primary font-medium">
                                +{fmtCurrency(m.price)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground inline-flex items-center gap-1">
                        <StickyNote className="size-3" />
                        {item.notes}
                      </p>
                    )}
                    <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {fmtCurrency(item.price)} × {item.quantity}
                    </div>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onDecItem(item.id)}
                      className="size-9 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent active:scale-95"
                      aria-label="Decrease quantity"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="size-3.5 text-destructive" />
                      ) : (
                        <Minus className="size-3.5" />
                      )}
                    </button>
                    <span className="w-8 text-center font-bold tabular-nums text-base">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onIncItem(item.id)}
                      className="size-9 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent active:scale-95"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + actions */}
      <div className="border-t border-border bg-background">
        {/* Customer fields (only show when relevant) */}
        {(isDelivery || items.length > 0) && (
          <div className="p-3 space-y-2 border-b border-border">
            {isDelivery && (
              <>
                <input
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                  placeholder={t.cart.customerName}
                  value={customerName}
                  onChange={(e) => onSetCustomerName(e.target.value)}
                  aria-label={t.cart.customerName}
                />
                <input
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                  placeholder={t.cart.customerPhone}
                  value={customerPhone}
                  onChange={(e) => onSetCustomerPhone(e.target.value)}
                  aria-label={t.cart.customerPhone}
                />
                <input
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
                  placeholder={t.cart.addressPlaceholder}
                  value={deliveryAddress}
                  onChange={(e) => onSetDeliveryAddress(e.target.value)}
                  aria-label={t.cart.deliveryAddress}
                />
              </>
            )}
            <input
              className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background"
              placeholder={t.cart.notesPlaceholder}
              value={notes}
              onChange={(e) => onSetNotes(e.target.value)}
              aria-label={t.cart.notes}
            />
          </div>
        )}

        {/* Totals */}
        <div className="p-3 space-y-1 text-sm">
          <Row label={t.cart.subtotal} value={fmtCurrency(subtotal)} />
          {discount > 0 && (
            <Row
              label={t.cart.discount}
              value={`−${fmtCurrency(discount)}`}
              className="text-emerald-600 dark:text-emerald-400"
            />
          )}
          <Row
            label={`${t.cart.tax} (${Math.round(taxRate * 100)}%)`}
            value={fmtCurrency(tax)}
          />
          {isDelivery && (
            <Row label={t.cart.deliveryFee} value={fmtCurrency(deliveryFee)} />
          )}
          {tip > 0 && <Row label={t.cart.tip} value={fmtCurrency(tip)} />}
          <div className="pt-2 border-t border-border flex items-baseline justify-between">
            <span className="font-bold">{t.cart.total}</span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {fmtCurrency(total)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-3 pt-0 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-14 text-base"
            onClick={onSendToKitchen}
            disabled={!canSend || isSending}
          >
            {isSending ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="ms-1">{t.common.loading}</span>
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span className="flex flex-col items-start leading-tight">
                  <span>{t.pos.sendToKitchen}</span>
                  {itemCount > 0 && (
                    <span className="text-[10px] font-normal opacity-70">
                      {itemCount} {itemCount === 1 ? t.orders.item : t.orders.items}
                    </span>
                  )}
                </span>
              </>
            )}
          </Button>
          <Button
            variant="default"
            size="lg"
            className="h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onCharge}
            disabled={items.length === 0 || isSending}
          >
            <CreditCard className="size-4" />
            <span className="flex flex-col items-start leading-tight">
              <span>{t.pos.charge}</span>
              <span className="text-[10px] font-normal opacity-90 tabular-nums">
                {fmtCurrency(total)}
              </span>
            </span>
          </Button>
        </div>

        {onSplitBill && items.length > 0 && (
          <div className="px-3 pb-2">
            <button
              onClick={onSplitBill}
              disabled={isSending}
              className="w-full h-10 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Split className="size-4" />
              {t.pos.splitBill}
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="px-3 pb-3 -mt-1">
            <button
              onClick={() => {
                if (confirm(t.cart.clearCartConfirm)) onClearAll();
              }}
              className="w-full text-xs text-muted-foreground hover:text-destructive py-1.5"
            >
              {t.cart.clearCart}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className={`font-medium tabular-nums ${className}`}>{value}</span>
    </div>
  );
}
