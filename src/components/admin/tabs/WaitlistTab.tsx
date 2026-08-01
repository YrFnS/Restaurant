"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Armchair,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { AdminLoading, apiFetch, EmptyState } from "../shared";

interface WaitlistPolicy {
  enabled: boolean;
  isOpenNow: boolean;
  timezone: string;
  minPartySize: number;
  maxPartySize: number;
  averageTurnoverMinutes: number;
  notificationExpiryMinutes: number;
  requireConfirmation: boolean;
}

interface WaitlistEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  estimatedWait: number;
  estimatedSeatAt: string | null;
  estimateCalculatedAt: string | null;
  preference: string | null;
  notes: string | null;
  tableId: string | null;
  table: {
    number: number;
    capacity: number;
    section: string;
  } | null;
  notifiedAt: string | null;
  notificationExpiresAt: string | null;
  notificationConfirmedAt: string | null;
  seatedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WaitlistResponse {
  entries: WaitlistEntry[];
  activeCount: number;
  waitingCount: number;
  notifiedCount: number;
  confirmedCount: number;
  expiredCount: number;
  policy: WaitlistPolicy;
}

interface EditablePolicy {
  enabled: boolean;
  averageTurnoverMinutes: number;
  notificationExpiryMinutes: number;
  estimatePaddingMinutes: number;
  maxQuoteMinutes: number;
  requireConfirmation: boolean;
}

const WAITLIST_STATUS_META: Record<
  WaitlistEntry["status"],
  { en: string; ar: string; cls: string }
