"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Banknote,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
}

interface RegisterRow {
  id: string;
  code: string;
  name: string;
  deviceId: string;
  location: string;
  isActive: boolean;
  currentSession: { id: string; status: "open" | "closed" } | null;
}

interface PaymentEventDto {
  id: string;
  eventType: "capture" | "refund" | "void" | "adjustment";
  method: string;
  status: string;
  amount: number;
  currency: string;
  actorName: string;
  originalPaymentEventId: string | null;
  reasonCode: string | null;
  reason: string | null;
  registerSessionId: string | null;
  createdAt: string;
}

interface PaymentSummary {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    total: number;
    updatedAt: string;
  };
  capture: PaymentEventDto | null;
  reversals: PaymentEventDto[];
  summary: {
    captured: number;
    reversed: number;
    remaining: number;
    canRefund: boolean;
    canVoid: boolean;
  };
}

const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);
const REASON_CODES = [
  "customer_request",
  "item_unavailable",
  "quality_issue",
  "duplicate_charge",
  "operator_error",
  "order_cancelled",
  "fraud_suspected",
  "other",
] as const;

class ApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      body?.error || "The payment request failed",
      body?.code || null
    );
  }
  return body as T;
}

function reversalKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `payment-reversal-${crypto.randomUUID()}`;
  }
  return `payment-reversal-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function paymentStatusClass(status: string): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "partially_refunded") return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "refunded") return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  if (status === "voided") return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}

export function PaymentReversalConsole() {
  const { isRTL, fmtCurrency, fmtDate, fmtTime } = useI18n();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [action, setAction] = useState<"refund" | "void">("refund");
  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState<(typeof REASON_CODES)[number]>(
    "customer_request"
  );
  const [reason, setReason] = useState("");
  const [registerId, setRegisterId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(reversalKey);

  const copy = isRTL
    ? {
        title: "استرجاع وإلغاء المدفوعات",
        subtitle:
          "سجل مالي غير قابل للتعديل للاسترجاع الجزئي والكامل وإلغاء الدفعات.",
        back: "العودة للإدارة",
        orders: "الطلبات المدفوعة",
        search: "ابحث برقم الطلب أو اسم العميل",
        noOrders: "لا توجد طلبات مالية مطابقة",
        selectOrder: "اختر طلباً لمراجعة سجل الدفع",
        paymentLedger: "سجل الدفع",
        captured: "المبلغ المحصل",
        reversed: "المبلغ المعكوس",
        remaining: "المتبقي القابل للاسترجاع",
        register: "الصندوق المفتوح",
        chooseRegister: "اختر صندوقاً مفتوحاً",
        noOpenRegister: "لا يوجد صندوق مفتوح. افتح صندوقاً من نقطة البيع أولاً.",
        refund: "استرجاع",
        void: "إلغاء الدفعة",
        amount: "مبلغ الاسترجاع",
        reasonType: "نوع السبب",
        reason: "تفاصيل السبب",
        reasonPlaceholder: "اكتب سبباً واضحاً للمراجعة والتدقيق",
        submitRefund: "تنفيذ الاسترجاع",
        submitVoid: "إلغاء الدفعة بالكامل",
        refresh: "تحديث",
        history: "سجل الأحداث",
        noHistory: "لا توجد عمليات عكس سابقة",
        managerOnly: "هذه الصفحة متاحة للمالك والمدير فقط.",
        completedVoid:
          "لا يمكن إلغاء دفعة طلب مكتمل؛ استخدم الاسترجاع بدلاً من ذلك.",
      }
    : {
        title: "Payment refunds and voids",
        subtitle:
          "An immutable financial workflow for partial refunds, full refunds, and payment voids.",
        back: "Back to admin",
        orders: "Paid orders",
        search: "Search by order number or customer",
        noOrders: "No matching financial orders",
        selectOrder: "Select an order to review its payment ledger",
        paymentLedger: "Payment ledger",
        captured: "Captured",
        reversed: "Reversed",
        remaining: "Remaining refundable",
        register: "Open register",
        chooseRegister: "Choose an open register",
        noOpenRegister: "No register is open. Open one from the POS first.",
        refund: "Refund",
        void: "Void payment",
        amount: "Refund amount",
        reasonType: "Reason category",
        reason: "Reason details",
        reasonPlaceholder: "Enter a clear reason for review and audit",
        submitRefund: "Issue refund",
        submitVoid: "Void full payment",
        refresh: "Refresh",
        history: "Event history",
        noHistory: "No previous reversals",
        managerOnly: "This page is available to owners and managers only.",
        completedVoid:
          "A completed order cannot be voided; use a refund instead.",
      };

  const staffQuery = useQuery({
    queryKey: ["payment-reversal-staff"],
    queryFn: async () =>
      responseJson<{ user: StaffUser }>(
        await fetch("/api/auth/session", { cache: "no-store" })
      ),
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["payment-reversal-orders"],
    queryFn: async () =>
      responseJson<{ orders: OrderRow[] }>(
        await fetch("/api/orders?limit=200", { cache: "no-store" })
      ),
    enabled: MANAGER_ROLES.has(staffQuery.data?.user.role || ""),
    refetchInterval: 20_000,
  });

  const registersQuery = useQuery({
    queryKey: ["payment-reversal-registers"],
    queryFn: async () =>
      responseJson<{ registers: RegisterRow[] }>(
        await fetch("/api/registers", { cache: "no-store" })
      ),
    enabled: MANAGER_ROLES.has(staffQuery.data?.user.role || ""),
    refetchInterval: 15_000,
  });

  const summaryQuery = useQuery({
    queryKey: ["payment-ledger", selectedOrderId],
    queryFn: async () =>
      responseJson<PaymentSummary>(
        await fetch(`/api/orders/${encodeURIComponent(selectedOrderId!)}/payments`, {
          cache: "no-store",
        })
      ),
    enabled: Boolean(selectedOrderId),
  });

  const financialOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (ordersQuery.data?.orders || [])
      .filter((order) =>
        ["paid", "partially_refunded", "refunded", "voided"].includes(
          order.paymentStatus
        )
      )
      .filter(
        (order) =>
          !query ||
          order.orderNumber.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query)
      );
  }, [ordersQuery.data?.orders, search]);

  const openRegisters = useMemo(
    () =>
      (registersQuery.data?.registers || []).filter(
        (register) => register.isActive && register.currentSession?.status === "open"
      ),
    [registersQuery.data?.registers]
  );

  useEffect(() => {
    if (registerId && openRegisters.some((register) => register.id === registerId)) {
      return;
    }
    setRegisterId(openRegisters[0]?.id || "");
  }, [openRegisters, registerId]);

  useEffect(() => {
    const remaining = summaryQuery.data?.summary.remaining;
    if (remaining !== undefined) setAmount(remaining.toFixed(2));
    setAction("refund");
    setReasonCode("customer_request");
    setReason("");
    setIdempotencyKey(reversalKey());
  }, [selectedOrderId, summaryQuery.data?.summary.remaining]);

  const selectedRegister = openRegisters.find(
    (register) => register.id === registerId
  );
  const managerAllowed = MANAGER_ROLES.has(staffQuery.data?.user.role || "");
  const summary = summaryQuery.data;

  async function submitReversal() {
    if (!selectedOrderId || !selectedRegister || !reason.trim()) return;
    const numericAmount = Number(amount);
    if (action === "refund" && (!Number.isFinite(numericAmount) || numericAmount <= 0)) {
      toast.error(isRTL ? "أدخل مبلغ استرجاع صحيح" : "Enter a valid refund amount");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(selectedOrderId)}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "X-Register-Id": selectedRegister.id,
            "X-Register-Device-Id": selectedRegister.deviceId,
          },
          body: JSON.stringify({
            action,
            ...(action === "refund" ? { amount: numericAmount } : {}),
            reasonCode,
            reason: reason.trim(),
          }),
        }
      );
      const result = await responseJson<PaymentSummary & { replayed: boolean }>(
        response
      );

      toast.success(
        action === "void"
          ? isRTL
            ? "تم إلغاء الدفعة"
            : "Payment voided"
          : isRTL
            ? "تم تنفيذ الاسترجاع"
            : "Refund recorded"
      );
      queryClient.setQueryData(["payment-ledger", selectedOrderId], result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payment-reversal-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["payment-reversal-registers"] }),
        queryClient.invalidateQueries({ queryKey: ["orders", "admin"] }),
      ]);
      setReason("");
      setIdempotencyKey(reversalKey());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment reversal failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (staffQuery.isPending) {
    return <FullPageLoading />;
  }

  if (!managerAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldAlert className="size-10 mx-auto text-destructive" />
            <p className="font-semibold">{copy.managerOnly}</p>
            <Button asChild variant="outline">
              <Link href="/admin">{copy.back}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin" className="gap-1.5">
              <BackIcon className="size-4" />
              {copy.back}
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold truncate">{copy.title}</h1>
            <p className="text-xs text-muted-foreground truncate">{copy.subtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void ordersQuery.refetch();
              void registersQuery.refetch();
              void summaryQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">{copy.refresh}</span>
          </Button>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-4 lg:p-6 grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              {copy.orders}
            </CardTitle>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.search}
                className="ps-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[calc(100vh-190px)] overflow-y-auto">
            {ordersQuery.isPending ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : financialOrders.length === 0 ? (
              <p className="p-8 text-sm text-center text-muted-foreground">
                {copy.noOrders}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {financialOrders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-start p-4 hover:bg-muted/50 transition-colors ${
                      selectedOrderId === order.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-bold">
                        {order.orderNumber}
                      </span>
                      <Badge className={paymentStatusClass(order.paymentStatus)}>
                        {order.paymentStatus.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm font-medium truncate">
                      {order.customerName || "—"}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
                      </span>
                      <span className="font-semibold text-foreground">
                        {fmtCurrency(order.total)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!selectedOrderId ? (
          <Card className="min-h-[420px] flex items-center justify-center">
            <CardContent className="text-center text-muted-foreground space-y-3">
              <Receipt className="size-10 mx-auto opacity-50" />
              <p>{copy.selectOrder}</p>
            </CardContent>
          </Card>
        ) : summaryQuery.isPending ? (
          <Card className="min-h-[420px] flex items-center justify-center">
            <Loader2 className="size-6 animate-spin" />
          </Card>
        ) : summaryQuery.isError || !summary ? (
          <Card>
            <CardContent className="p-8 text-center text-destructive">
              {summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Unable to load payment ledger"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-mono">
                      {summary.order.orderNumber}
                    </CardTitle>
                    <CardDescription>{copy.paymentLedger}</CardDescription>
                  </div>
                  <Badge className={paymentStatusClass(summary.order.paymentStatus)}>
                    {summary.order.paymentStatus.replaceAll("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Metric label={copy.captured} value={fmtCurrency(summary.summary.captured)} />
                <Metric label={copy.reversed} value={fmtCurrency(summary.summary.reversed)} />
                <Metric label={copy.remaining} value={fmtCurrency(summary.summary.remaining)} />
              </CardContent>
            </Card>

            {(summary.summary.canRefund || summary.summary.canVoid) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <RotateCcw className="size-4 text-primary" />
                    {copy.refund} / {copy.void}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={action === "refund" ? "default" : "outline"}
                      onClick={() => setAction("refund")}
                      disabled={!summary.summary.canRefund}
                    >
                      <RotateCcw className="size-4" />
                      {copy.refund}
                    </Button>
                    <Button
                      type="button"
                      variant={action === "void" ? "destructive" : "outline"}
                      onClick={() => setAction("void")}
                      disabled={!summary.summary.canVoid}
                    >
                      <Ban className="size-4" />
                      {copy.void}
                    </Button>
                  </div>

                  {action === "void" && summary.order.status === "completed" && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {copy.completedVoid}
                    </p>
                  )}

                  <label className="space-y-1.5 block">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Banknote className="size-4" />
                      {copy.register}
                    </span>
                    <select
                      value={registerId}
                      onChange={(event) => setRegisterId(event.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{copy.chooseRegister}</option>
                      {openRegisters.map((register) => (
                        <option key={register.id} value={register.id}>
                          {register.code} · {register.name}
                          {register.location ? ` · ${register.location}` : ""}
                        </option>
                      ))}
                    </select>
                    {openRegisters.length === 0 && (
                      <span className="text-xs text-destructive">
                        {copy.noOpenRegister}
                      </span>
                    )}
                  </label>

                  {action === "refund" && (
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium">{copy.amount}</span>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={summary.summary.remaining}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </label>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 block">
                      <span className="text-sm font-medium">{copy.reasonType}</span>
                      <select
                        value={reasonCode}
                        onChange={(event) =>
                          setReasonCode(
                            event.target.value as (typeof REASON_CODES)[number]
                          )
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {REASON_CODES.map((code) => (
                          <option key={code} value={code}>
                            {code.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 block sm:col-span-2">
                      <span className="text-sm font-medium">{copy.reason}</span>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={copy.reasonPlaceholder}
                        rows={3}
                        maxLength={1000}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                      />
                    </label>
                  </div>

                  <Button
                    type="button"
                    onClick={() => void submitReversal()}
                    disabled={
                      submitting ||
                      !selectedRegister ||
                      reason.trim().length < 3 ||
                      (action === "refund" && Number(amount) <= 0) ||
                      (action === "void" && !summary.summary.canVoid)
                    }
                    className={action === "void" ? "w-full" : "w-full"}
                    variant={action === "void" ? "destructive" : "default"}
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : action === "void" ? (
                      <Ban className="size-4" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    {action === "void" ? copy.submitVoid : copy.submitRefund}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{copy.history}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.capture && <EventRow event={summary.capture} fmtCurrency={fmtCurrency} />}
                {summary.reversals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noHistory}</p>
                ) : (
                  summary.reversals.map((event) => (
                    <EventRow key={event.id} event={event} fmtCurrency={fmtCurrency} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EventRow({
  event,
  fmtCurrency,
}: {
  event: PaymentEventDto;
  fmtCurrency: (value: number) => string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 flex items-start gap-3">
      <div
        className={`size-9 rounded-full flex items-center justify-center shrink-0 ${
          event.eventType === "capture"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40"
            : event.eventType === "void"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40"
              : "bg-blue-100 text-blue-700 dark:bg-blue-950/40"
        }`}
      >
        {event.eventType === "capture" ? (
          <Receipt className="size-4" />
        ) : event.eventType === "void" ? (
          <Ban className="size-4" />
        ) : (
          <RotateCcw className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold capitalize">
            {event.eventType.replaceAll("_", " ")}
          </span>
          <span className="font-bold tabular-nums">{fmtCurrency(event.amount)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(event.createdAt).toLocaleString()} · {event.actorName || "System"}
        </p>
        {event.reason && (
          <p className="text-sm mt-2">
            <span className="text-muted-foreground">
              {(event.reasonCode || "reason").replaceAll("_", " ")}: {" "}
            </span>
            {event.reason}
          </p>
        )}
      </div>
    </div>
  );
}

function FullPageLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}
