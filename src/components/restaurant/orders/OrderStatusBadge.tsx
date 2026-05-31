"use client";

import React from "react";
import {
  ClipboardList,
  CheckCircle2,
  ChefHat,
  UtensilsCrossed,
  Package,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

/* ─── Status Config ─── */
export const STATUS_STEPS = [
  { key: "pending", icon: ClipboardList },
  { key: "confirmed", icon: CheckCircle2 },
  { key: "preparing", icon: ChefHat },
  { key: "ready", icon: UtensilsCrossed },
  { key: "completed", icon: Package },
] as const;

export const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "completed"];

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

/* ─── Types ─── */
export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers: string;
  notes: string | null;
  menuItem: {
    id: string;
    nameEn: string;
    nameAr: string;
    image: string;
    price: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  estimatedReady: string | null;
  completedAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

/* ─── Status Badge Component ─── */
interface StatusBadgeProps {
  status: string;
  statusChanged?: boolean;
  t: {
    orders: {
      status: Record<string, string>;
    };
  };
}

export function StatusBadge({ status, statusChanged, t }: StatusBadgeProps) {
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
