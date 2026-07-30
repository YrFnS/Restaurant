from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
changed_files: list[str] = []


def replace_once(path: str, old: str, new: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old in text:
        file_path.write_text(text.replace(old, new, 1), encoding="utf-8")
        changed_files.append(path)
        return
    if new in text:
        return
    raise RuntimeError(f"Expected source block was not found in {path}")


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if replacement in text:
        return
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"Start marker was not found in {path}: {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"End marker was not found in {path}: {end!r}")
    file_path.write_text(
        text[:start_index] + replacement + text[end_index:],
        encoding="utf-8",
    )
    changed_files.append(path)


# The route parameters already initialize these fields, and in-app navigation
# carries the edited values forward. Removing the synchronous state-reset effect
# satisfies React's effect semantics without changing the tracking workflow.
replace_once(
    "src/app/track/[orderNumber]/page.tsx",
    """  useEffect(() => {
    setInputNumber(routeOrderNumber);
    setInputToken(accessToken);
  }, [accessToken, routeOrderNumber]);

""",
    "",
)

cart_path = "src/components/layout/CartSheet.tsx"
replace_once(
    cart_path,
    'import { useState } from "react";',
    'import { useEffect, useMemo, useRef, useState } from "react";',
)
replace_once(
    cart_path,
    """import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Gift, Sparkles } from \"lucide-react\";
import { useEffect, useMemo, useRef, useState } from \"react\";

export function CartSheet""",
    """import { Minus, Plus, Trash2, ShoppingBag, Tag, X, Gift, Sparkles } from \"lucide-react\";
import { useEffect, useMemo, useRef, useState } from \"react\";

function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `sheet-order-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function CartSheet""",
)
replace_once(
    cart_path,
    """    setPromo, clearPromo, tipPercent, tipCustom, setTip,
    orderNotes, setOrderNotes, setActiveSection,
""",
    """    setPromo, clearPromo, tipPercent, tipCustom, setTip,
    orderNotes, setOrderNotes, setActiveSection,
    recentOrders, rememberOrderAccess,
""",
)
replace_once(
    cart_path,
    """  const [loyaltyLooking, setLoyaltyLooking] = useState(false);
""",
    """  const [loyaltyLooking, setLoyaltyLooking] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
""",
)
replace_once(
    cart_path,
    "  const avgPrepMin = s?.avgPrepTimeMin ?? 25;\n",
    "",
)
replace_once(
    cart_path,
    "  const loyaltyDisc = loyaltyDiscount;",
    "  const loyaltyDisc = 0;",
)
replace_once(
    cart_path,
    """  const total = Math.max(0, subtotal + tax + deliveryFee - discount - loyaltyDisc + tipAmount);

  const applyPromo = async () => {
""",
    """  const total = Math.max(0, subtotal + tax + deliveryFee - discount + tipAmount);
  const orderPayload = useMemo(
    () => ({
      type: orderType,
      customerName: customerName || \"\",
      customerPhone,
      deliveryAddress: orderType === \"delivery\" ? deliveryAddress : null,
      tableNumber: orderType === \"dine_in\" ? tableNumber : undefined,
      notes: orderNotes || null,
      promoCode: promoCode || null,
      tip:
        tipPercent > 0
          ? { mode: \"percent\" as const, value: tipPercent }
          : tipCustom > 0
            ? { mode: \"amount\" as const, value: tipCustom }
            : { mode: \"none\" as const },
      items: cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierOptionIds: item.modifiers.map((modifier) => modifier.id),
        notes: item.notes || null,
        course: item.course,
      })),
    }),
    [
      cart,
      customerName,
      customerPhone,
      deliveryAddress,
      orderNotes,
      orderType,
      promoCode,
      tableNumber,
      tipCustom,
      tipPercent,
    ]
  );
  const orderFingerprint = useMemo(
    () => JSON.stringify(orderPayload),
    [orderPayload]
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [orderFingerprint]);

  const applyPromo = async () => {
""",
)
replace_between(
    cart_path,
    "  const lookupLoyalty = async () => {",
    "\n\n  const redeemPoints",
    """  const lookupLoyalty = async () => {
    if (recentOrders.length === 0) {
      toast.error(
        isRTL
          ? \"أنشئ طلباً أو افتح رابط طلب آمن أولاً للتحقق من النقاط\"
          : \"Place an order or open a secure order link before checking points\"
      );
      return;
    }

    setLoyaltyLooking(true);
    try {
      const response = await fetch(\"/api/customers/lookup\", {
        method: \"POST\",
        headers: { \"Content-Type\": \"application/json\" },
        body: JSON.stringify({ orders: recentOrders }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.customer) {
        setLoyaltyCustomer({
          ...data.customer,
          redemptionOptions: data.redemptionOptions || [],
        });
        toast.success(
          `${isRTL ? \"أهلاً\" : \"Welcome\"} ${data.customer.name} · ${data.customer.loyaltyPoints} ${isRTL ? \"نقطة\" : \"pts\"}`
        );
      } else {
        toast.error(data?.error || (isRTL ? \"تعذر التحقق من الحساب\" : \"Unable to verify loyalty account\"));
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoyaltyLooking(false);
    }
  };
""",
)
replace_between(
    cart_path,
    "  const redeemPoints = async (points: number, value: number) => {",
    "\n\n  const clearLoyalty",
    """  const redeemPoints = async (_points: number, _value: number) => {
    toast.error(
      isRTL
        ? \"استبدال النقاط معطل حتى يتم تطبيقه داخل معاملة دفع آمنة\"
        : \"Point redemption is disabled until it is part of a secure checkout transaction\"
    );
  };
""",
)
replace_between(
    cart_path,
    "  const placeOrder = async () => {",
    "\n\n  const orderTypes =",
    """  const placeOrder = async () => {
    if (orderType === \"delivery\" && subtotal < minDeliveryOrder) {
      toast.error(
        t.cart.minOrderNotMet.replace(
          \"{amount}\",
          fmtCurrency(minDeliveryOrder)
        )
      );
      return;
    }
    if (orderType === \"delivery\" && !deliveryAddress) {
      toast.error(t.cart.deliveryAddress);
      return;
    }
    if (orderType === \"delivery\" && !customerPhone) {
      toast.error(t.cart.customerPhone);
      return;
    }
    if (orderType === \"dine_in\" && !tableNumber) {
      toast.error(t.cart.selectTable);
      return;
    }

    setPlacing(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const response = await fetch(\"/api/orders\", {
        method: \"POST\",
        headers: {
          \"Content-Type\": \"application/json\",
          \"Idempotency-Key\": idempotencyKeyRef.current,
        },
        body: JSON.stringify(orderPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order || !data?.accessToken) {
        toast.error(data?.error || t.common.error);
        return;
      }

      rememberOrderAccess(data.order.orderNumber, data.accessToken);
      toast.success(`${t.cart.orderPlaced} ${data.order.orderNumber}`);
      clearCart();
      onOpenChange(false);
      idempotencyKeyRef.current = null;

      const orderNumber = data.order.orderNumber.replace(/^#/, \"\");
      window.location.assign(
        `/track/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(
          data.accessToken
        )}`
      );
    } catch {
      toast.error(t.common.error);
    } finally {
      setPlacing(false);
    }
  };
""",
)

payment_path = "src/components/pos/PaymentDialog.tsx"
replace_once(
    payment_path,
    'import { useEffect, useMemo, useState } from "react";',
    'import { useEffect, useMemo, useRef, useState } from "react";',
)
replace_once(
    payment_path,
    """interface PaymentDialogProps {
""",
    """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `pos-payment-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

interface PaymentDialogProps {
""",
)
replace_once(
    payment_path,
    """  const [isProcessing, setIsProcessing] = useState(false);
""",
    """  const [isProcessing, setIsProcessing] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
""",
)
replace_once(
    payment_path,
    """    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMethod(\"cash\");
      setTenderedStr(\"\");
      setIsProcessing(false);
    }
""",
    """    if (open) {
      setMethod(\"cash\");
      setTenderedStr(\"\");
      setIsProcessing(false);
      idempotencyKeyRef.current = null;
    }
""",
)
replace_between(
    payment_path,
    "  async function handleComplete() {",
    "\n\n  return (",
    """  async function handleComplete() {
    if (!canComplete || isProcessing) return;
    if (method === \"card\") {
      toast.error(
        isRTL
          ? \"الدفع بالبطاقة معطل حتى يتم ربط مزود دفع\"
          : \"Card payment is disabled until a payment processor is configured\"
      );
      return;
    }
    if (orderType === \"dine_in\" && !table) {
      toast.error(t.pos.noTableSelected);
      return;
    }
    if (orderType === \"delivery\" && (!deliveryAddress.trim() || !customerPhone.trim())) {
      toast.error(t.cart.deliveryAddress);
      return;
    }

    setIsProcessing(true);
    idempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const orderPayload = {
        type: orderType,
        customerName:
          customerName || (table ? `Table ${table.number}` : \"Walk-in\"),
        customerPhone,
        deliveryAddress:
          orderType === \"delivery\" ? deliveryAddress : null,
        tableNumber: orderType === \"dine_in\" ? table?.number : undefined,
        notes: notes || null,
        promoCode: null,
        tip:
          tip > 0
            ? { mode: \"amount\" as const, value: tip }
            : { mode: \"none\" as const },
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifierOptionIds: item.modifiers.map((modifier) => modifier.id),
          notes: item.notes || null,
          course: item.course,
        })),
      };

      const createResponse = await fetch(\"/api/orders\", {
        method: \"POST\",
        headers: {
          \"Content-Type\": \"application/json\",
          \"Idempotency-Key\": idempotencyKeyRef.current,
        },
        body: JSON.stringify(orderPayload),
      });
      const createData = await createResponse.json().catch(() => null);
      if (!createResponse.ok || !createData?.order) {
        throw new Error(createData?.error || t.common.error);
      }

      const checkoutResponse = await fetch(\"/api/pos/checkout\", {
        method: \"POST\",
        headers: { \"Content-Type\": \"application/json\" },
        body: JSON.stringify({
          orderId: createData.order.id,
          paymentMethod: \"cash\",
          tendered,
        }),
      });
      const checkoutData = await checkoutResponse.json().catch(() => null);
      if (!checkoutResponse.ok || !checkoutData?.order || !checkoutData?.payment) {
        throw new Error(checkoutData?.error || t.common.error);
      }

      idempotencyKeyRef.current = null;
      toast.success(`${t.pos.saleCompleted} ${checkoutData.order.orderNumber}`, {
        description:
          checkoutData.payment.change > 0
            ? `${t.pos.change}: ${fmtCurrency(checkoutData.payment.change)}`
            : undefined,
      });

      onComplete({
        orderId: checkoutData.order.id,
        orderNumber: checkoutData.order.orderNumber,
        method: \"cash\",
        tendered: checkoutData.payment.tendered,
        change: checkoutData.payment.change,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setIsProcessing(false);
    }
  }
""",
)
replace_once(
    payment_path,
    """          <MethodButton
            active={method === \"card\"}
            onClick={() => setMethod(\"card\")}
            icon={<CreditCard className=\"size-5\" />}
            label={t.pos.card}
          />
""",
    """          <MethodButton
            active={false}
            onClick={() =>
              toast.error(
                isRTL
                  ? \"الدفع بالبطاقة غير متاح حالياً\"
                  : \"Card payment is not available yet\"
              )
            }
            icon={<CreditCard className=\"size-5\" />}
            label={`${t.pos.card} · ${isRTL ? \"غير متاح\" : \"Unavailable\"}`}
          />
""",
)

pos_path = "src/components/pos/PosTerminal.tsx"
replace_once(
    pos_path,
    'import { useEffect, useMemo, useState } from "react";',
    'import { useEffect, useMemo, useRef, useState } from "react";',
)
replace_once(
    pos_path,
    """type LeftView = \"menu\" | \"floor\";

export function PosTerminal""",
    """type LeftView = \"menu\" | \"floor\";

function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `pos-kitchen-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function PosTerminal""",
)
replace_once(
    pos_path,
    """  const [isSending, setIsSending] = useState(false);
""",
    """  const [isSending, setIsSending] = useState(false);
  const kitchenIdempotencyKeyRef = useRef<string | null>(null);
""",
)
replace_once(
    pos_path,
    """  const deliveryFee = settings?.deliveryFee ?? 4.99;

  // ─── Item ops ───
""",
    """  const deliveryFee = settings?.deliveryFee ?? 4.99;
  const kitchenOrderPayload = useMemo(
    () => ({
      type: orderType,
      customerName:
        customerName ||
        (selectedTable ? `Table ${selectedTable.number}` : \"Walk-in\"),
      customerPhone,
      deliveryAddress:
        orderType === \"delivery\" ? deliveryAddress : null,
      tableNumber:
        orderType === \"dine_in\" ? selectedTable?.number : undefined,
      notes: notes || null,
      promoCode: null,
      tip:
        tip > 0
          ? { mode: \"amount\" as const, value: tip }
          : { mode: \"none\" as const },
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierOptionIds: item.modifiers.map((modifier) => modifier.id),
        notes: item.notes || null,
        course: item.course,
      })),
    }),
    [
      customerName,
      customerPhone,
      deliveryAddress,
      items,
      notes,
      orderType,
      selectedTable,
      tip,
    ]
  );
  const kitchenOrderFingerprint = useMemo(
    () => JSON.stringify(kitchenOrderPayload),
    [kitchenOrderPayload]
  );

  useEffect(() => {
    kitchenIdempotencyKeyRef.current = null;
  }, [kitchenOrderFingerprint]);

  // ─── Item ops ───
""",
)
replace_between(
    pos_path,
    "  const handleSendToKitchen = async () => {",
    "\n\n  const handlePayComplete",
    """  const handleSendToKitchen = async () => {
    if (items.length === 0) return;
    if (orderType === \"dine_in\" && !selectedTable) {
      toast.error(t.pos.noTableSelected);
      setLeftView(\"floor\");
      setMobileTab(\"floor\");
      return;
    }
    if (orderType === \"delivery\" && !deliveryAddress.trim()) {
      toast.error(t.cart.deliveryAddress);
      return;
    }
    if (orderType === \"delivery\" && !customerPhone.trim()) {
      toast.error(t.cart.customerPhone);
      return;
    }

    setIsSending(true);
    kitchenIdempotencyKeyRef.current ??= createIdempotencyKey();

    try {
      const response = await fetch(\"/api/orders\", {
        method: \"POST\",
        headers: {
          \"Content-Type\": \"application/json\",
          \"Idempotency-Key\": kitchenIdempotencyKeyRef.current,
        },
        body: JSON.stringify(kitchenOrderPayload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order) {
        throw new Error(data?.error || t.common.error);
      }

      qc.invalidateQueries({ queryKey: [\"pos-tables\"] });
      toast.success(`${t.pos.sentToKitchen} — ${data.order.orderNumber}`);
      kitchenIdempotencyKeyRef.current = null;
      clearAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setIsSending(false);
    }
  };
""",
)

# Remove stale suppressions now that the guarded code is valid under the current
# React lint rules.
replace_once(
    "src/components/ui/carousel.tsx",
    '    onSelect(api) // eslint-disable-line react-hooks/set-state-in-effect',
    '    onSelect(api)',
)
replace_once(
    "src/hooks/use-mobile.ts",
    '    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) // eslint-disable-line react-hooks/set-state-in-effect',
    '    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)',
)

print("Applied secure checkout and lint fixes to:")
for path in sorted(set(changed_files)):
    print(f"- {path}")