> = {
  waiting: {
    en: "Waiting",
    ar: "بانتظار",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  notified: {
    en: "Notified",
    ar: "تم الإشعار",
    cls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  seated: {
    en: "Seated",
    ar: "تم الجلوس",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelled: {
    en: "Cancelled",
    ar: "ملغى",
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  no_show: {
    en: "No show",
    ar: "لم يحضر",
    cls: "bg-slate-200 text-slate-800 border-slate-300",
  },
};

function formatTime(value: string | null, timezone: string, locale: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function formatDateTime(value: string | null, timezone: string, locale: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function WaitlistTab() {
  const { isRTL, locale } = useI18n();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState("active");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [policyForm, setPolicyForm] = useState<EditablePolicy | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery<WaitlistResponse>({
    queryKey: ["waitlist", "admin", scope],
    queryFn: () =>
      apiFetch(
        `/api/waitlist?admin=true&scope=${encodeURIComponent(
          scope
        )}&limit=300`
      ),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!query.data?.policy || policyForm) return;
    setPolicyForm({
      enabled: query.data.policy.enabled,
      averageTurnoverMinutes: query.data.policy.averageTurnoverMinutes,
      notificationExpiryMinutes:
        query.data.policy.notificationExpiryMinutes,
      estimatePaddingMinutes: 5,
      maxQuoteMinutes: 240,
      requireConfirmation: query.data.policy.requireConfirmation,
    });
  }, [policyForm, query.data?.policy]);

  const policy = query.data?.policy;
  const entries = useMemo(() => {
    let result = query.data?.entries || [];
    if (statusFilter !== "all") {
      result = result.filter((entry) => entry.status === statusFilter);
    }
    const needle = search.trim().toLowerCase();
    if (needle) {
      result = result.filter(
        (entry) =>
          entry.customerName.toLowerCase().includes(needle) ||
          entry.customerPhone.includes(needle) ||
          entry.table?.number.toString() === needle
      );
    }
    return result;
  }, [query.data?.entries, search, statusFilter]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch("/api/waitlist", { method: "PUT" });
      await queryClient.invalidateQueries({ queryKey: ["waitlist", "admin"] });
      toast.success(
        isRTL ? "تم تحديث التقديرات" : "Wait estimates refreshed"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const mutate = async (
    entry: WaitlistEntry,
    action: "notify" | "confirm" | "seat" | "cancel" | "no_show"
  ) => {
    const key = `${entry.id}:${action}`;
    setBusyAction(key);
    try {
      await apiFetch(`/api/waitlist/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          ...(action === "cancel" || action === "no_show"
            ? {
                reason:
                  action === "cancel"
                    ? "Updated by the host console"
                    : "Marked as no-show by the host",
              }
            : {}),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["waitlist", "admin"] });
      toast.success(
        isRTL
          ? action === "notify"
            ? "تم إشعار العميل وحجز الطاولة مؤقتاً"
            : action === "confirm"
              ? "تم تأكيد الحضور"
              : action === "seat"
                ? "تم جلوس المجموعة"
                : action === "cancel"
                  ? "تم إلغاء الإدخال"
                  : "تم تسجيل عدم الحضور"
          : action === "notify"
            ? "Guest notified and table held"
            : action === "confirm"
              ? "Arrival confirmed"
              : action === "seat"
                ? "Party seated"
                : action === "cancel"
                  ? "Entry cancelled"
                  : "No-show recorded"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  };

  const savePolicy = async () => {
    if (!policyForm) return;
    setSavingPolicy(true);
    try {
      const result = await apiFetch("/api/waitlist/settings", {
        method: "PATCH",
        body: JSON.stringify(policyForm),
      });
      setPolicyForm({
        enabled: result.policy.enabled,
        averageTurnoverMinutes: result.policy.averageTurnoverMinutes,
        notificationExpiryMinutes: result.policy.notificationExpiryMinutes,
        estimatePaddingMinutes: policyForm.estimatePaddingMinutes,
        maxQuoteMinutes: policyForm.maxQuoteMinutes,
        requireConfirmation: result.policy.requireConfirmation,
      });
      await queryClient.invalidateQueries({ queryKey: ["waitlist", "admin"] });
      toast.success(isRTL ? "تم حفظ سياسة الانتظار" : "Waitlist policy saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  if (query.isLoading) {
    return <AdminLoading label={isRTL ? "جاري تحميل قائمة الانتظار" : "Loading waitlist"} />;
  }

  const stats = [
    {
      label: isRTL ? "نشط" : "Active",
      value: query.data?.activeCount || 0,
      icon: <Users className="size-4" />,
    },
    {
      label: isRTL ? "بانتظار" : "Waiting",
      value: query.data?.waitingCount || 0,
      icon: <Hourglass className="size-4" />,
    },
    {
      label: isRTL ? "تم الإشعار" : "Notified",
      value: query.data?.notifiedCount || 0,
      icon: <Bell className="size-4" />,
    },
    {
      label: isRTL ? "تم التأكيد" : "Confirmed",
      value: query.data?.confirmedCount || 0,
      icon: <UserCheck className="size-4" />,
    },
  ];

  return (
    <div className="space-y-5 max-w-[1600px]">
      <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Hourglass className="size-5 text-primary" />
            {isRTL ? "إدارة قائمة الانتظار" : "Waitlist Operations"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "تقديرات مبنية على الطاولات والحجوزات مع حجوزات إشعار مؤقتة"
              : "Capacity-derived quotes, table holds, confirmation, and seating"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={policy?.isOpenNow ? "default" : "secondary"}>
            {policy?.enabled && policy?.isOpenNow
              ? isRTL
                ? "مفتوحة الآن"
                : "Open now"
              : isRTL
                ? "مغلقة"
                : "Closed"}
          </Badge>
          <Badge variant="outline">{policy?.timezone || "UTC"}</Badge>
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                {stat.icon}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="text-xl font-bold">{stat.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_330px] gap-5 items-start">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isRTL
                  ? "بحث بالاسم أو الهاتف أو رقم الطاولة"
                  : "Search name, phone, or table"
              }
              className="md:flex-1"
            />
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  {isRTL ? "النشط" : "Active"}
                </SelectItem>
                <SelectItem value="recent">
                  {isRTL ? "السجل الأخير" : "Recent history"}
                </SelectItem>
                <SelectItem value="all">
                  {isRTL ? "الكل" : "All"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "كل الحالات" : "All statuses"}</SelectItem>
                {Object.entries(WAITLIST_STATUS_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {isRTL ? meta.ar : meta.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {query.isError ? (
            <Card className="border-destructive/40">
              <CardContent className="p-4 flex items-center gap-3 text-destructive">
                <AlertCircle className="size-5" />
                {query.error instanceof Error
                  ? query.error.message
                  : isRTL
                    ? "تعذر تحميل قائمة الانتظار"
                    : "Unable to load waitlist"}
              </CardContent>
            </Card>
          ) : entries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Hourglass className="size-6" />}
                  title={isRTL ? "لا توجد إدخالات" : "No waitlist entries"}
                  description={
                    isRTL
                      ? "ستظهر المجموعات هنا عند الانضمام."
                      : "Parties will appear here when they join."
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => {
                const meta = WAITLIST_STATUS_META[entry.status];
                const expiresInSeconds = entry.notificationExpiresAt
                  ? Math.max(
                      0,
                      Math.ceil(
                        (new Date(entry.notificationExpiresAt).getTime() - now) /
                          1_000
                      )
                    )
                  : null;
                const confirmed = Boolean(entry.notificationConfirmedAt);

                return (
                  <Card key={entry.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="size-11 rounded-xl bg-muted flex items-center justify-center font-bold shrink-0">
                            {entry.status === "waiting" ? index + 1 : <Bell className="size-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold truncate">{entry.customerName}</h3>
                              <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${meta.cls}`}>
                                {isRTL ? meta.ar : meta.en}
                              </span>
                              {confirmed && (
                                <Badge variant="outline" className="text-emerald-700 gap-1">
                                  <ShieldCheck className="size-3" />
                                  {isRTL ? "مؤكد" : "Confirmed"}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="size-3" />
                                {entry.customerPhone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="size-3" />
                                {entry.partySize}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                {entry.preference || (isRTL ? "أي مكان" : "Any section")}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:w-[390px]">
                          <Metric
                            icon={<Clock className="size-3.5" />}
                            label={isRTL ? "التقدير" : "Quote"}
                            value={
                              entry.status === "notified"
                                ? isRTL
                                  ? "الآن"
                                  : "Now"
                                : `${entry.estimatedWait} ${isRTL ? "د" : "min"}`
                            }
                          />
                          <Metric
                            icon={<CalendarClock className="size-3.5" />}
                            label={isRTL ? "الجلوس المتوقع" : "Projected"}
                            value={formatTime(
                              entry.estimatedSeatAt,
                              policy?.timezone || "UTC",
                              locale
                            )}
                          />
                          <Metric
                            icon={<Armchair className="size-3.5" />}
                            label={isRTL ? "الطاولة" : "Table"}
                            value={
                              entry.table
                                ? `#${entry.table.number} · ${entry.table.section}`
                                : "—"
                            }
                          />
                        </div>
                      </div>

                      {entry.status === "notified" && expiresInSeconds !== null && (
                        <div className="px-4 py-2 bg-blue-50/70 dark:bg-blue-950/15 border-y flex items-center justify-between gap-3 text-xs">
                          <span>
                            {isRTL ? "تنتهي مهلة الطاولة" : "Table hold expires"}: {formatDateTime(
                              entry.notificationExpiresAt,
                              policy?.timezone || "UTC",
                              locale
                            )}
                          </span>
                          <Badge variant={expiresInSeconds > 60 ? "secondary" : "destructive"}>
                            {Math.floor(expiresInSeconds / 60)}:
                            {String(expiresInSeconds % 60).padStart(2, "0")}
                          </Badge>
                        </div>
                      )}

                      {!["seated", "cancelled", "no_show"].includes(entry.status) && (
                        <div className="px-4 py-3 bg-muted/20 border-t flex items-center gap-2 justify-end flex-wrap">
                          {entry.status === "waiting" && (
                            <ActionButton
                              entry={entry}
                              action="notify"
                              busyAction={busyAction}
                              onAction={mutate}
                              icon={<Bell className="size-3.5" />}
                              label={isRTL ? "إشعار" : "Notify"}
                            />
                          )}
                          {entry.status === "notified" && !confirmed && (
                            <ActionButton
                              entry={entry}
                              action="confirm"
                              busyAction={busyAction}
                              onAction={mutate}
                              icon={<CheckCircle2 className="size-3.5" />}
                              label={isRTL ? "تأكيد يدوي" : "Confirm"}
                              variant="outline"
                            />
                          )}
                          {entry.status === "notified" && (
                            <ActionButton
                              entry={entry}
                              action="seat"
                              busyAction={busyAction}
                              onAction={mutate}
                              icon={<Armchair className="size-3.5" />}
                              label={isRTL ? "جلوس" : "Seat"}
                            />
                          )}
                          <ActionButton
                            entry={entry}
                            action="no_show"
                            busyAction={busyAction}
                            onAction={mutate}
                            icon={<UserX className="size-3.5" />}
                            label={isRTL ? "لم يحضر" : "No show"}
                            variant="outline"
                          />
                          <ActionButton
                            entry={entry}
                            action="cancel"
                            busyAction={busyAction}
                            onAction={mutate}
                            icon={<XCircle className="size-3.5" />}
                            label={isRTL ? "إلغاء" : "Cancel"}
                            variant="ghost"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              {isRTL ? "سياسة قائمة الانتظار" : "Waitlist Policy"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {policyForm ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <Label>{isRTL ? "تمكين الانتظار" : "Waitlist enabled"}</Label>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? "ضمن فترات خدمة المطعم" : "During restaurant service periods"}
                    </p>
                  </div>
                  <Switch
                    checked={policyForm.enabled}
                    onCheckedChange={(enabled) =>
                      setPolicyForm({ ...policyForm, enabled })
                    }
                  />
                </div>
                <PolicyNumber
                  label={isRTL ? "متوسط دوران الطاولة (دقيقة)" : "Average table turnover (min)"}
                  value={policyForm.averageTurnoverMinutes}
                  min={15}
                  max={480}
                  onChange={(averageTurnoverMinutes) =>
                    setPolicyForm({ ...policyForm, averageTurnoverMinutes })
                  }
                />
                <PolicyNumber
                  label={isRTL ? "مهلة الإشعار (دقيقة)" : "Notification hold (min)"}
                  value={policyForm.notificationExpiryMinutes}
                  min={1}
                  max={120}
                  onChange={(notificationExpiryMinutes) =>
                    setPolicyForm({ ...policyForm, notificationExpiryMinutes })
                  }
                />
                <PolicyNumber
                  label={isRTL ? "هامش التقدير (دقيقة)" : "Estimate padding (min)"}
                  value={policyForm.estimatePaddingMinutes}
                  min={0}
                  max={120}
                  onChange={(estimatePaddingMinutes) =>
                    setPolicyForm({ ...policyForm, estimatePaddingMinutes })
                  }
                />
                <PolicyNumber
                  label={isRTL ? "أقصى تقدير (دقيقة)" : "Maximum quote (min)"}
                  value={policyForm.maxQuoteMinutes}
                  min={15}
                  max={1440}
                  onChange={(maxQuoteMinutes) =>
                    setPolicyForm({ ...policyForm, maxQuoteMinutes })
                  }
                />
                <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <Label>{isRTL ? "طلب تأكيد العميل" : "Require confirmation"}</Label>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? "قبل جلوس المجموعة" : "Before the party can be seated"}
                    </p>
                  </div>
                  <Switch
                    checked={policyForm.requireConfirmation}
                    onCheckedChange={(requireConfirmation) =>
                      setPolicyForm({ ...policyForm, requireConfirmation })
                    }
                  />
                </div>
                <Button
                  onClick={() => void savePolicy()}
                  disabled={savingPolicy}
                  className="w-full gap-2"
                >
                  {savingPolicy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  {isRTL ? "حفظ السياسة" : "Save policy"}
                </Button>
              </>
            ) : (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-2.5 min-w-0">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xs font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}

function ActionButton({
  entry,
  action,
  busyAction,
  onAction,
  icon,
  label,
  variant = "default",
}: {
  entry: WaitlistEntry;
  action: "notify" | "confirm" | "seat" | "cancel" | "no_show";
  busyAction: string | null;
  onAction: (
    entry: WaitlistEntry,
    action: "notify" | "confirm" | "seat" | "cancel" | "no_show"
  ) => Promise<void>;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const key = `${entry.id}:${action}`;
  const busy = busyAction === key;
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={busyAction !== null}
      onClick={() => void onAction(entry, action)}
      className="gap-1.5"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function PolicyNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) =>
          onChange(
            Math.min(max, Math.max(min, Number(event.target.value) || min))
          )
        }
      />
    </div>
  );
}
