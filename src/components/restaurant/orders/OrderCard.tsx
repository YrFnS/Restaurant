"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore, type CartModifier } from "@/lib/store";
import { useNotifications } from "@/hooks/use-notifications";
import { Order, getStatusColor } from "./OrderStatusBadge";
import { OrderDetailsCard } from "./OrderDetail";

/* ─── Order History Item (Collapsible) ─── */
interface OrderHistoryItemProps {
  order: Order;
  currency: string;
}

export function OrderHistoryItem({ order, currency }: OrderHistoryItemProps) {
  const { t, locale } = useI18n();
  const addToCart = useRestaurantStore((s) => s.addToCart);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const notifications = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleReorder = () => {
    let addedCount = 0;
    order.items.forEach((item) => {
      let parsedMods: CartModifier[] = [];
      try {
        const raw = JSON.parse(item.modifiers || "[]");
        parsedMods = raw.map((m: { id?: string; nameEn?: string; nameAr?: string; price?: number; type?: string }) => ({
          id: m.id || "",
          nameEn: m.nameEn || "",
          nameAr: m.nameAr || "",
          price: m.price || 0,
          type: (m.type as "addon" | "variant") || "addon",
        }));
      } catch {
        // ignore
      }

      addToCart({
        id: `${item.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        menuItemId: item.menuItemId,
        nameEn: item.menuItem.nameEn,
        nameAr: item.menuItem.nameAr,
        price: item.unitPrice,
        quantity: item.quantity,
        image: item.menuItem.image,
        modifiers: parsedMods,
        notes: item.notes || "",
        totalPrice: item.totalPrice,
      });
      addedCount++;
    });

    if (addedCount > 0) {
      notifications.cartAdded(t.orders.reorderAdded);
    }
  };

  const itemSummary =
    order.items
      .map((item) =>
        locale === "ar" ? item.menuItem.nameAr : item.menuItem.nameEn
      )
      .join(", ") || "--";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-none border-border/60">
        <CollapsibleTrigger asChild>
          <button className="w-full text-start p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm">#{order.orderNumber}</span>
                  <Badge
                    variant="secondary"
                    className={getStatusColor(order.status)}
                  >
                    {t.orders.status[
                      order.status as keyof typeof t.orders.status
                    ] || order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {itemSummary}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{formatDate(order.createdAt)}</span>
                  <span className="font-semibold text-foreground">
                    {currency}{order.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-4 text-muted-foreground" />
              </motion.div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <Separator className="mb-3" />
            <OrderDetailsCard order={order} currency={currency} />
            {order.status === "completed" && (
              <Button
                size="sm"
                className="w-full mt-3 gap-2"
                onClick={handleReorder}
              >
                <RotateCcw className="size-3.5" />
                {t.orders.reorder}
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
