"use client";

import React from "react";
import { DollarSign, Banknote, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface PaymentPanelProps {
  open: boolean;
  total: number;
  subtotal: number;
  taxAmount: number;
  currencySym: string;
  paymentMethod: string;
  cashTendered: string;
  storeSettings: { tipPresets?: string } | null;
  onPaymentMethodChange: (v: string) => void;
  onCashTenderedChange: (v: string) => void;
  onTipChange: (v: number) => void;
  onComplete: () => void;
  onClose: () => void;
}

export function PaymentPanel({
  open, total, subtotal, taxAmount, currencySym,
  paymentMethod, cashTendered, storeSettings,
  onPaymentMethodChange, onCashTenderedChange, onTipChange,
  onComplete, onClose,
}: PaymentPanelProps) {
  const { t } = useI18n();
  const change = parseFloat(cashTendered) - total;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> {t.pos.processPayment}</DialogTitle>
          <DialogDescription>{t.pos.total}: <span className="font-bold text-foreground">{currencySym}{total.toFixed(2)}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {[
              { value: "cash", icon: Banknote, labelKey: "cash" as const },
              { value: "card", icon: CreditCard, labelKey: "card" as const },
            ].map((pm) => (
              <button key={pm.value} onClick={() => onPaymentMethodChange(pm.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-colors ${paymentMethod === pm.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-muted"}`}
              >
                <pm.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{t.pos[pm.labelKey]}</span>
              </button>
            ))}
          </div>
          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Label>{t.pos.amountTendered}</Label>
              <Input type="number" step="0.01" value={cashTendered} onChange={(e) => onCashTenderedChange(e.target.value)} className="text-xl h-12" placeholder="0.00" />
              <div className="flex gap-2 flex-wrap">
                {[total, Math.ceil(total), Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, 50, 100].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((amt) => (
                  <Button key={amt} variant="outline" size="sm" onClick={() => onCashTenderedChange(amt.toFixed(2))}>{currencySym}{amt.toFixed(2)}</Button>
                ))}
              </div>
              {parseFloat(cashTendered) >= total && <div className="text-lg font-semibold text-emerald-600">{t.pos.change}: {currencySym}{(parseFloat(cashTendered) - total).toFixed(2)}</div>}
            </div>
          )}
          {paymentMethod === "card" && (
            <div className="space-y-2">
              <Label>{t.pos.addTip}</Label>
              <div className="flex gap-2">
                {(storeSettings?.tipPresets ? storeSettings.tipPresets.split(",").map(Number).filter((n) => !isNaN(n) && n > 0) : []).map((pct) => (
                  <Button key={pct} variant="outline" size="sm" onClick={() => onTipChange(parseFloat(((subtotal + taxAmount) * pct / 100).toFixed(2)))}>{pct}%</Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={onComplete} disabled={paymentMethod === "cash" && parseFloat(cashTendered) < total}>
            {t.pos.completePayment}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
