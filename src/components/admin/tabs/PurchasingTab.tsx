"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Ban,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";

interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
  supplier: string | null;
}

interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionToBaseQuantity: number;
  orderedQuantity: number;
  orderedBaseQuantity: number;
  receivedQuantity: number;
  receivedBaseQuantity: number;
  remainingQuantity: number;
  remainingBaseQuantity: number;
  unitCost: number;
  baseUnitCost: number;
  lineTotal: number;
  notes: string | null;
  isComplete: boolean;
}

interface PurchaseReceiptLine {
  id: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  ingredientId: string;
  ingredientName: string;
  submittedUnit: string;
  submittedQuantity: number;
  baseQuantity: number;
  unitCost: number;
  baseUnitCost: number;
  totalCost: number;
  stockMovementId: string;
  reversalMovementId: string | null;
}

interface PurchaseReceipt {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  orderNumber: string;
  supplier: string;
  supplierCode: string;
  currency: string;
  status: "posted" | "reversed";
  totalCost: number;
  notes: string | null;
  receivedByName: string;
  occurredAt: string;
  reversedByName: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  lineCount: number;
  createdAt: string;
  lines: PurchaseReceiptLine[];
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplier: string;
  supplierStatus: "active" | "inactive";
  currency: string;
  notes: string | null;
  status:
    | "draft"
    | "submitted"
    | "partially_received"
    | "received"
    | "cancelled";
  totalCost: number;
  expectedAt: string | null;
  createdByName: string;
  submittedByName: string | null;
  submittedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  legacyImported: boolean;
  lineCount: number;
  completedLineCount: number;
  receiptCount: number;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
  receipts: PurchaseReceipt[];
}

type View = "orders" | "suppliers" | "receipts";
type SupplierEditor = Supplier | "new" | null;
type OrderEditor = PurchaseOrder | "new" | null;

