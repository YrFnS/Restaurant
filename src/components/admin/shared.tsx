"use client";

import { Loader2 } from "lucide-react";

export function AdminLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <span className="text-sm">{label || "Loading..."}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 size-14 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const ORDER_STATUS_META: Record<string, { label: { en: string; ar: string }; cls: string; dot: string }> = {
  pending: { label: { en: "Pending", ar: "قيد الانتظار" }, cls: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  confirmed: { label: { en: "Confirmed", ar: "مؤكد" }, cls: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  preparing: { label: { en: "Preparing", ar: "قيد التحضير" }, cls: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  ready: { label: { en: "Ready", ar: "جاهز" }, cls: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  completed: { label: { en: "Completed", ar: "مكتمل" }, cls: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-600" },
  cancelled: { label: { en: "Cancelled", ar: "ملغى" }, cls: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
};

export const TABLE_STATUS_META: Record<string, { label: { en: string; ar: string }; cls: string; ring: string; text: string }> = {
  open: { label: { en: "Open", ar: "متاحة" }, cls: "bg-emerald-500", ring: "ring-emerald-500/40", text: "text-emerald-700" },
  seated: { label: { en: "Seated", ar: "مجلوس" }, cls: "bg-amber-500", ring: "ring-amber-500/40", text: "text-amber-700" },
  ordered: { label: { en: "Ordered", ar: "تم الطلب" }, cls: "bg-sky-500", ring: "ring-sky-500/40", text: "text-sky-700" },
  served: { label: { en: "Served", ar: "تم التقديم" }, cls: "bg-violet-500", ring: "ring-violet-500/40", text: "text-violet-700" },
  paid: { label: { en: "Paid", ar: "مدفوع" }, cls: "bg-emerald-600", ring: "ring-emerald-600/40", text: "text-emerald-800" },
  cleaning: { label: { en: "Cleaning", ar: "تنظيف" }, cls: "bg-slate-400", ring: "ring-slate-400/40", text: "text-slate-700" },
  reserved: { label: { en: "Reserved", ar: "محجوز" }, cls: "bg-red-500", ring: "ring-red-500/40", text: "text-red-700" },
};

export const RESERVATION_STATUS_META: Record<string, { label: { en: string; ar: string }; cls: string }> = {
  confirmed: { label: { en: "Confirmed", ar: "مؤكد" }, cls: "bg-blue-100 text-blue-800 border-blue-200" },
  seated: { label: { en: "Seated", ar: "مجلوس" }, cls: "bg-amber-100 text-amber-800 border-amber-200" },
  completed: { label: { en: "Completed", ar: "مكتمل" }, cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: { en: "Cancelled", ar: "ملغى" }, cls: "bg-red-100 text-red-800 border-red-200" },
  no_show: { label: { en: "No Show", ar: "لم يحضر" }, cls: "bg-slate-200 text-slate-800 border-slate-300" },
};

export function StatusBadge({
  status,
  meta,
  locale,
}: {
  status: string;
  meta: Record<string, { label: { en: string; ar: string }; cls: string }>;
  locale: "en" | "ar";
}) {
  const m = meta[status] || { label: { en: status, ar: status }, cls: "bg-muted text-foreground" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${m.cls}`}>
      {m.label[locale]}
    </span>
  );
}
