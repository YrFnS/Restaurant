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
    updated = text[:start_index] + replacement + text[end_index:]
    file_path.write_text(updated, encoding="utf-8")
    changed_files.append(path)


replace_once(
    "prisma/seed.ts",
    """      const it = oi[k];
      await db.orderItem.create({ data: { orderId: ord.id, menuItemId: it.id, quantity: 1, unitPrice: it.price, totalPrice: it.price, modifiers: \"[]\", status: k === 0 ? \"preparing\" : \"pending\", stationSlug: stByCat[it.id] || \"prep\", course: k < 2 ? 1 : 2, hold: false, firedAt: k === 0 ? pastDate(0) : null } });
""",
    """      const it = oi[k];
      if (!it) continue;
      await db.orderItem.create({ data: { orderId: ord.id, menuItemId: it.id, quantity: 1, unitPrice: it.price, totalPrice: it.price, modifiers: \"[]\", status: k === 0 ? \"preparing\" : \"pending\", stationSlug: stByCat[it.id] || \"prep\", course: k < 2 ? 1 : 2, hold: false, firedAt: k === 0 ? pastDate(0) : null } });
""",
)

qr_path = "src/app/menu/qr/[tableNumber]/page.tsx"
replace_once(
    qr_path,
    'import { use, useState, useEffect } from "react";',
    'import { use, useEffect, useMemo, useRef, useState } from "react";',
)
replace_once(
    qr_path,
    'import { useI18n } from "@/lib/i18n";\nimport { useQuery, useQueryClient } from "@tanstack/react-query";',
    'import { useI18n } from "@/lib/i18n";\nimport { useRestaurantStore } from "@/lib/store";\nimport { useQuery } from "@tanstack/react-query";',
)
replace_once(
    qr_path,
    """interface CartLine {
""",
    """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `qr-order-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

interface CartLine {
""",
)
replace_once(
    qr_path,
    """  const { tableNumber } = use(params);
  const qc = useQueryClient();
""",
    """  const { tableNumber } = use(params);
  const rememberOrderAccess = useRestaurantStore(
    (state) => state.rememberOrderAccess
  );
""",
)
replace_once(
    qr_path,
    """  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
""",
    """  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
""",
)
replace_once(
    qr_path,
    """  const { data: tableData } = useQuery({
    queryKey: [\"tables\"],
    queryFn: async () => (await fetch(\"/api/tables\")).json(),
  });

""",
    "",
)
replace_once(
    qr_path,
    """  const categories: any[] = menuData?.categories || [];
  const tables: any[] = tableData?.tables || [];
  const table = tables.find((t) => String(t.number) === String(tableNumber));
  const allItems = categories.flatMap((c) => c.items);
""",
    """  const categories: any[] = menuData?.categories || [];
  const allItems = categories.flatMap((category) => category.items);
""",
)
replace_once(
    qr_path,
    """  const total = subtotal + tax;

  const quickAdd = (item: any) => {
""",
    """  const total = subtotal + tax;
  const orderPayload = useMemo(
    () => ({
      type: \"dine_in\" as const,
      customerName,
      customerPhone,
      tableNumber,
      notes: orderNotes || null,
      promoCode: null,
      tip: { mode: \"none\" as const },
      items: cart.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifierOptionIds: line.modifiers.map((modifier) => modifier.id),
        notes: line.notes || null,
        course: 1,
      })),
    }),
    [cart, customerName, customerPhone, orderNotes, tableNumber]
  );
  const orderFingerprint = useMemo(
    () => JSON.stringify(orderPayload),
    [orderPayload]
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [orderFingerprint]);

  const quickAdd = (item: any) => {
""",
)
replace_between(
    qr_path,
    "  const placeOrder = async () => {",
    "\n\n  return (",
    """  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!customerName) {
      toast.error(t.cart.customerName);
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
      setCart([]);
      setCartOpen(false);
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
replace_once(
    qr_path,
    '{t.cart.viewCart || "View Cart"}',
    '{isRTL ? "عرض السلة" : "View Cart"}',
)
replace_once(
    qr_path,
    '<Sheet open onClose={onClose} onOpenChange={(o) => !o && onClose()}>',
    '<Sheet open onOpenChange={(open) => !open && onClose()}>',
)

replace_once(
    "src/components/admin/tabs/KdsScreensTab.tsx",
    "function MetaPill({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {",
    "function MetaPill({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {",
)

replace_once(
    "src/components/admin/tabs/ReportsTab.tsx",
    "    const days = [];",
    "    const days: Array<{ day: string; Sales: number; Orders: number }> = [];",
)

replace_once(
    "src/components/admin/tabs/ReservationsTab.tsx",
    """  const grouped = filtered.reduce((acc, r) => {
    const d = new Date(r.dateTime).toDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {} as Record<string, any[]>);
""",
    """  const grouped = filtered.reduce<Record<string, any[]>>((acc, reservation) => {
    const date = new Date(reservation.dateTime).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(reservation);
    return acc;
  }, {});
""",
)

replace_once(
    "src/components/kds/KitchenDisplay.tsx",
    """      if (!r.ok) return null;
      return r.json();
""",
    """      if (!r.ok) return { screen: null, stations: [] };
      return (await r.json()) as KdsScreenResponse;
""",
)
replace_once(
    "src/components/kds/KitchenDisplay.tsx",
    "    initialData: initialScreen,",
    "    initialData: initialScreen ?? undefined,",
)
replace_once(
    "src/components/kds/KitchenDisplay.tsx",
    """      const r = await fetch(\"/api/settings\", { cache: \"no-store\" });
      const d = await r.json();
      return d.settings;
""",
    """      const r = await fetch(\"/api/settings\", { cache: \"no-store\" });
      if (!r.ok) throw new Error(\"settings fetch failed\");
      const d = await r.json();
      if (!d?.settings) throw new Error(\"settings missing\");
      return d.settings as KdsSettings;
""",
)
replace_once(
    "src/components/kds/KitchenDisplay.tsx",
    "    initialData: initialSettings,",
    "    initialData: initialSettings ?? undefined,",
)

replace_once(
    "src/components/pos/OrderTicket.tsx",
    't.pos.orderType',
    '(isRTL ? "نوع الطلب" : "Order type")',
)
replace_once(
    "src/components/pos/OrderTicket.tsx",
    'itemCount === 1 ? t.orders.item : t.orders.items',
    'itemCount === 1 ? (isRTL ? "صنف" : "item") : t.orders.items',
)

replace_between(
    "src/components/pos/SplitBillDialog.tsx",
    "  const payGuest = async (guestIdx: number) => {",
    "\n\n  const modes:",
    """  const payGuest = async (_guestIdx: number) => {
    toast.error(
      isRTL
        ? \"تم تعطيل الدفع المجزأ مؤقتاً حتى يتم ربطه بسجل دفع آمن.\"
        : \"Split payments are temporarily disabled until the secure payment ledger is available.\"
    );
  };
""",
)
replace_once(
    "src/components/pos/SplitBillDialog.tsx",
    '{t.pos.items || "items"}',
    '{isRTL ? "أصناف" : "items"}',
)

replace_once(
    "src/components/restaurant/MenuSection.tsx",
    '{t.menu.recentSearches}:',
    '{isRTL ? "عمليات البحث الأخيرة" : "Recent searches"}:',
)

replace_once(
    "src/proxy.ts",
    "function decodeBase64Url(value: string): Uint8Array | null {",
    "function decodeBase64Url(value: string): ArrayBuffer | null {",
)
replace_once(
    "src/proxy.ts",
    "    return Uint8Array.from(binary, (character) => character.charCodeAt(0));",
    "    return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;",
)

replace_once(
    "tsconfig.json",
    '    "skipLibCheck": true,\n',
    '    "skipLibCheck": true,\n    "types": ["bun-types"],\n',
)

print("Applied strict-TypeScript fixes to:")
for path in sorted(set(changed_files)):
    print(f"- {path}")