function newKey(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}:${suffix}`;
}

function statusLabel(status: PurchaseOrder["status"], isRTL: boolean): string {
  const labels: Record<PurchaseOrder["status"], { en: string; ar: string }> = {
    draft: { en: "Draft", ar: "مسودة" },
    submitted: { en: "Submitted", ar: "مرسل" },
    partially_received: { en: "Partially received", ar: "مستلم جزئياً" },
    received: { en: "Received", ar: "مستلم بالكامل" },
    cancelled: { en: "Cancelled", ar: "ملغى" },
  };
  return labels[status][isRTL ? "ar" : "en"];
}

function statusClass(status: PurchaseOrder["status"]): string {
  const classes: Record<PurchaseOrder["status"], string> = {
    draft: "bg-slate-100 text-slate-800 border-slate-200",
    submitted: "bg-blue-100 text-blue-800 border-blue-200",
    partially_received: "bg-amber-100 text-amber-800 border-amber-200",
    received: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return classes[status];
}

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function requestDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function PurchasingTab() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("orders");
  const [search, setSearch] = useState("");
  const [supplierEditor, setSupplierEditor] = useState<SupplierEditor>(null);
  const [orderEditor, setOrderEditor] = useState<OrderEditor>(null);
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchasing"],
    queryFn: async () => apiFetch("/api/suppliers"),
  });
  const ordersQuery = useQuery({
    queryKey: ["purchase-orders", "purchasing"],
    queryFn: async () => apiFetch("/api/purchase-orders?limit=200"),
  });
  const inventoryQuery = useQuery({
    queryKey: ["inventory", "purchasing"],
    queryFn: async () => apiFetch("/api/inventory"),
  });

  const suppliers: Supplier[] = suppliersQuery.data?.suppliers || [];
  const purchaseOrders: PurchaseOrder[] = ordersQuery.data?.purchaseOrders || [];
  const ingredients: Ingredient[] = inventoryQuery.data?.items || [];
  const receipts = useMemo(
    () => purchaseOrders.flatMap((order) => order.receipts || []),
    [purchaseOrders]
  );

  const filteredOrders = purchaseOrders.filter((order) =>
    [order.orderNumber, order.supplier, order.supplierCode, order.status]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const filteredSuppliers = suppliers.filter((supplier) =>
    [supplier.code, supplier.name, supplier.contactName, supplier.phone]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const filteredReceipts = receipts.filter((receipt) =>
    [receipt.receiptNumber, receipt.orderNumber, receipt.supplier, receipt.status]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["suppliers"] }),
      qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
      qc.invalidateQueries({ queryKey: ["inventory"] }),
    ]);
  };

  const submitOrder = async (order: PurchaseOrder) => {
    if (
      !window.confirm(
        isRTL
          ? "بعد الإرسال ستصبح الأسعار والكميات غير قابلة للتعديل. هل تريد المتابعة؟"
          : "Submission freezes quantities and prices. Continue?"
      )
    ) {
      return;
    }
    setBusyId(order.id);
    try {
      await apiFetch(`/api/purchase-orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "submit" }),
      });
      toast.success(isRTL ? "تم إرسال أمر الشراء" : "Purchase order submitted");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = async (order: PurchaseOrder) => {
    const reason = window.prompt(
      isRTL ? "اكتب سبب إلغاء أمر الشراء" : "Enter the cancellation reason"
    );
    if (!reason?.trim()) return;
    setBusyId(order.id);
    try {
      await apiFetch(`/api/purchase-orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel", reason: reason.trim() }),
      });
      toast.success(isRTL ? "تم إلغاء أمر الشراء" : "Purchase order cancelled");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  };

  const reverseReceipt = async (receipt: PurchaseReceipt) => {
    const reason = window.prompt(
      isRTL
        ? "اكتب سبب عكس هذا الاستلام. سيُنشأ عكس مخزني مدقق."
        : "Enter the correction reason. Reviewed stock reversals will be created."
    );
    if (!reason?.trim()) return;
    setBusyId(receipt.id);
    try {
      await apiFetch(
        `/api/purchase-orders/${encodeURIComponent(receipt.purchaseOrderId)}/receipts`,
        {
          method: "POST",
          headers: { "Idempotency-Key": newKey("purchase-receipt-reversal") },
          body: JSON.stringify({
            action: "reverse",
            receiptId: receipt.id,
            reason: reason.trim(),
          }),
        }
      );
      toast.success(isRTL ? "تم عكس الاستلام" : "Purchase receipt reversed");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSupplier = async (supplier: Supplier) => {
    setBusyId(supplier.id);
    try {
      await apiFetch("/api/suppliers", {
        method: "PATCH",
        body: JSON.stringify({
          id: supplier.id,
          status: supplier.status === "active" ? "inactive" : "active",
        }),
      });
      toast.success(isRTL ? "تم تحديث حالة المورد" : "Supplier status updated");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  };

  if (
    suppliersQuery.isLoading ||
    ordersQuery.isLoading ||
    inventoryQuery.isLoading
  ) {
    return <AdminLoading label={t.common.loading} />;
  }

  const openCommitments = purchaseOrders.filter((order) =>
    ["submitted", "partially_received"].includes(order.status)
  );
  const outstandingValue = openCommitments.reduce(
    (sum, order) => sum + order.totalCost,
    0
  );

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Metric
          label={isRTL ? "الموردون النشطون" : "Active suppliers"}
          value={String(suppliers.filter((supplier) => supplier.status === "active").length)}
          icon={<Building2 className="size-4 text-primary" />}
        />
        <Metric
          label={isRTL ? "المسودات" : "Draft orders"}
          value={String(purchaseOrders.filter((order) => order.status === "draft").length)}
          icon={<ShoppingCart className="size-4 text-slate-600" />}
        />
        <Metric
          label={isRTL ? "طلبات مفتوحة" : "Open commitments"}
          value={String(openCommitments.length)}
          icon={<Truck className="size-4 text-blue-600" />}
        />
        <Metric
          label={isRTL ? "قيمة الطلبات المفتوحة" : "Open order value"}
          value={fmtCurrency(outstandingValue)}
          icon={<ClipboardCheck className="size-4 text-amber-600" />}
        />
        <Metric
          label={isRTL ? "إيصالات الاستلام" : "Purchase receipts"}
          value={String(receipts.length)}
          icon={<ReceiptText className="size-4 text-emerald-600" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          <ViewButton
            active={view === "orders"}
            onClick={() => setView("orders")}
            icon={<ShoppingCart className="size-3.5" />}
            label={isRTL ? "أوامر الشراء" : "Purchase orders"}
          />
          <ViewButton
            active={view === "suppliers"}
            onClick={() => setView("suppliers")}
            icon={<Building2 className="size-3.5" />}
            label={isRTL ? "الموردون" : "Suppliers"}
          />
          <ViewButton
            active={view === "receipts"}
            onClick={() => setView("receipts")}
            icon={<ReceiptText className="size-3.5" />}
            label={isRTL ? "الاستلامات" : "Receipts"}
          />
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() =>
            view === "suppliers"
              ? setSupplierEditor("new")
              : setOrderEditor("new")
          }
        >
          <Plus className="size-4" />
          {view === "suppliers"
            ? isRTL
              ? "مورد جديد"
              : "New supplier"
            : isRTL
              ? "أمر شراء جديد"
              : "New purchase order"}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="ps-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            view === "orders"
              ? isRTL
                ? "ابحث برقم الأمر أو المورد"
                : "Search order number or supplier"
              : view === "suppliers"
                ? isRTL
                  ? "ابحث عن مورد"
                  : "Search suppliers"
                : isRTL
                  ? "ابحث عن إيصال استلام"
                  : "Search purchase receipts"
          }
        />
      </div>

      {view === "orders" && (
        <OrdersTable
          orders={filteredOrders}
          isRTL={isRTL}
          fmtCurrency={fmtCurrency}
          fmtNumber={fmtNumber}
          busyId={busyId}
          onEdit={(order) => setOrderEditor(order)}
          onSubmit={submitOrder}
          onCancel={cancelOrder}
          onReceive={(order) => setReceiveOrder(order)}
          onView={(order) => setDetailOrder(order)}
        />
      )}

      {view === "suppliers" && (
        <SuppliersTable
          suppliers={filteredSuppliers}
          isRTL={isRTL}
          busyId={busyId}
          onEdit={(supplier) => setSupplierEditor(supplier)}
          onToggle={toggleSupplier}
        />
      )}

      {view === "receipts" && (
        <ReceiptsTable
          receipts={filteredReceipts}
          isRTL={isRTL}
          fmtCurrency={fmtCurrency}
          busyId={busyId}
          onReverse={reverseReceipt}
        />
      )}

      {supplierEditor && (
        <SupplierDialog
          supplier={supplierEditor === "new" ? undefined : supplierEditor}
          onClose={() => setSupplierEditor(null)}
          onSaved={async () => {
            setSupplierEditor(null);
            await refresh();
          }}
        />
      )}

      {orderEditor && (
        <PurchaseOrderDialog
          order={orderEditor === "new" ? undefined : orderEditor}
          suppliers={suppliers}
          ingredients={ingredients}
          onClose={() => setOrderEditor(null)}
          onSaved={async () => {
            setOrderEditor(null);
            await refresh();
          }}
        />
      )}

      {receiveOrder && (
        <ReceiveDialog
          order={receiveOrder}
          onClose={() => setReceiveOrder(null)}
          onSaved={async () => {
            setReceiveOrder(null);
            await refresh();
          }}
        />
      )}

      {detailOrder && (
        <OrderDetailDialog
          order={detailOrder}
          isRTL={isRTL}
          fmtCurrency={fmtCurrency}
          fmtNumber={fmtNumber}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function OrdersTable({
  orders,
  isRTL,
  fmtCurrency,
  fmtNumber,
  busyId,
  onEdit,
  onSubmit,
  onCancel,
  onReceive,
  onView,
}: {
  orders: PurchaseOrder[];
  isRTL: boolean;
  fmtCurrency: (value: number) => string;
  fmtNumber: (value: number) => string;
  busyId: string | null;
  onEdit: (order: PurchaseOrder) => void;
  onSubmit: (order: PurchaseOrder) => void | Promise<void>;
  onCancel: (order: PurchaseOrder) => void | Promise<void>;
  onReceive: (order: PurchaseOrder) => void;
  onView: (order: PurchaseOrder) => void;
}) {
  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShoppingCart className="size-6" />}
          title={isRTL ? "لا توجد أوامر شراء" : "No purchase orders"}
          description={
            isRTL
              ? "أنشئ أمراً بمكوّنات وأسعار دقيقة ثم أرسله للاستلام."
              : "Create an exact line-based order, then submit it for receiving."
          }
        />
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{isRTL ? "الأمر" : "Order"}</TableHead>
                <TableHead>{isRTL ? "المورد" : "Supplier"}</TableHead>
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isRTL ? "التقدم" : "Progress"}</TableHead>
                <TableHead>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {isRTL ? "التسليم المتوقع" : "Expected"}
                </TableHead>
                <TableHead className="text-end pe-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const receivedBase = order.lines.reduce(
                  (sum, line) => sum + line.receivedBaseQuantity,
                  0
                );
                const orderedBase = order.lines.reduce(
                  (sum, line) => sum + line.orderedBaseQuantity,
                  0
                );
                const progress =
                  orderedBase > 0 ? Math.round((receivedBase / orderedBase) * 100) : 0;
                const canReceive = ["submitted", "partially_received"].includes(
                  order.status
                );
                const canCancel =
                  order.status === "draft" ||
                  (order.status === "submitted" && order.receiptCount === 0);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="ps-4">
                      <div className="font-mono text-sm font-semibold">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.lineCount} {isRTL ? "سطر" : "lines"}
                        {order.legacyImported ? ` · ${isRTL ? "قديم" : "legacy"}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{order.supplier}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.supplierCode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass(order.status)}>
                        {statusLabel(order.status, isRTL)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{progress}%</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {order.completedLineCount}/{order.lineCount}{" "}
                        {isRTL ? "أسطر مكتملة" : "lines complete"}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {fmtCurrency(order.totalCost)}
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {order.currency}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {order.expectedAt
                        ? new Date(order.expectedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="pe-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title={isRTL ? "عرض التفاصيل" : "View details"}
                          onClick={() => onView(order)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {order.status === "draft" && !order.legacyImported && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title={isRTL ? "تعديل المسودة" : "Edit draft"}
                            onClick={() => onEdit(order)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {order.status === "draft" && !order.legacyImported && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-blue-700"
                            disabled={busyId === order.id}
                            title={isRTL ? "إرسال" : "Submit"}
                            onClick={() => void onSubmit(order)}
                          >
                            {busyId === order.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                          </Button>
                        )}
                        {canReceive && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-emerald-700"
                            title={isRTL ? "تسجيل استلام" : "Receive delivery"}
                            onClick={() => onReceive(order)}
                          >
                            <PackageCheck className="size-3.5" />
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-rose-700"
                            disabled={busyId === order.id}
                            title={isRTL ? "إلغاء" : "Cancel"}
                            onClick={() => void onCancel(order)}
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SuppliersTable({
  suppliers,
  isRTL,
  busyId,
  onEdit,
  onToggle,
}: {
  suppliers: Supplier[];
  isRTL: boolean;
  busyId: string | null;
  onEdit: (supplier: Supplier) => void;
  onToggle: (supplier: Supplier) => void | Promise<void>;
}) {
  if (suppliers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 className="size-6" />}
          title={isRTL ? "لا يوجد موردون" : "No suppliers"}
        />
      </Card>
    );
  }
  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{isRTL ? "المورد" : "Supplier"}</TableHead>
                <TableHead>{isRTL ? "جهة الاتصال" : "Contact"}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {isRTL ? "شروط الدفع" : "Payment terms"}
                </TableHead>
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-end pe-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="ps-4">
                    <div className="font-medium text-sm">{supplier.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {supplier.code}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{supplier.contactName || "—"}</div>
                    <div className="text-muted-foreground">
                      {supplier.phone || supplier.email || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[280px] truncate">
                    {supplier.paymentTerms || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        supplier.status === "active"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }
                    >
                      {supplier.status === "active"
                        ? isRTL
                          ? "نشط"
                          : "Active"
                        : isRTL
                          ? "غير نشط"
                          : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pe-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => onEdit(supplier)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === supplier.id}
                        className={
                          supplier.status === "active"
                            ? "h-8 text-rose-700"
                            : "h-8 text-emerald-700"
                        }
                        onClick={() => void onToggle(supplier)}
                      >
                        {busyId === supplier.id && (
                          <Loader2 className="size-3.5 animate-spin" />
                        )}
                        {supplier.status === "active"
                          ? isRTL
                            ? "تعطيل"
                            : "Deactivate"
                          : isRTL
                            ? "تفعيل"
                            : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptsTable({
  receipts,
  isRTL,
  fmtCurrency,
  busyId,
  onReverse,
}: {
  receipts: PurchaseReceipt[];
  isRTL: boolean;
  fmtCurrency: (value: number) => string;
  busyId: string | null;
  onReverse: (receipt: PurchaseReceipt) => void | Promise<void>;
}) {
  if (receipts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ReceiptText className="size-6" />}
          title={isRTL ? "لا توجد استلامات" : "No purchase receipts"}
        />
      </Card>
    );
  }
  return (
    <Card className="border-border/60">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{isRTL ? "الإيصال" : "Receipt"}</TableHead>
                <TableHead>{isRTL ? "أمر الشراء" : "Purchase order"}</TableHead>
                <TableHead>{isRTL ? "المورد" : "Supplier"}</TableHead>
                <TableHead>{isRTL ? "القيمة" : "Value"}</TableHead>
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {isRTL ? "المستلم / التاريخ" : "Received by / date"}
                </TableHead>
                <TableHead className="text-end pe-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="ps-4 font-mono text-sm font-semibold">
                    {receipt.receiptNumber}
                    <div className="text-[10px] text-muted-foreground font-sans">
                      {receipt.lineCount} {isRTL ? "أسطر" : "lines"}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {receipt.orderNumber}
                  </TableCell>
                  <TableCell className="text-sm">{receipt.supplier}</TableCell>
                  <TableCell className="font-semibold text-sm">
                    {fmtCurrency(receipt.totalCost)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        receipt.status === "posted"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }
                    >
                      {receipt.status === "posted"
                        ? isRTL
                          ? "مثبت"
                          : "Posted"
                        : isRTL
                          ? "معكوس"
                          : "Reversed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    <div>{receipt.receivedByName}</div>
                    <div>{new Date(receipt.occurredAt).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-end pe-4">
                    {receipt.status === "posted" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-rose-700"
                        disabled={busyId === receipt.id}
                        onClick={() => void onReverse(receipt)}
                      >
                        {busyId === receipt.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        {isRTL ? "عكس" : "Reverse"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierDialog({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    code: supplier?.code || "",
    name: supplier?.name || "",
    contactName: supplier?.contactName || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
    paymentTerms: supplier?.paymentTerms || "",
    notes: supplier?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(isRTL ? "اسم المورد مطلوب" : "Supplier name is required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/suppliers", {
        method: supplier ? "PATCH" : "POST",
        body: JSON.stringify(
          supplier
            ? { id: supplier.id, ...form, notes: form.notes || null }
            : { ...form, code: form.code || undefined, notes: form.notes || null }
        ),
      });
      toast.success(isRTL ? "تم حفظ المورد" : "Supplier saved");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            {supplier
              ? isRTL
                ? "تعديل المورد"
                : "Edit supplier"
              : isRTL
                ? "مورد جديد"
                : "New supplier"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "يُحفظ اسم ورمز المورد داخل أوامر الشراء التاريخية."
              : "Supplier name and code are snapshotted on historical purchase orders."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={isRTL ? "الاسم" : "Name"}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label={isRTL ? "الرمز" : "Code"}>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder={isRTL ? "يُولد تلقائياً" : "Generated when empty"}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={isRTL ? "جهة الاتصال" : "Contact name"}>
              <Input
                value={form.contactName}
                onChange={(event) =>
                  setForm({ ...form, contactName: event.target.value })
                }
              />
            </Field>
            <Field label={isRTL ? "الهاتف" : "Phone"}>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
          </div>
          <Field label={isRTL ? "البريد الإلكتروني" : "Email"}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          <Field label={isRTL ? "العنوان" : "Address"}>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
          <Field label={isRTL ? "شروط الدفع" : "Payment terms"}>
            <Input
              value={form.paymentTerms}
              onChange={(event) =>
                setForm({ ...form, paymentTerms: event.target.value })
              }
            />
          </Field>
          <Field label={isRTL ? "ملاحظات" : "Notes"}>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.admin.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DraftLine {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  unitCost: string;
  notes: string;
}

function PurchaseOrderDialog({
  order,
  suppliers,
  ingredients,
  onClose,
  onSaved,
}: {
  order?: PurchaseOrder;
  suppliers: Supplier[];
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.status === "active" || supplier.id === order?.supplierId
  );
  const [supplierId, setSupplierId] = useState(
    order?.supplierId || activeSuppliers[0]?.id || ""
  );
  const [currency, setCurrency] = useState(order?.currency || "USD");
  const [expectedAt, setExpectedAt] = useState(localDateTime(order?.expectedAt || null));
  const [notes, setNotes] = useState(order?.notes || "");
  const [lines, setLines] = useState<DraftLine[]>(
    order?.lines.length
      ? order.lines.map((line) => ({
          key: line.id,
          ingredientId: line.ingredientId,
          quantity: String(line.orderedQuantity),
          unit: line.purchaseUnit,
          unitCost: String(line.unitCost),
          notes: line.notes || "",
        }))
      : [newDraftLine(ingredients[0])]
  );
  const [saving, setSaving] = useState(false);

  const updateLine = (key: string, change: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line))
    );
  };

  const save = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error(isRTL ? "اختر مورداً وأضف سطراً" : "Choose a supplier and add a line");
      return;
    }
    if (
      lines.some(
        (line) =>
          !line.ingredientId ||
          !line.unit.trim() ||
          Number(line.quantity) <= 0 ||
          Number(line.unitCost) <= 0
      )
    ) {
      toast.error(isRTL ? "تحقق من الكميات والأسعار" : "Check line quantities and prices");
      return;
    }
    setSaving(true);
    try {
      const body = {
        supplierId,
        currency,
        expectedAt: requestDateTime(expectedAt),
        notes: notes || null,
        lines: lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: Number(line.quantity),
          unit: line.unit.trim(),
          unitCost: Number(line.unitCost),
          notes: line.notes || null,
        })),
      };
      if (order) {
        await apiFetch(`/api/purchase-orders/${encodeURIComponent(order.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "update_draft", ...body }),
        });
      } else {
        await apiFetch("/api/purchase-orders", {
          method: "POST",
          headers: { "Idempotency-Key": newKey("purchase-order") },
          body: JSON.stringify(body),
        });
      }
      toast.success(isRTL ? "تم حفظ أمر الشراء" : "Purchase order saved");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            {order
              ? isRTL
                ? `تعديل ${order.orderNumber}`
                : `Edit ${order.orderNumber}`
              : isRTL
                ? "أمر شراء جديد"
                : "New purchase order"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "عند الإرسال تُثبت الكميات والتحويلات والأسعار ولا تُعدل لاحقاً."
              : "Submission freezes quantities, conversions, and price snapshots."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid md:grid-cols-[1fr_140px_220px] gap-3">
            <Field label={isRTL ? "المورد" : "Supplier"}>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeSuppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} · {supplier.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={isRTL ? "العملة" : "Currency"}>
              <Input
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </Field>
            <Field label={isRTL ? "التسليم المتوقع" : "Expected delivery"}>
              <Input
                type="datetime-local"
                value={expectedAt}
                onChange={(event) => setExpectedAt(event.target.value)}
              />
            </Field>
          </div>
          <Field label={isRTL ? "ملاحظات" : "Notes"}>
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{isRTL ? "سطور الأمر" : "Order lines"}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setLines((current) => [...current, newDraftLine(ingredients[0])])
                }
              >
                <Plus className="size-3.5" />
                {isRTL ? "إضافة سطر" : "Add line"}
              </Button>
            </div>
            {lines.map((line, index) => {
              const ingredient = ingredients.find(
                (candidate) => candidate.id === line.ingredientId
              );
              return (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[minmax(180px,1fr)_120px_110px_130px_minmax(160px,1fr)_auto]"
                >
                  <Field label={index === 0 ? (isRTL ? "المكوّن" : "Ingredient") : ""}>
                    <Select
                      value={line.ingredientId}
                      onValueChange={(value) => {
                        const selected = ingredients.find(
                          (candidate) => candidate.id === value
                        );
                        updateLine(line.key, {
                          ingredientId: value,
                          unit: selected?.unit || "pcs",
                          unitCost: String(selected?.costPerUnit || 0),
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ingredients.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={index === 0 ? (isRTL ? "الكمية" : "Quantity") : ""}>
                    <Input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? (isRTL ? "الوحدة" : "Unit") : ""}>
                    <Input
                      value={line.unit}
                      placeholder={ingredient?.unit || "unit"}
                      onChange={(event) =>
                        updateLine(line.key, { unit: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? (isRTL ? "سعر الوحدة" : "Unit cost") : ""}>
                    <Input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={line.unitCost}
                      onChange={(event) =>
                        updateLine(line.key, { unitCost: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={index === 0 ? (isRTL ? "ملاحظة" : "Note") : ""}>
                    <Input
                      value={line.notes}
                      onChange={(event) =>
                        updateLine(line.key, { notes: event.target.value })
                      }
                    />
                  </Field>
                  <div className={index === 0 ? "pt-6" : ""}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((candidate) => candidate.key !== line.key)
                        )
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function newDraftLine(ingredient?: Ingredient): DraftLine {
  return {
    key: newKey("purchase-line"),
    ingredientId: ingredient?.id || "",
    quantity: "1",
    unit: ingredient?.unit || "pcs",
    unitCost: String(ingredient?.costPerUnit || 0),
    notes: "",
  };
}

function ReceiveDialog({
  order,
  onClose,
  onSaved,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t, isRTL } = useI18n();
  const receivable = order.lines.filter((line) => line.remainingQuantity > 0);
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(receivable.map((line) => [line.id, String(line.remainingQuantity)]))
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const lines = receivable
      .map((line) => ({
        purchaseOrderLineId: line.id,
        quantity: Number(quantities[line.id] || 0),
      }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      toast.error(isRTL ? "أدخل كمية للاستلام" : "Enter at least one receipt quantity");
      return;
    }
    const invalid = lines.some((entry) => {
      const line = receivable.find(
        (candidate) => candidate.id === entry.purchaseOrderLineId
      );
      return !line || entry.quantity > line.remainingQuantity;
    });
    if (invalid) {
      toast.error(
        isRTL
          ? "إحدى الكميات تتجاوز المتبقي في أمر الشراء"
          : "A quantity exceeds the purchase-order remainder"
      );
      return;
    }
    setSaving(true);
    try {
      await apiFetch(
        `/api/purchase-orders/${encodeURIComponent(order.id)}/receipts`,
        {
          method: "POST",
          headers: { "Idempotency-Key": newKey("purchase-receipt") },
          body: JSON.stringify({ action: "receive", lines, notes: notes || null }),
        }
      );
      toast.success(isRTL ? "تم تسجيل الاستلام" : "Purchase receipt posted");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-emerald-600" />
            {isRTL ? `استلام ${order.orderNumber}` : `Receive ${order.orderNumber}`}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "يمكن استلام جزء من كل سطر. تُضاف الكميات إلى سجل المخزون في نفس المعاملة."
              : "Receive any remaining subset. Stock movements commit in the same transaction."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {receivable.map((line) => (
            <div
              key={line.id}
              className="grid gap-3 items-end rounded-xl border border-border p-3 sm:grid-cols-[1fr_150px]"
            >
              <div>
                <div className="font-medium text-sm">{line.ingredientName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isRTL ? "المطلوب" : "Ordered"}: {line.orderedQuantity}{" "}
                  {line.purchaseUnit} · {isRTL ? "المستلم" : "Received"}:{" "}
                  {line.receivedQuantity} · {isRTL ? "المتبقي" : "Remaining"}:{" "}
                  {line.remainingQuantity}
                </div>
              </div>
              <Field label={isRTL ? `كمية (${line.purchaseUnit})` : `Quantity (${line.purchaseUnit})`}>
                <Input
                  type="number"
                  min="0"
                  max={line.remainingQuantity}
                  step="0.000001"
                  value={quantities[line.id] || "0"}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [line.id]: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          ))}
          <Field label={isRTL ? "ملاحظات الاستلام" : "Receipt notes"}>
            <Textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isRTL ? "تثبيت الاستلام" : "Post receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailDialog({
  order,
  isRTL,
  fmtCurrency,
  fmtNumber,
  onClose,
}: {
  order: PurchaseOrder;
  isRTL: boolean;
  fmtCurrency: (value: number) => string;
  fmtNumber: (value: number) => string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" />
            {order.orderNumber}
          </DialogTitle>
          <DialogDescription>
            {order.supplier} · {order.supplierCode} · {statusLabel(order.status, isRTL)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{isRTL ? "الإجمالي" : "Total"}</div><div className="font-bold mt-1">{fmtCurrency(order.totalCost)}</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{isRTL ? "الاستلامات" : "Receipts"}</div><div className="font-bold mt-1">{order.receiptCount}</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">{isRTL ? "الأسطر المكتملة" : "Completed lines"}</div><div className="font-bold mt-1">{order.completedLineCount}/{order.lineCount}</div></CardContent></Card>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">{isRTL ? "السطور" : "Lines"}</h3>
          {order.lines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {isRTL ? "أمر قديم بلا تفاصيل سطور" : "Legacy order without line history"}
            </div>
          ) : (
            order.lines.map((line) => (
              <div key={line.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{line.lineNumber}. {line.ingredientName}</div>
                  <div className="font-semibold text-sm">{fmtCurrency(line.lineTotal)}</div>
                </div>
                <div className="grid sm:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                  <div>{isRTL ? "المطلوب" : "Ordered"}: {fmtNumber(line.orderedQuantity)} {line.purchaseUnit}</div>
                  <div>{isRTL ? "المستلم" : "Received"}: {fmtNumber(line.receivedQuantity)} {line.purchaseUnit}</div>
                  <div>{isRTL ? "المتبقي" : "Remaining"}: {fmtNumber(line.remainingQuantity)} {line.purchaseUnit}</div>
                  <div>{isRTL ? "سعر الوحدة" : "Unit cost"}: {fmtCurrency(line.unitCost)}</div>
                </div>
              </div>
            ))
          )}
        </div>
        {order.receipts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{isRTL ? "الاستلامات" : "Receipts"}</h3>
            {order.receipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <div className="font-mono font-medium">{receipt.receiptNumber}</div>
                  <div className="text-xs text-muted-foreground">{new Date(receipt.occurredAt).toLocaleString()} · {receipt.receivedByName}</div>
                </div>
                <div className="text-end">
                  <div className="font-semibold">{fmtCurrency(receipt.totalCost)}</div>
                  <Badge variant="outline">{receipt.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        {order.cancellationReason && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {isRTL ? "سبب الإلغاء" : "Cancellation reason"}: {order.cancellationReason}
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>{isRTL ? "إغلاق" : "Close"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}
