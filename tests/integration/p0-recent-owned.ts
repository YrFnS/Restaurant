import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.39";
const TEST_SCOPES = [
  "order-create",
  "reservation-availability",
  "reservation-create",
  "recent-orders-lookup",
  "recent-reservations-lookup",
  "loyalty-lookup",
];

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-recent-${crypto.randomUUID()}`);

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
        `${method} ${path} returned non-JSON ${response.status}: ${raw.slice(0, 400)}`
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

function assertNoKeysMatching(value: unknown, pattern: RegExp, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoKeysMatching(entry, pattern, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    assert.ok(!pattern.test(key), `Sensitive key ${path}.${key} was exposed`);
    assertNoKeysMatching(nested, pattern, `${path}.${key}`);
  }
}

function uniquePhone(prefix: string): string {
  return `+964${prefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 7)}`;
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}

async function createOrder(
  itemId: string,
  label: string,
  customerPhone = ""
) {
  const result = await request("/api/orders", {
    method: "POST",
    headers: { "idempotency-key": `p0-recent-order-${crypto.randomUUID()}` },
    body: JSON.stringify({
      type: "takeout",
      customerName: `P0 Recent Order ${label}`,
      customerPhone,
      notes: `Recent ownership test ${label}`,
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
    }),
  });
  expectStatus(result, 201, `Create recent order ${label}`);
  assert.ok(result.data?.order?.id, "Order creation must return an ID");
  assert.ok(result.data?.accessToken, "Order creation must return an access token");
  return result.data as any;
}

async function createReservation(label: string, daysAhead: number) {
  const date = futureDate(daysAhead);
  const availability = await request(
    `/api/reservations/availability?${new URLSearchParams({
      date,
      partySize: "2",
    })}`
  );
  expectStatus(
    availability,
    200,
    `Load recent reservation availability ${label}`
  );
  const time = availability.data?.slots?.[0]?.time;
  assert.ok(
    time,
    `Recent reservation ${label} must have a server-approved slot`
  );

  const result = await request("/api/reservations", {
    method: "POST",
    headers: {
      "Idempotency-Key": `p0-recent-reservation-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      customerName: `P0 Recent Reservation ${label}`,
      customerPhone: uniquePhone("706"),
      customerEmail: null,
      partySize: 2,
      date,
      time,
      occasion: null,
      preference: null,
      notes: `Recent ownership test ${label}`,
    }),
  });
  expectStatus(result, 201, `Create recent reservation ${label}`);
  assert.ok(result.data?.reservation?.id, "Reservation creation must return an ID");
  assert.ok(
    result.data?.accessToken,
    "Reservation creation must return an access token"
  );
  const stored = await db.reservation.findUnique({
    where: { id: result.data.reservation.id },
    select: { customerId: true },
  });
  return { ...(result.data as any), customerId: stored?.customerId || null };
}

