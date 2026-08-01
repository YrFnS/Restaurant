"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Gift,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type LoyaltyEvent = {
  id: string;
  eventType: string;
  pointsDelta: number;
  balanceAfter: number;
  orderId: string | null;
  actorName: string;
  reasonCode: string | null;
  reason: string | null;
  occurredAt: string;
};

type LoyaltyAccount = {
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    loyaltyPoints: number;
    totalSpent: number;
    visits: number;
  };
  events: LoyaltyEvent[];
};

type GiftCardSummary = {
  id: string;
  reference: string;
  codeLast4: string;
  maskedCode: string;
  amount: number;
  balance: number;
  status: string;
  currency: string;
  expiresAt: string | null;
  issuedAt: string;
  purchaserName?: string;
  recipientName?: string;
};

type GiftCardTransaction = {
  id: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  actorName: string;
  reasonCode: string | null;
  reason: string | null;
  occurredAt: string;
};

type GiftCardAccount = {
  card: GiftCardSummary;
  transactions: GiftCardTransaction[];
};

const LOYALTY_REASON_CODES = [
  "service_recovery",
  "promotion",
  "migration_correction",
  "operator_error",
  "customer_support",
  "other",
] as const;

const GIFT_REASON_CODES = [
  "top_up",
  "service_recovery",
  "migration_correction",
  "operator_error",
  "fraud_suspected",
  "customer_support",
  "other",
] as const;

function idempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
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

