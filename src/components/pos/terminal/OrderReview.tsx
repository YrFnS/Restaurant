"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Plus, Minus, Trash2, Pause,
  CreditCard, StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";

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

interface MenuItemData {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  isAvailable: boolean;
  image: string;
  preparationTime: number;
  modifiers: ModifierData[];
}

interface ModifierData {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
  price: number;
}

interface ModifierDialogProps {
  selectedItem: MenuItemData | null;
  modifierDialogOpen: boolean;
  selectedVariant: string;
  selectedAddons: string[];
  modifierNotes: string;
  modifierSeat: number | null;
  modifierHold: boolean;
  currencySym: string;
  onVariantChange: (v: string) => void;
  onAddonToggle: (id: string) => void;
  onNotesChange: (v: string) => void;
  onSeatChange: (v: number | null) => void;
  onHoldChange: (v: boolean) => void;
  onAdd: () => void;
  onClose: () => void;
}

function ModifierDialog({
  selectedItem, modifierDialogOpen, selectedVariant, selectedAddons,
  modifierNotes, modifierSeat, modifierHold, currencySym,
  onVariantChange, onAddonToggle, onNotesChange, onSeatChange, onHoldChange,
  onAdd, onClose,
}: ModifierDialogProps) {
  const { t, locale } = useI18n();

  const itemName = (item: { nameEn: string; nameAr: string }) =>
    locale === "ar" ? item.nameAr : item.nameEn;

  if (!selectedItem) return null;

  return (
    <Sheet open={modifierDialogOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{itemName(selectedItem)} <Badge variant="outline">{currencySym}{selectedItem.price.toFixed(2)}</Badge></SheetTitle>
          <SheetDescription>{t.pos.chooseOption}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {/* Variants */}
          {selectedItem.modifiers.filter((m) => m.type === "variant").length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t.pos.chooseOption}</Label>
              <RadioGroup value={selectedVariant} onValueChange={onVariantChange}>
                {selectedItem.modifiers.filter((m) => m.type === "variant").map((v) => (
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
          {selectedItem.modifiers.filter((m) => m.type === "addon").length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t.pos.addons}</Label>
              {selectedItem.modifiers.filter((m) => m.type === "addon").map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent/50">
                  <Checkbox id={`a-${a.id}`} checked={selectedAddons.includes(a.id)} onCheckedChange={() => onAddonToggle(a.id)} />
                  <Label htmlFor={`a-${a.id}`} className="flex-1 cursor-pointer text-sm">{itemName(a)}</Label>
                  {a.price > 0 && <span className="text-sm text-muted-foreground">+{currencySym}{a.price.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          )}
          <div><Label>{t.pos.specialNotes}</Label><Input value={modifierNotes} onChange={(e) => onNotesChange(e.target.value)} placeholder={t.pos.specialNotes} /></div>
          <div><Label>{t.pos.seatNumber}</Label>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                <Button key={s} variant={modifierSeat === s ? "default" : "outline"} size="sm" className="min-w-[36px] h-9" onClick={() => onSeatChange(modifierSeat === s ? null : s)}>{s}</Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex items-center gap-2"><Pause className="h-4 w-4 text-amber-500" /><Label>{t.pos.holdItem}</Label></div>
            <input type="checkbox" checked={modifierHold} onChange={(e) => onHoldChange(e.target.checked)} className="h-4 w-4" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>{t.common.cancel}</Button>
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={onAdd}>{t.pos.addToCart}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface OrderReviewProps {
  cart: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  discountPercent: number;
  currencySym: string;
  orderNotes: string;
  selectedItem: MenuItemData | null;
  modifierDialogOpen: boolean;
  selectedVariant: string;
  selectedAddons: string[];
  modifierNotes: string;
  modifierSeat: number | null;
  modifierHold: boolean;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onDiscountPercentChange: (v: number) => void;
  onTipAmountChange: (v: number) => void;
  onOrderNotesChange: (v: string) => void;
  onPay: () => void;
  onVariantChange: (v: string) => void;
  onAddonToggle: (id: string) => void;
  onModifierNotesChange: (v: string) => void;
  onModifierSeatChange: (v: number | null) => void;
  onModifierHoldChange: (v: boolean) => void;
  onModifierAdd: () => void;
  onModifierClose: () => void;
}

export function OrderReview({
  cart, subtotal, taxAmount, discountAmount, tipAmount, total,
  discountPercent, currencySym, orderNotes,
  selectedItem, modifierDialogOpen, selectedVariant, selectedAddons,
  modifierNotes, modifierSeat, modifierHold,
  onUpdateQuantity, onRemoveItem, onClearCart,
  onDiscountPercentChange, onTipAmountChange, onOrderNotesChange,
  onPay, onVariantChange, onAddonToggle, onModifierNotesChange,
  onModifierSeatChange, onModifierHoldChange, onModifierAdd, onModifierClose,
}: OrderReviewProps) {
  const { t } = useI18n();

  return (
    <>
      {/* Cart Panel */}
      <div className="w-full lg:w-96 border-s border-border bg-card flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> {t.pos.createOrder}</h2>
            {cart.length > 0 && <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={onClearCart}>{t.pos.clearOrder}</Button>}
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
                    {item.modifiers.length > 0 && <p className="text-xs text-muted-foreground">{item.modifiers.join(", ")}</p>}
                    {item.notes && <p className="text-xs text-amber-600 italic">{item.notes}</p>}
                    {item.seatNumber && <Badge className="text-[10px] px-1 py-0 bg-zinc-200 text-zinc-700">{t.pos.seatNumber} {item.seatNumber}</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onUpdateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onUpdateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="text-end">
                    <span className="text-sm font-bold">{currencySym}{(item.price * item.quantity).toFixed(2)}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400 hover:text-red-600 block" onClick={() => onRemoveItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
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
                <Input type="number" className="w-14 h-7 text-xs" value={discountPercent || ""} onChange={(e) => onDiscountPercentChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs">{t.pos.tip} {currencySym}</Label>
                <Input type="number" step="0.5" className="w-14 h-7 text-xs" value={tipAmount || ""} onChange={(e) => onTipAmountChange(Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 h-11 text-base font-bold" onClick={onPay}>
                <CreditCard className="h-4 w-4 me-1" /> {t.pos.pay} {currencySym}{total.toFixed(2)}
              </Button>
            </div>
            <Input placeholder={t.pos.orderNotes} value={orderNotes} onChange={(e) => onOrderNotesChange(e.target.value)} className="h-8 text-xs" />
          </div>
        )}
      </div>

      {/* Modifier Dialog */}
      <ModifierDialog
        selectedItem={selectedItem} modifierDialogOpen={modifierDialogOpen}
        selectedVariant={selectedVariant} selectedAddons={selectedAddons}
        modifierNotes={modifierNotes} modifierSeat={modifierSeat} modifierHold={modifierHold}
        currencySym={currencySym}
        onVariantChange={onVariantChange} onAddonToggle={onAddonToggle}
        onNotesChange={onModifierNotesChange} onSeatChange={onModifierSeatChange}
        onHoldChange={onModifierHoldChange} onAdd={onModifierAdd} onClose={onModifierClose}
      />
    </>
  );
}
