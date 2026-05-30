"use client";

import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

/**
 * Hook that provides toast notification methods using sonner.
 * All text is i18n-aware and respects the current locale.
 */
export function useNotifications() {
  const { t } = useI18n();

  const cartAdded = (itemName: string) => {
    toast.success(itemName, {
      description: t.notifications.cartAdded,
      duration: 2500,
    });
  };

  const promoApplied = (code: string, discount: number) => {
    toast.success(t.notifications.promoApplied, {
      description: t.notifications.discountApplied.replace("{{percent}}", String(discount)),
      duration: 3000,
    });
  };

  const orderPlaced = (orderNumber: string) => {
    toast.success(t.notifications.orderPlaced, {
      description: t.notifications.orderNumber.replace("{{number}}", orderNumber),
      duration: 5000,
    });
  };

  const favoriteAdded = (itemName: string) => {
    toast(itemName, {
      description: t.notifications.favoriteAdded,
      duration: 2000,
      icon: "❤️",
    });
  };

  const favoriteRemoved = (itemName: string) => {
    toast(itemName, {
      description: t.notifications.favoriteRemoved,
      duration: 2000,
    });
  };

  const error = (message: string) => {
    toast.error(message, {
      duration: 4000,
    });
  };

  return {
    cartAdded,
    promoApplied,
    orderPlaced,
    favoriteAdded,
    favoriteRemoved,
    error,
  };
}