function formatDate(value: string, isRTL: boolean): string {
  return new Intl.DateTimeFormat(isRTL ? "ar-IQ" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusText(status: string, isRTL: boolean): string {
  const labels: Record<string, [string, string]> = {
    active: ["Active", "فعالة"],
    exhausted: ["Exhausted", "مستهلكة"],
    voided: ["Voided", "ملغاة"],
    expired: ["Expired", "منتهية"],
  };
  const label = labels[status] || [status, status];
  return isRTL ? label[1] : label[0];
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with ${response.status}`);
    (error as Error & { code?: string }).code = data?.code;
    throw error;
  }
  return data as T;
}

export function LoyaltyGiftCardConsole() {
  const { isRTL } = useI18n();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const [loyaltyQuery, setLoyaltyQuery] = useState("");
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [pointsDelta, setPointsDelta] = useState("");
  const [loyaltyReasonCode, setLoyaltyReasonCode] = useState<string>(
    "customer_support"
  );
  const [loyaltyReason, setLoyaltyReason] = useState("");
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const [cardQuery, setCardQuery] = useState("");
  const [cards, setCards] = useState<GiftCardSummary[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<GiftCardAccount | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [issueAmount, setIssueAmount] = useState("50");
  const [purchaserName, setPurchaserName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [issueMessage, setIssueMessage] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [cardAction, setCardAction] = useState<"adjust" | "void">("adjust");
  const [cardAmount, setCardAmount] = useState("");
  const [cardReasonCode, setCardReasonCode] = useState<string>("customer_support");
  const [cardReason, setCardReason] = useState("");
  const [cardSaving, setCardSaving] = useState(false);

  const loadCards = useCallback(async (query = cardQuery) => {
    setCardsLoading(true);
    try {
      const data = await requestJson<{ cards: GiftCardSummary[] }>(
        `/api/gift-cards?q=${encodeURIComponent(query.trim())}&limit=100`
      );
      setCards(data.cards || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isRTL
            ? "تعذر تحميل بطاقات الهدايا"
            : "Unable to load gift cards"
      );
    } finally {
      setCardsLoading(false);
    }
  }, [cardQuery, isRTL]);

  useEffect(() => {
    void loadCards("");
  }, [loadCards]);

  const loadCard = async (cardId: string) => {
    setSelectedLoading(true);
    try {
      const data = await requestJson<GiftCardAccount>(
        `/api/gift-cards?cardId=${encodeURIComponent(cardId)}&limit=200`
      );
      setSelectedCard(data);
      setCardAction("adjust");
      setCardAmount("");
      setCardReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load card");
    } finally {
      setSelectedLoading(false);
    }
  };

  const searchLoyalty = async () => {
    const query = loyaltyQuery.trim();
    if (!query) return;
    setLoyaltyLoading(true);
    setLoyaltyAccount(null);
    try {
      const parameter = query.startsWith("+") || /^\d+$/.test(query)
        ? `phone=${encodeURIComponent(query)}`
        : `customerId=${encodeURIComponent(query)}`;
      const data = await requestJson<LoyaltyAccount>(
        `/api/loyalty?${parameter}&limit=200`
      );
      setLoyaltyAccount(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isRTL
            ? "لم يتم العثور على العميل"
            : "Customer could not be found"
      );
    } finally {
      setLoyaltyLoading(false);
    }
  };

  const adjustPoints = async () => {
    if (!loyaltyAccount) return;
    const delta = Number(pointsDelta);
    if (!Number.isInteger(delta) || delta === 0 || loyaltyReason.trim().length < 3) {
      toast.error(
        isRTL
          ? "أدخل عدداً صحيحاً غير صفري وسبباً واضحاً."
          : "Enter a non-zero whole-number adjustment and a clear reason."
      );
      return;
    }
    setLoyaltySaving(true);
    try {
      await requestJson("/api/loyalty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey("loyalty-adjust"),
        },
        body: JSON.stringify({
          customerId: loyaltyAccount.customer.id,
          pointsDelta: delta,
          reasonCode: loyaltyReasonCode,
          reason: loyaltyReason.trim(),
        }),
      });
      toast.success(isRTL ? "تم تسجيل تعديل النقاط" : "Point adjustment recorded");
      setPointsDelta("");
      setLoyaltyReason("");
      await searchLoyalty();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to adjust points");
    } finally {
      setLoyaltySaving(false);
    }
  };

  const issueCard = async () => {
    const amount = Number(issueAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !purchaserName.trim() ||
      !recipientName.trim()
    ) {
      toast.error(
        isRTL
          ? "أدخل مبلغاً صالحاً واسم المشتري والمستلم."
          : "Enter a valid amount plus purchaser and recipient names."
      );
      return;
    }
    setIssueLoading(true);
    setIssuedCode(null);
    try {
      const data = await requestJson<{
        card: GiftCardSummary;
        redemptionCode: string | null;
      }>("/api/gift-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey("gift-card-issue"),
        },
        body: JSON.stringify({
          amount,
          purchaserName: purchaserName.trim(),
          recipientName: recipientName.trim(),
          message: issueMessage.trim() || null,
          template: "classic",
        }),
      });
      setIssuedCode(data.redemptionCode);
      toast.success(isRTL ? "تم إصدار بطاقة الهدية" : "Gift card issued");
      setPurchaserName("");
      setRecipientName("");
      setIssueMessage("");
      await loadCards("");
      await loadCard(data.card.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to issue card");
    } finally {
      setIssueLoading(false);
    }
  };

  const mutateCard = async () => {
    if (!selectedCard) return;
    const amount = Number(cardAmount);
    if (
      (cardAction === "adjust" && (!Number.isFinite(amount) || amount === 0)) ||
      cardReason.trim().length < 3
    ) {
      toast.error(
        isRTL
          ? "أدخل قيمة تعديل صالحة وسبباً واضحاً."
          : "Enter a valid adjustment and a clear reason."
      );
      return;
    }
    setCardSaving(true);
    try {
      await requestJson(
        `/api/gift-cards/${encodeURIComponent(selectedCard.card.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey(`gift-card-${cardAction}`),
          },
          body: JSON.stringify({
            action: cardAction,
            ...(cardAction === "adjust" ? { amount } : {}),
            reasonCode: cardReasonCode,
            reason: cardReason.trim(),
          }),
        }
      );
      toast.success(
        cardAction === "void"
          ? isRTL
            ? "تم إلغاء الرصيد المتبقي"
            : "Remaining balance voided"
          : isRTL
            ? "تم تسجيل تعديل البطاقة"
            : "Gift-card adjustment recorded"
      );
      setCardAmount("");
      setCardReason("");
      await loadCard(selectedCard.card.id);
      await loadCards(cardQuery);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update card");
    } finally {
      setCardSaving(false);
    }
  };

  const loyaltySummary = useMemo(() => {
    if (!loyaltyAccount) return null;
    return {
      positive: loyaltyAccount.events.filter((event) => event.pointsDelta > 0).length,
      negative: loyaltyAccount.events.filter((event) => event.pointsDelta < 0).length,
    };
  }, [loyaltyAccount]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-background p-4 text-foreground lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon">
              <Link href="/admin" aria-label={isRTL ? "العودة للإدارة" : "Back to admin"}>
                <BackArrow className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <Gift className="size-6 text-primary" />
                {isRTL ? "الولاء وبطاقات الهدايا" : "Loyalty & Gift Cards"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "سجلات غير قابلة للتعديل، أرصدة دقيقة، وتصحيحات مدققة."
                  : "Immutable history, exact balances, and audited corrections."}
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void loadCards(cardQuery)} disabled={cardsLoading}>
            <RefreshCcw className={cardsLoading ? "size-4 animate-spin" : "size-4"} />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" />
                {isRTL ? "حساب ولاء العميل" : "Customer loyalty account"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="loyalty-search">
                  {isRTL ? "رقم الهاتف أو معرف العميل" : "Phone or customer ID"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="loyalty-search"
                    value={loyaltyQuery}
                    onChange={(event) => setLoyaltyQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchLoyalty();
                    }}
                    dir="ltr"
                    placeholder="+964…"
                  />
                  <Button onClick={() => void searchLoyalty()} disabled={loyaltyLoading} className="gap-2">
                    {loyaltyLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    {isRTL ? "بحث" : "Search"}
                  </Button>
                </div>
              </div>

              {loyaltyAccount && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label={isRTL ? "الرصيد" : "Balance"} value={String(loyaltyAccount.customer.loyaltyPoints)} />
                    <Metric label={isRTL ? "الزيارات" : "Visits"} value={String(loyaltyAccount.customer.visits)} />
                    <Metric label={isRTL ? "حركات إضافة" : "Credits"} value={String(loyaltySummary?.positive || 0)} />
                    <Metric label={isRTL ? "حركات خصم" : "Debits"} value={String(loyaltySummary?.negative || 0)} />
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <p className="font-semibold">{loyaltyAccount.customer.name}</p>
                    <p className="text-sm text-muted-foreground" dir="ltr">{loyaltyAccount.customer.phone}</p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <h3 className="font-semibold">{isRTL ? "تعديل مدقق" : "Audited adjustment"}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={isRTL ? "تغيير النقاط" : "Point change"}>
                        <Input value={pointsDelta} onChange={(event) => setPointsDelta(event.target.value)} type="number" dir="ltr" placeholder="100 or -100" />
                      </Field>
                      <Field label={isRTL ? "رمز السبب" : "Reason code"}>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={loyaltyReasonCode} onChange={(event) => setLoyaltyReasonCode(event.target.value)}>
                          {LOYALTY_REASON_CODES.map((code) => <option key={code} value={code}>{code.replaceAll("_", " ")}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label={isRTL ? "التوضيح" : "Explanation"}>
                      <Textarea value={loyaltyReason} onChange={(event) => setLoyaltyReason(event.target.value)} />
                    </Field>
                    <Button onClick={() => void adjustPoints()} disabled={loyaltySaving} className="gap-2">
                      {loyaltySaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      {isRTL ? "تسجيل التعديل" : "Record adjustment"}
                    </Button>
                  </div>

                  <LedgerList
                    title={isRTL ? "سجل النقاط" : "Point history"}
                    empty={isRTL ? "لا توجد حركات." : "No point events."}
                    rows={loyaltyAccount.events.map((event) => ({
                      id: event.id,
                      title: event.eventType.replaceAll("_", " "),
                      amount: `${event.pointsDelta > 0 ? "+" : ""}${event.pointsDelta}`,
                      detail: event.reason || event.reasonCode || "—",
                      date: formatDate(event.occurredAt, isRTL),
                      positive: event.pointsDelta > 0,
                    }))}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  {isRTL ? "إصدار بطاقة جديدة" : "Issue a new card"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={isRTL ? "المبلغ" : "Amount"}>
                    <Input value={issueAmount} onChange={(event) => setIssueAmount(event.target.value)} type="number" min="0.01" step="0.01" dir="ltr" />
                  </Field>
                  <Field label={isRTL ? "المشتري" : "Purchaser"}>
                    <Input value={purchaserName} onChange={(event) => setPurchaserName(event.target.value)} />
                  </Field>
                  <Field label={isRTL ? "المستلم" : "Recipient"}>
                    <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
                  </Field>
                </div>
                <Field label={isRTL ? "رسالة اختيارية" : "Optional message"}>
                  <Textarea value={issueMessage} onChange={(event) => setIssueMessage(event.target.value)} />
                </Field>
                <Button onClick={() => void issueCard()} disabled={issueLoading} className="gap-2">
                  {issueLoading ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
                  {isRTL ? "إصدار البطاقة" : "Issue card"}
                </Button>

                {issuedCode && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{isRTL ? "اعرض الرمز مرة واحدة" : "Show this code once"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {isRTL
                            ? "لا يحتفظ النظام بالرمز الكامل بعد هذه الاستجابة. سلّمه للمستلم بطريقة آمنة."
                            : "The complete code is not retained after this response. Deliver it securely to the recipient."}
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background px-3 py-2 font-mono text-sm" dir="ltr">{issuedCode}</code>
                          <Button variant="outline" className="gap-2" onClick={() => {
                            void navigator.clipboard.writeText(issuedCode);
                            toast.success(isRTL ? "تم نسخ الرمز" : "Code copied");
                          }}>
                            <Copy className="size-4" />
                            {isRTL ? "نسخ" : "Copy"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? "البحث في البطاقات" : "Gift-card directory"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") void loadCards(cardQuery);
                  }} placeholder={isRTL ? "مرجع، آخر أرقام، مشتري أو مستلم" : "Reference, last four, purchaser, or recipient"} />
                  <Button onClick={() => void loadCards(cardQuery)} disabled={cardsLoading} className="gap-2">
                    {cardsLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    {isRTL ? "بحث" : "Search"}
                  </Button>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pe-1">
                  {cards.map((card) => (
                    <button key={card.id} type="button" onClick={() => void loadCard(card.id)} className="w-full rounded-xl border border-border p-3 text-start transition-colors hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold" dir="ltr">{card.reference}</p>
                          <p className="text-xs text-muted-foreground">{card.recipientName || card.maskedCode}</p>
                        </div>
                        <div className="text-end">
                          <p className="font-semibold" dir="ltr">{formatMoney(card.balance, card.currency, isRTL)}</p>
                          <Badge variant={card.status === "active" ? "default" : "secondary"}>{statusText(card.status, isRTL)}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!cardsLoading && cards.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{isRTL ? "لا توجد بطاقات مطابقة." : "No matching cards."}</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {selectedLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="me-2 size-5 animate-spin" />
            {isRTL ? "جارٍ تحميل البطاقة" : "Loading card"}
          </div>
        )}

        {selectedCard && !selectedLoading && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle dir="ltr">{selectedCard.card.reference}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedCard.card.maskedCode}</p>
                </div>
                <div className="text-end">
                  <p className="text-2xl font-bold text-primary" dir="ltr">{formatMoney(selectedCard.card.balance, selectedCard.card.currency, isRTL)}</p>
                  <Badge variant={selectedCard.card.status === "active" ? "default" : "secondary"}>{statusText(selectedCard.card.status, isRTL)}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <LedgerList
                title={isRTL ? "سجل البطاقة" : "Card history"}
                empty={isRTL ? "لا توجد حركات." : "No card transactions."}
                rows={selectedCard.transactions.map((transaction) => ({
                  id: transaction.id,
                  title: transaction.transactionType.replaceAll("_", " "),
                  amount: `${transaction.amount > 0 ? "+" : ""}${formatMoney(transaction.amount, selectedCard.card.currency, isRTL)}`,
                  detail: transaction.reason || transaction.reasonCode || "—",
                  date: formatDate(transaction.occurredAt, isRTL),
                  positive: transaction.amount > 0,
                }))}
              />

              <div className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="font-semibold">{isRTL ? "عملية مدققة" : "Audited card operation"}</h3>
                <Field label={isRTL ? "العملية" : "Action"}>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cardAction} onChange={(event) => setCardAction(event.target.value as "adjust" | "void")}>
                    <option value="adjust">{isRTL ? "تعديل الرصيد" : "Balance adjustment"}</option>
                    <option value="void">{isRTL ? "إلغاء الرصيد المتبقي" : "Void remaining balance"}</option>
                  </select>
                </Field>
                {cardAction === "adjust" && (
                  <Field label={isRTL ? "المبلغ الموقع" : "Signed amount"}>
                    <Input value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} type="number" step="0.01" dir="ltr" placeholder="10 or -10" />
                  </Field>
                )}
                <Field label={isRTL ? "رمز السبب" : "Reason code"}>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cardReasonCode} onChange={(event) => setCardReasonCode(event.target.value)}>
                    {GIFT_REASON_CODES.map((code) => <option key={code} value={code}>{code.replaceAll("_", " ")}</option>)}
                  </select>
                </Field>
                <Field label={isRTL ? "التوضيح" : "Explanation"}>
                  <Textarea value={cardReason} onChange={(event) => setCardReason(event.target.value)} />
                </Field>
                <Button variant={cardAction === "void" ? "destructive" : "default"} onClick={() => void mutateCard()} disabled={cardSaving || selectedCard.card.status === "voided"} className="w-full gap-2">
                  {cardSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {cardAction === "void"
                    ? isRTL
                      ? "إلغاء الرصيد"
                      : "Void balance"
                    : isRTL
                      ? "تسجيل التعديل"
                      : "Record adjustment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
      <p className="text-xl font-bold text-primary" dir="ltr">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function LedgerList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    title: string;
    amount: string;
    detail: string;
    date: string;
    positive: boolean;
  }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pe-1">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium capitalize">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.date}</p>
              </div>
              <p className={row.positive ? "font-bold text-emerald-600" : "font-bold text-destructive"} dir="ltr">{row.amount}</p>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}