async function main() {
  const startedAt = new Date(Date.now() - 1_000);
  const createdOrderIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdCustomerIds: string[] = [];

  try {
    const menuItems = await db.menuItem.findMany({
      where: { isAvailable: true },
      include: { category: true, modifierGroups: true },
    });
    const item = menuItems.find(
      (candidate) =>
        candidate.category.isAvailable &&
        candidate.modifierGroups.every(
          (group) => Math.max(group.minSelect, group.isRequired ? 1 : 0) === 0
        )
    );
    assert.ok(item, "Seed data must contain an item without required modifiers");

    const orderA = await createOrder(item.id, "A");
    const orderB = await createOrder(item.id, "B");
    const loyaltyPhone = uniquePhone("707");
    const loyaltyOrder = await createOrder(item.id, "Loyalty", loyaltyPhone);
    createdOrderIds.push(
      orderA.order.id,
      orderB.order.id,
      loyaltyOrder.order.id
    );

    const storedLoyaltyOrder = await db.order.findUnique({
      where: { id: loyaltyOrder.order.id },
      select: { customerId: true },
    });
    assert.ok(
      storedLoyaltyOrder?.customerId,
      "Phone-linked order must persist a customer relationship"
    );
    createdCustomerIds.push(storedLoyaltyOrder.customerId);

    console.log("[p0-recent] validating mixed recent-order credentials");
    const mixedOrders = await request("/api/orders/recent", {
      method: "POST",
      body: JSON.stringify({
        orders: [
          {
            orderNumber: orderA.order.orderNumber,
            accessToken: orderA.accessToken,
          },
          {
            orderNumber: orderB.order.orderNumber,
            accessToken: orderA.accessToken,
          },
          {
            orderNumber: "#R-MISSING-OWNERSHIP",
            accessToken: orderB.accessToken,
          },
        ],
      }),
    });
    expectStatus(mixedOrders, 200, "Mixed recent-order lookup");
    assert.equal(mixedOrders.response.headers.get("ratelimit-limit"), "60");
    assert.deepEqual(
      mixedOrders.data?.orders?.map((order: any) => order.id),
      [orderA.order.id],
      "Batch lookup must return only orders with the matching resource token"
    );
    assertNoKeysMatching(
      mixedOrders.data,
      /^(customerPhone|deliveryAddress|paymentMethod|paymentStatus|serverName)$/i
    );

    const bothOrders = await request("/api/orders/recent", {
      method: "POST",
      body: JSON.stringify({
        orders: [
          {
            orderNumber: orderA.order.orderNumber,
            accessToken: orderA.accessToken,
          },
          {
            orderNumber: orderB.order.orderNumber,
            accessToken: orderB.accessToken,
          },
        ],
      }),
    });
    expectStatus(bothOrders, 200, "Owned recent-order lookup");
    assert.deepEqual(
      new Set(bothOrders.data?.orders?.map((order: any) => order.id)),
      new Set([orderA.order.id, orderB.order.id])
    );

    console.log("[p0-recent] validating loyalty ownership and safe DTO fields");
    const wrongLoyalty = await request("/api/customers/lookup", {
      method: "POST",
      body: JSON.stringify({
        orders: [
          {
            orderNumber: loyaltyOrder.order.orderNumber,
            accessToken: orderA.accessToken,
          },
          {
            orderNumber: orderA.order.orderNumber,
            accessToken: orderA.accessToken,
          },
        ],
      }),
    });
    expectStatus(wrongLoyalty, 404, "Unowned loyalty lookup");
    assert.equal(wrongLoyalty.data?.customer, null);
    assert.deepEqual(wrongLoyalty.data?.redemptionOptions, []);

    const ownedLoyalty = await request("/api/customers/lookup", {
      method: "POST",
      body: JSON.stringify({
        orders: [
          {
            orderNumber: loyaltyOrder.order.orderNumber,
            accessToken: loyaltyOrder.accessToken,
          },
        ],
      }),
    });
    expectStatus(ownedLoyalty, 200, "Owned loyalty lookup");
    assert.equal(ownedLoyalty.response.headers.get("ratelimit-limit"), "60");
    assert.equal(
      ownedLoyalty.data?.customer?.id,
      storedLoyaltyOrder.customerId,
      "Loyalty lookup must resolve only the customer linked to the owned order"
    );
    assert.equal(ownedLoyalty.data?.customer?.name, "P0 Recent Order Loyalty");
    assert.equal(ownedLoyalty.data?.redemptionEnabled, false);
    assertNoKeysMatching(
      ownedLoyalty.data,
      /^(phone|email|notes|customerPhone|accessToken|token)$/i
    );

    const reservationA = await createReservation("A", 30);
    const reservationB = await createReservation("B", 31);
    createdReservationIds.push(
      reservationA.reservation.id,
      reservationB.reservation.id
    );
    if (reservationA.customerId) createdCustomerIds.push(reservationA.customerId);
    if (reservationB.customerId) createdCustomerIds.push(reservationB.customerId);

    console.log("[p0-recent] validating mixed recent-reservation credentials");
    const mixedReservations = await request("/api/reservations/recent", {
      method: "POST",
      body: JSON.stringify({
        reservations: [
          {
            id: reservationA.reservation.id,
            accessToken: reservationA.accessToken,
          },
          {
            id: reservationB.reservation.id,
            accessToken: reservationA.accessToken,
          },
          {
            id: `missing-${crypto.randomUUID()}`,
            accessToken: reservationB.accessToken,
          },
        ],
      }),
    });
    expectStatus(
      mixedReservations,
      200,
      "Mixed recent-reservation lookup"
    );
    assert.equal(
      mixedReservations.response.headers.get("ratelimit-limit"),
      "60"
    );
    assert.deepEqual(
      mixedReservations.data?.reservations?.map(
        (reservation: any) => reservation.id
      ),
      [reservationA.reservation.id],
      "Batch lookup must return only reservations with the matching resource token"
    );
    assertNoKeysMatching(
      mixedReservations.data,
      /^(customerPhone|customerEmail|customerId)$/i
    );

    const bothReservations = await request("/api/reservations/recent", {
      method: "POST",
      body: JSON.stringify({
        reservations: [
          {
            id: reservationA.reservation.id,
            accessToken: reservationA.accessToken,
          },
          {
            id: reservationB.reservation.id,
            accessToken: reservationB.accessToken,
          },
        ],
      }),
    });
    expectStatus(
      bothReservations,
      200,
      "Owned recent-reservation lookup"
    );
    assert.deepEqual(
      new Set(
        bothReservations.data?.reservations?.map(
          (reservation: any) => reservation.id
        )
      ),
      new Set(createdReservationIds)
    );

    const counters = await db.rateLimitCounter.findMany({
      where: {
        scope: {
          in: [
            "recent-orders-lookup",
            "recent-reservations-lookup",
            "loyalty-lookup",
          ],
        },
        createdAt: { gte: startedAt },
      },
    });
    assert.equal(
      new Set(counters.map((counter) => counter.scope)).size,
      3,
      "Recent and loyalty credential routes must persist shared limiter counters"
    );
    assert.ok(
      counters.every((counter) => !counter.key.includes(SOURCE_IP)),
      "Shared limiter keys must not contain the raw source address"
    );

    console.log(
      "[p0-recent] Recent ownership, loyalty, and limiter assertions passed."
    );
  } finally {
    if (createdOrderIds.length > 0) {
      await db.$transaction(async (tx) => {
        await tx.auditEvent.deleteMany({
          where: { entityType: "Order", entityId: { in: createdOrderIds } },
        });
        await tx.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      });
      await db.kdsOutboxEvent.deleteMany({
        where: {
          OR: createdOrderIds.map((orderId) => ({
            payload: { path: ["orderId"], equals: orderId },
          })),
        },
      });
    }

    if (createdReservationIds.length > 0) {
      await db.reservation.deleteMany({
        where: { id: { in: createdReservationIds } },
      });
    }
    const validCustomerIds = Array.from(
      new Set(createdCustomerIds.filter(Boolean))
    );
    if (validCustomerIds.length > 0) {
      await db.customer.deleteMany({
        where: { id: { in: validCustomerIds } },
      });
    }

    await db.rateLimitCounter.deleteMany({
      where: {
        scope: { in: TEST_SCOPES },
        createdAt: { gte: startedAt },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("[p0-recent] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
