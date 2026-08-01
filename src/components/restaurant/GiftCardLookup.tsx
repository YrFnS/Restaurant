"use client";

import { useState } from "react";
import { Gift, Loader2, Search, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicGiftCard = {
  reference: string;
  codeLast4: string;
  maskedCode: string;
  balance: number;
  status: string;
  currency: string;
  expiresAt: string | null;
};

function statusLabel(status: string, isRTL: boolean): string {
  const labels: Record<string, [string, string]> = {
    active: ["Active", "فعالة"],
    exhausted: ["Used", "مستخدمة"],
    voided: ["Voided", "ملغاة"],
    expired: ["Expired", "منتهية"],
  };
  const label = labels[status] || [status, status];
  return isRTL ? label[1] : label[0];
}

function formatMoney(value: number, currency: string, isRTL: boolean): string {
  try {
    return new Intl.NumberFormat(isRTL ? "ar-IQ" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function GiftCardLookup() {
  const { isRTL } = useI18n();
  const [code, setCode] = useState("");
  const [card, setCard] = useState<PublicGiftCard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const normalized = code.trim();
    if (normalized.length < 6) {
      setError(
        isRTL
          ? "أدخل رمز بطاقة صالحاً يتكون من ستة أحرف على الأقل."
          : "Enter a valid card code with at least six characters."
      );
      setCard(null);
      return;
    }

    setLoading(true);
    setError("");
    setCard(null);
    try {
      const response = await fetch("/api/gift-cards/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.code === "GIFT_CARD_NOT_FOUND"
            ? isRTL
              ? "لم يتم العثور على بطاقة فعالة بهذا الرمز."
              : "No gift card was found for that code."
            : data?.error ||
                (isRTL
                  ? "تعذر التحقق من البطاقة حالياً."
                  : "The card could not be checked right now.")
        );
      }
      setCard(data.card as PublicGiftCard);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : isRTL
            ? "تعذر التحقق من البطاقة حالياً."
            : "The card could not be checked right now."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-8 overflow-hidden border-primary/20">
      <CardHeader className="bg-primary/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="size-5 text-primary" />
          {isRTL ? "التحقق من بطاقة هدية" : "Check a gift card"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isRTL
            ? "أدخل الرمز السري الموجود على البطاقة. نعرض الرصيد والحالة فقط ولا نكشف بيانات المشتري أو المستلم."
            : "Enter the private code printed on the card. Only the balance and status are shown; purchaser and recipient details stay private."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <Label htmlFor="gift-card-code">
            {isRTL ? "رمز بطاقة الهدية" : "Gift-card code"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="gift-card-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookup();
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              className="font-mono tracking-wide"
            />
            <Button
              type="button"
              onClick={() => void lookup()}
              disabled={loading}
              className="gap-2 sm:min-w-36"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {isRTL ? "تحقق" : "Check balance"}
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {card && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-muted-foreground" dir="ltr">
                  {card.maskedCode}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                  {card.reference}
                </p>
              </div>
              <Badge variant={card.status === "active" ? "default" : "secondary"}>
                {statusLabel(card.status, isRTL)}
              </Badge>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {isRTL ? "الرصيد المتاح" : "Available balance"}
              </p>
              <p className="mt-1 text-3xl font-bold text-primary" dir="ltr">
                {formatMoney(card.balance, card.currency, isRTL)}
              </p>
            </div>
            {card.expiresAt && (
              <p className="mt-3 text-xs text-muted-foreground">
                {isRTL ? "تاريخ الانتهاء:" : "Expires:"}{" "}
                {new Intl.DateTimeFormat(isRTL ? "ar-IQ" : "en-US", {
                  dateStyle: "medium",
                }).format(new Date(card.expiresAt))}
              </p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {isRTL
              ? "لا يطلب المطعم رمز بطاقتك عبر رسالة غير موثوقة. استخدمه فقط عند الدفع أو في أداة التحقق هذه."
              : "The restaurant will not ask for your full card code in an untrusted message. Use it only at checkout or in this balance checker."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
