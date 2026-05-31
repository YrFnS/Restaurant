"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

/* ─── Status Config ─── */
const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "completed"];

export function getStatusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "confirmed":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "preparing":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "ready":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface OrderStatusBadgeProps {
  status: string;
  statusChanged?: boolean;
}

export function OrderStatusBadge({ status, statusChanged }: OrderStatusBadgeProps) {
  const { t } = useI18n();

  return (
    <motion.div
      animate={statusChanged ? { scale: [1, 1.2, 1], opacity: [1, 0.5, 1], backgroundColor: ["hsl(var(--primary))", "hsl(var(--primary) / 50%)", "hsl(var(--primary))"] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <Badge className={`${getStatusColor(status)} ${statusChanged ? "ring-2 ring-primary/40" : ""}`}>
        {t.orders.status[status as keyof typeof t.orders.status] || status}
      </Badge>
    </motion.div>
  );
}
