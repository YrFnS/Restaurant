"use client";

import React from "react";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";

export function CartSheet() {
  const { t, isRTL, locale } = useI18n();
  const cart = useRestaurantStore((s) => s.cart);
  const isCartOpen = useRestaurantStore((s) => s.isCartOpen);
  const setIsCartOpen = useRestaurantStore((s) => s.setIsCartOpen);
  const removeFromCart = useRestaurantStore((s) => s.removeFromCart);
  const updateCartItemQuantity = useRestaurantStore((s) => s.updateCartItemQuantity);
  const setActiveSection = useRestaurantStore((s) => s.setActiveSection);
  const settings = useRestaurantStore((s) => s.settings);

  const currency = settings?.currencySymbol ?? "";
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * (settings?.taxRate ?? 0);
  const total = subtotal + tax;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleBrowseMenu = () => {
    setIsCartOpen(false);
    setActiveSection("menu");
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        side={isRTL ? "left" : "right"}
        className="w-full sm:max-w-md flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            {t.cart.title}
            {cartItemCount > 0 && (
              <Badge variant="secondary" className="ms-auto">
                {cartItemCount} {cartItemCount === 1 ? t.cart.item : t.cart.items}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {cart.length === 0
              ? t.cart.emptyDesc
              : t.cart.readyToOrder}
          </SheetDescription>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <div className="size-20 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="size-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {t.cart.empty}
            </p>
            <Button onClick={handleBrowseMenu} className="gap-2">
              {t.cart.browseMenu}
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="flex flex-col gap-3 py-2">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    {/* Item Image */}
                    {item.image && (
                      <div className="size-14 rounded-md overflow-hidden shrink-0 bg-muted">
                        <img
                          src={item.image}
                          alt={locale === "ar" ? item.nameAr : item.nameEn}
                          className="size-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm leading-tight truncate">
                          {locale === "ar" ? item.nameAr : item.nameEn}
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={t.cart.remove}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      {/* Modifiers */}
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.modifiers
                            .map((m) => (locale === "ar" ? m.nameAr : m.nameEn))
                            .join(", ")}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() =>
                              updateCartItemQuantity(
                                item.id,
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            onClick={() =>
                              updateCartItemQuantity(item.id, item.quantity + 1)
                            }
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <span className="font-semibold text-sm text-primary">
                          {currency}
                          {item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.subtotal}</span>
                <span className="font-medium">
                  {currency}
                  {subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.cart.tax}</span>
                <span className="font-medium">
                  {currency}
                  {tax.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.cart.total}</span>
                <span className="font-bold text-lg text-primary">
                  {currency}
                  {total.toFixed(2)}
                </span>
              </div>
            </div>

            <SheetFooter className="pt-2">
              <Button className="w-full gap-2" size="lg">
                {t.cart.checkout}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
