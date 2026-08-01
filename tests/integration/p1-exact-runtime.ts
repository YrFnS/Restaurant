import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.240";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-exact-runtime-${crypto.randomUUID()}`);

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("origin", BASE_URL);
    headers.set("sec-fetch-site", "same-origin");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  const raw = await response.text();
  let data: Json = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON ${response.status}: ${raw.slice(0, 500)}`
      );
    }
  }
  return { response, data };
}

function expectStatus(
  result: { response: Response; data: Json },
  expected: number,
  message: string
) {
  assert.equal(
    result.response.status,
    expected,
    `${message}: expected ${expected}, received ${result.response.status} (${JSON.stringify(
      result.data
    )})`
  );
}

function assertNoExactKeys(value: unknown, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoExactKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    assert.ok(
      !/(Minor|Micros|BasisPoints)$/.test(key),
      `HTTP response leaked exact BigInt field ${path}.${key}`
    );
    assertNoExactKeys(nested, `${path}.${key}`);
  }
}

async function login(): Promise<string> {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "1234" }),
  });
  expectStatus(result, 200, "Administrative login");
  const setCookie = result.response.headers.get("set-cookie");
  assert.ok(setCookie, "Login must set a session cookie");
  return setCookie.split(";", 1)[0];
}

async function main() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const originalRules = await db.dynamicPricing.findMany({
    select: { id: true, isActive: true },
  });

  try {
    await db.dynamicPricing.updateMany({ data: { isActive: false } });

    const category = await db.menuCategory.findFirst({
      where: { isAvailable: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    assert.ok(category, "Seed data must include an available menu category");

    const adminCookie = await login();
    const createItem = await request("/api/menu", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        type: "item",
        nameEn: `P1 Exact Runtime ${suffix}`,
        nameAr: `P1 ${suffix}`,
        descriptionEn: "Exact half-up runtime test",
        descriptionAr: "Exact half-up runtime test",
        price: 1.005,
        categoryId: category.id,
        preparationTime: 1,
        calories: 0,
        modifierGroups: [],
      }),
    });
    expectStatus(createItem, 201, "Create exact-price menu item");
    assertNoExactKeys(createItem.data);
    const itemId = String(createItem.data?.item?.id || "");
    assert.ok(itemId, "Menu creation must return an item ID");

    const storedItem = await db.menuItem.findUnique({
      where: { id: itemId },
      select: { price: true, priceMinor: true },
    });
    assert.ok(storedItem);
    assert.equal(storedItem.priceMinor, BigInt(101));
    assert.equal(
      storedItem.price,
      1.005,
      "Compatibility price remains available during expand/cutover"
    );

    const orderBody = {
      type: "takeout",
      customerName: "P1 Exact Runtime",
      customerPhone: "",
      notes: "Exact runtime integration test",
      tip: { mode: "none" },
      items: [
        {
          menuItemId: itemId,
          quantity: 1,
          modifierOptionIds: [],
          notes: null,
          course: 1,
        },
      ],
    };

    const quote = await request("/api/orders/quote", {
      method: "POST",
      body: JSON.stringify(orderBody),
    });
    expectStatus(quote, 200, "Exact order quote");
    assertNoExactKeys(quote.data);
    assert.equal(
      quote.data?.quote?.subtotal,
      1.01,
      "The exact engine must round 1.005 half-up to 1.01"
    );

    const order = await request("/api/orders", {
      method: "POST",
      headers: {
        "idempotency-key": `p1-exact-runtime-${suffix}`,
      },
      body: JSON.stringify(orderBody),
    });
    expectStatus(order, 201, "Create exact-price order");
    assertNoExactKeys(order.data);
    assert.equal(order.data?.order?.subtotal, 1.01);
    const orderId = String(order.data?.order?.id || "");
    const orderNumber = String(order.data?.order?.orderNumber || "");
    assert.ok(orderId && orderNumber, "Order creation must return identifiers");

    const exactOrder = await db.order.findUnique({
      where: { id: orderId },
      select: {
        subtotalMinor: true,
        taxAmountMinor: true,
        deliveryFeeMinor: true,
        discountAmountMinor: true,
        tipAmountMinor: true,
        totalMinor: true,
        items: {
          select: { unitPriceMinor: true, totalPriceMinor: true },
        },
      },
    });
    assert.ok(exactOrder);
    assert.equal(exactOrder.subtotalMinor, BigInt(101));
    assert.equal(exactOrder.items.length, 1);
    assert.equal(exactOrder.items[0].unitPriceMinor, BigInt(101));
    assert.equal(exactOrder.items[0].totalPriceMinor, BigInt(101));
    assert.equal(
      exactOrder.totalMinor,
      exactOrder.subtotalMinor +
        exactOrder.taxAmountMinor +
        exactOrder.deliveryFeeMinor -
        exactOrder.discountAmountMinor +
        exactOrder.tipAmountMinor
    );

    const checkout = await request("/api/pos/checkout", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        orderId,
        paymentMethod: "cash",
      }),
    });
    expectStatus(checkout, 200, "Exact cash checkout without explicit tender");
    assertNoExactKeys(checkout.data);
    assert.equal(checkout.data?.payment?.change, 0);
    assert.equal(
      checkout.data?.payment?.tendered,
      checkout.data?.payment?.total,
      "Omitted tender must default to the exact stored total"
    );

    const payment = await db.paymentEvent.findFirst({
      where: { orderId, eventType: "capture", status: "succeeded" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        tenderedCents: true,
        changeCents: true,
      },
    });
    assert.ok(payment);
    assert.equal(payment.amountCents, Number(exactOrder.totalMinor));
    assert.equal(payment.tenderedCents, payment.amountCents);
    assert.equal(payment.changeCents, 0);

    const drawerRows = await db.$queryRaw<
      Array<{ id: string; amountMinor: bigint }>
    >(Prisma.sql`
      SELECT "id", "amountMinor"
      FROM "CashDrawerEntry"
      WHERE "note" LIKE ${`%${orderNumber}%`}
    `);
    assert.equal(drawerRows.length, 1);
    assert.equal(drawerRows[0].amountMinor, exactOrder.totalMinor);

    const cash = await request("/api/cash", {
      headers: { cookie: adminCookie },
    });
    expectStatus(cash, 200, "Exact cash ledger read");
    assertNoExactKeys(cash.data);
    const matchingEntry = (cash.data?.entries || []).find((entry: any) =>
      String(entry.note || "").includes(String(orderNumber))
    );
    assert.ok(matchingEntry, "Cash response must include the exact sale entry");
    assert.equal(matchingEntry.amount, Number(exactOrder.totalMinor) / 100);

    const exactBalanceRows = await db.$queryRaw<Array<{ balanceMinor: bigint }>>(
      Prisma.sql`
        SELECT COALESCE(
          SUM(
            CASE
              WHEN "type"::text IN ('refund', 'payout', 'drop')
                THEN -"amountMinor"
              ELSE "amountMinor"
            END
          ),
          0
        )::bigint AS "balanceMinor"
        FROM "CashDrawerEntry"
      `
    );
    assert.equal(cash.data?.balance, Number(exactBalanceRows[0].balanceMinor) / 100);

    console.log(
      "[p1-exact-runtime] Exact quote, order, checkout, and cash assertions passed."
    );
  } finally {
    // Payment events are intentionally immutable. The integration database is
    // disposable, so this test leaves its uniquely named financial graph in
    // place instead of weakening the ledger with a cleanup bypass.
    for (const rule of originalRules) {
      await db.dynamicPricing.update({
        where: { id: rule.id },
        data: { isActive: rule.isActive },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("[p1-exact-runtime] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
