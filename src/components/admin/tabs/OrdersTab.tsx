"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AdminLoading, EmptyState, ORDER_STATUS_META, StatusBadge, apiFetch } from "../shared";
import { toast } from "sonner";
import { useRestaurantStore } from "@/lib/store";
import {
  ClipboardList, Search, Filter, Eye, Loader2, X, Receipt,
  Clock, User, Phone, MapPin, CreditCard, CheckCircle2, XCircle,
  ChefHat, Bell, Package, ArrowRight, Table2,
} from "lucide-react";

export function OrdersTab() {
  const { t, isRTL, locale, fmtCurrency, fmtTime, fmtDate } = useI18n();
  const qc = useQueryClient();
  const { staffName } = useRestaurantStore();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", "admin", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/orders?limit=100" : `/api/orders?status=${filter}&limit=100`;
      return (await fetch(url)).json();
    },
    refetchInterval: 15000,
  });
  const orders: any[] = data?.orders || [];

  const filtered = orders.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.orderNumber.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q) && !o.customerPhone.includes(q)) return false;
    }
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      qc.invalidateQueries({ queryKey: ["orders", "admin"] });
      toast.success(isRTL ? "تم التحديث" : "Status updated");
      setSelected((s) => s ? { ...s, status } : s);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  const statusOptions = [
    { value: "all", label: t.menu.all },
    ...Object.keys(ORDER_STATUS_META).map((s) => ({ value: s, label: ORDER_STATUS_META[s].label[locale] })),
  ];

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? "ابحث برقم الطلب أو الاسم أو الهاتف" : "Search by order #, name or phone"}
            className="ps-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="size-3.5 me-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {statusOptions.map((s) => {
          const count = s.value === "all" ? orders.length : orders.filter((o) => o.status === s.value).length;
          return (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                filter === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {s.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Orders table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title={isRTL ? "لا طلبات" : "No orders"}
              description={isRTL ? "ستظهر الطلبات هنا" : "Orders will appear here"}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">#{isRTL ? "الطلب" : "Order"}</TableHead>
                    <TableHead>{isRTL ? "العميل" : "Customer"}</TableHead>
                    <TableHead className="hidden md:table-cell">{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead className="hidden lg:table-cell">{isRTL ? "العناصر" : "Items"}</TableHead>
                    <TableHead>{t.admin.status}</TableHead>
                    <TableHead className="hidden sm:table-cell">{isRTL ? "الوقت" : "Time"}</TableHead>
                    <TableHead>{t.cart.total}</TableHead>
                    <TableHead className="text-end pe-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(o)}>
                      <TableCell className="ps-4 font-mono text-xs font-bold">{o.orderNumber}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{o.customerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{o.customerPhone || ""}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="font-normal text-[10px]">
                          {orderTypeLabel(o.type, isRTL)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {o.items?.length || 0} {isRTL ? "صنف" : "items"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} meta={ORDER_STATUS_META} locale={locale} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtTime(o.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">{fmtCurrency(o.total)}</TableCell>
                      <TableCell className="text-end pe-4">
                        <Button size="icon" variant="ghost" className="size-8" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>
                          <Eye className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order detail dialog */}
      {selected && (
        <OrderDetailDialog
          order={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={(s) => updateStatus(selected.id, s)}
        />
      )}
    </div>
  );
}

function orderTypeLabel(type: string, isRTL: boolean) {
  const map: Record<string, { en: string; ar: string }> = {
    dine_in: { en: "Dine In", ar: "صالة" },
    takeout: { en: "Takeout", ar: "سفري" },
    delivery: { en: "Delivery", ar: "توصيل" },
  };
  return (map[type] || { en: type, ar: type })[isRTL ? "ar" : "en"];
}

function OrderDetailDialog({
  order, onClose, onUpdateStatus,
}: {
  order: any;
  onClose: () => void;
  onUpdateStatus: (status: string) => void;
}) {
  const { t, isRTL, locale, fmtCurrency, fmtTime, fmtDate } = useI18n();

  const nextActions: { status: string; label: string; icon: React.ReactNode; cls: string }[] = [];
  if (order.status === "pending") nextActions.push({ status: "confirmed", label: t.orders.confirmed, icon: <CheckCircle2 className="size-4" />, cls: "bg-blue-500 hover:bg-blue-600" });
  if (order.status === "confirmed") nextActions.push({ status: "preparing", label: t.orders.preparing, icon: <ChefHat className="size-4" />, cls: "bg-orange-500 hover:bg-orange-600" });
  if (order.status === "preparing") nextActions.push({ status: "ready", label: t.orders.ready, icon: <Bell className="size-4" />, cls: "bg-emerald-500 hover:bg-emerald-600" });
  if (order.status === "ready") nextActions.push({ status: "completed", label: t.orders.completed, icon: <Package className="size-4" />, cls: "bg-green-600 hover:bg-green-700" });
  if (order.status !== "completed" && order.status !== "cancelled") {
    nextActions.push({ status: "cancelled", label: t.orders.cancelled, icon: <XCircle className="size-4" />, cls: "bg-rose-500 hover:bg-rose-600" });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Receipt className="size-5 text-primary" />
            <span className="font-mono">{order.orderNumber}</span>
            <StatusBadge status={order.status} meta={ORDER_STATUS_META} locale={locale} />
          </DialogTitle>
          <DialogDescription>
            {fmtDate(order.createdAt)} · {fmtTime(order.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <InfoRow icon={<User className="size-4" />} label={isRTL ? "العميل" : "Customer"} value={order.customerName || "—"} />
          <InfoRow icon={<Phone className="size-4" />} label={isRTL ? "الهاتف" : "Phone"} value={order.customerPhone || "—"} />
          <InfoRow icon={<Table2 className="size-4" />} label={isRTL ? "النوع" : "Type"} value={orderTypeLabel(order.type, isRTL)} />
          {order.table && (
            <InfoRow icon={<Table2 className="size-4" />} label={isRTL ? "الطاولة" : "Table"} value={`#${order.table.number}`} />
          )}
          {order.deliveryAddress && (
            <div className="col-span-2">
              <InfoRow icon={<MapPin className="size-4" />} label={isRTL ? "العنوان" : "Address"} value={order.deliveryAddress} />
            </div>
          )}
          <InfoRow icon={<CreditCard className="size-4" />} label={isRTL ? "الدفع" : "Payment"} value={`${paymentLabel(order.paymentMethod, isRTL)} · ${order.paymentStatus === "paid" ? t.orders.paid : t.orders.unpaid}`} />
          {order.serverName && (
            <InfoRow icon={<User className="size-4" />} label={isRTL ? "النادل" : "Server"} value={order.serverName} />
          )}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{t.orders.orderItems}</h4>
          <div className="border border-border rounded-lg divide-y divide-border">
            {order.items?.map((it: any) => (
              <div key={it.id} className="flex items-start gap-3 p-3">
                <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {it.quantity}×
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {locale === "ar" ? it.menuItem?.nameAr : it.menuItem?.nameEn}
                  </div>
                  {it.notes && (
                    <div className="text-xs text-amber-700 mt-0.5">📝 {it.notes}</div>
                  )}
                  {(() => {
                    try {
                      const mods = JSON.parse(it.modifiers || "[]");
                      if (!mods.length) return null;
                      return (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {mods.map((m: any) => `+ ${locale === "ar" ? m.nameAr : m.nameEn}`).join(", ")}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
                <div className="text-sm font-semibold text-primary">
                  {fmtCurrency(it.totalPrice)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border">
          <TotalRow label={t.cart.subtotal} value={fmtCurrency(order.subtotal)} />
          <TotalRow label={t.cart.tax} value={fmtCurrency(order.taxAmount)} />
          {order.deliveryFee > 0 && <TotalRow label={t.cart.deliveryFee} value={fmtCurrency(order.deliveryFee)} />}
          {order.discountAmount > 0 && <TotalRow label={t.cart.discount} value={`- ${fmtCurrency(order.discountAmount)}`} />}
          {order.tipAmount > 0 && <TotalRow label={t.cart.tip} value={fmtCurrency(order.tipAmount)} />}
          <div className="h-px bg-border my-1" />
          <TotalRow label={t.cart.total} value={fmtCurrency(order.total)} bold />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {nextActions.map((a) => (
            <Button
              key={a.status}
              onClick={() => onUpdateStatus(a.status)}
              className={`text-white ${a.cls} gap-1.5`}
              size="sm"
            >
              {a.icon}
              {a.label}
              <ArrowRight className={isRTL ? "size-3.5 rotate-180" : "size-3.5"} />
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function paymentLabel(method: string, isRTL: boolean) {
  const map: Record<string, { en: string; ar: string }> = {
    cash: { en: "Cash", ar: "نقداً" },
    card: { en: "Card", ar: "بطاقة" },
    split: { en: "Split", ar: "مقسّم" },
  };
  return (map[method] || { en: method, ar: method })[isRTL ? "ar" : "en"];
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold text-base" : "text-sm"}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "text-primary" : ""}>{value}</span>
    </div>
  );
}
