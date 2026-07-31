import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.109";
const db = new PrismaClient();

interface ApiResponse<T> {
  response: Response;
  data: T;
}

interface RegisterIdentity {
  id: string;
  deviceId: string;
}

async function api<T>(
  path: string,
  init: RequestInit = {},
  register?: RegisterIdentity
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-reversal-${crypto.randomUUID()}`);

  if (register) {
    headers.set("x-register-id", register.id);
    headers.set("x-register-device-id", register.deviceId);
  }

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
  let data: T;
  try {
    data = (raw ? JSON.parse(raw) : null) as T;
  } catch {
    throw new Error(
      `${method} ${path} returned non-JSON status ${response.status}: ${raw.slice(0, 500)}`
    );
  }
  return { response, data };
}

function assertStatus(response: Response, expected: number, context: string) {
  assert.equal(
    response.status,
    expected,
    `${context}: expected HTTP ${expected}, received ${response.status}`
  );
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Successful login must set a staff session cookie");
  return setCookie.split(";", 1)[0];
}

async function login(pin: string): Promise<string> {
  const result = await api<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  assertStatus(result.response, 200, `Login for PIN ${pin}`);
  return cookieFrom(result.response);
}

async function createOrder(): Promise<any> {
  const menu = await api<any>("/api/menu");
  assertStatus(menu.response, 200, "Public menu lookup");
  const items = (menu.data?.categories || []).flatMap(
    (category: any) => category.items || []
  );
  const item = items.find(
    (candidate: any) =>
      candidate.isAvailable &&
      !(candidate.modifierGroups || []).some((group: any) => group.isRequired)
  );
  assert.ok(item, "Seed data must contain an item without required modifiers");

  const order = await api<any>("/api/orders", {
    method: "POST",
    headers: {
      "idempotency-key": `p1-reversal-order-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      type: "takeout",
      customerName: "Payment Reversal Test",
      customerPhone: `+964712${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 10)}`,
      deliveryAddress: null,
      notes: "Payment reversal integration order",
      promoCode: null,
      tip: { mode: "none" },
      items: [
        {
          menuItemId: item.id,
          quantity: 1,
          modifierOptionIds: [],
          notes: null,
          course: 1,
        },
      ],
    }),
  });
  assertStatus(order.response, 201, "Order creation");
  return order.data.order;
}

async function payOrder(
  order: any,
  cookie: string,
  register: RegisterIdentity
): Promise<any> {
  const checkout = await api<any>(
    "/api/pos/checkout",
    {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({
        orderId: order.id,
        paymentMethod: "cash",
        tendered: order.total,
      }),
    },
    register
  );
  assertStatus(checkout.response, 200, "Cash checkout");
  assert.equal(checkout.data.order.paymentStatus, "paid");
  return checkout.data;
}

async function reverse(
  orderId: string,
  cookie: string,
  register: RegisterIdentity,
  body: Record<string, unknown>,
  key = `p1-reversal-${crypto.randomUUID()}`
) {
  return api<any>(
    `/api/orders/${encodeURIComponent(orderId)}/payments`,
    {
      method: "POST",
      headers: { cookie, "idempotency-key": key },
      body: JSON.stringify(body),
    },
    register
  );
}

async function expectDatabaseFailure(
  operation: () => Promise<unknown>,
  context: string
) {
  let failed = false;
  try {
    await operation();
  } catch {
    failed = true;
  }
  assert.equal(failed, true, context);
}

async function main() {
  console.log("\n[p1-reversal] manager authorization and register setup");
  const [adminCookie, serverCookie] = await Promise.all([
    login("1234"),
    login("1111"),
  ]);

  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const deviceId = `p1-reversal-device-${suffix}`;
  const registerCreate = await api<any>("/api/registers", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      code: `REV-${suffix}`,
      name: `Reversal Register ${suffix}`,
      deviceId,
      location: "Payment reversal integration",
      discrepancyApprovalThreshold: 0,
    }),
  });
  assertStatus(registerCreate.response, 201, "Register creation");
  const register: RegisterIdentity = {
    id: registerCreate.data.register.id,
    deviceId,
  };

  const openKey = `p1-reversal-open-${crypto.randomUUID()}`;
  const opened = await api<any>(
    `/api/registers/${encodeURIComponent(register.id)}/session`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": openKey },
      body: JSON.stringify({ openingFloat: 1000 }),
    },
    register
  );
  assertStatus(opened.response, 201, "Register opening");
  const registerSessionId = opened.data.session.id as string;

  console.log("\n[p1-reversal] partial refund, replay, over-refund, and full refund");
  const firstOrder = await createOrder();
  await payOrder(firstOrder, adminCookie, register);

  const ledger = await api<any>(
    `/api/orders/${encodeURIComponent(firstOrder.id)}/payments`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(ledger.response, 200, "Payment ledger read");
  assert.ok(ledger.data.capture?.id);
  assert.equal(ledger.data.summary.captured, firstOrder.total);
  assert.equal(ledger.data.summary.remaining, firstOrder.total);

  const denied = await reverse(
    firstOrder.id,
    serverCookie,
    register,
    {
      action: "refund",
      amount: 1,
      reasonCode: "customer_request",
      reason: "Server accounts cannot authorize refunds",
    }
  );
  assertStatus(denied.response, 403, "Server refund authorization");

  const partialAmount = Math.floor(firstOrder.total * 50) / 100;
  assert.ok(partialAmount > 0 && partialAmount < firstOrder.total);
  const partialKey = `p1-reversal-partial-${crypto.randomUUID()}`;
  const partial = await reverse(
    firstOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: partialAmount,
      reasonCode: "customer_request",
      reason: "Customer requested a partial refund",
    },
    partialKey
  );
  assertStatus(partial.response, 201, "Partial refund");
  assert.equal(partial.data.order.paymentStatus, "partially_refunded");
  assert.equal(partial.data.reversal.originalPaymentEventId, ledger.data.capture.id);
  assert.equal(partial.data.reversal.registerSessionId, registerSessionId);
  assert.equal(partial.data.summary.reversed, partialAmount);

  const partialReplay = await reverse(
    firstOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: partialAmount,
      reasonCode: "customer_request",
      reason: "Customer requested a partial refund",
    },
    partialKey
  );
  assertStatus(partialReplay.response, 200, "Partial refund replay");
  assert.equal(partialReplay.data.replayed, true);
  assert.equal(partialReplay.data.reversal.id, partial.data.reversal.id);

  const overRefund = await reverse(firstOrder.id, adminCookie, register, {
    action: "refund",
    amount: Number((partial.data.summary.remaining + 0.01).toFixed(2)),
    reasonCode: "operator_error",
    reason: "This amount intentionally exceeds the remaining capture",
  });
  assertStatus(overRefund.response, 409, "Over-refund rejection");
  assert.equal(overRefund.data.code, "REFUND_EXCEEDS_REMAINING");

  const finalRefund = await reverse(firstOrder.id, adminCookie, register, {
    action: "refund",
    amount: partial.data.summary.remaining,
    reasonCode: "quality_issue",
    reason: "Refund the remaining captured amount",
  });
  assertStatus(finalRefund.response, 201, "Full remaining refund");
  assert.equal(finalRefund.data.order.paymentStatus, "refunded");
  assert.equal(finalRefund.data.summary.remaining, 0);

  console.log("\n[p1-reversal] concurrent full refunds serialize safely");
  const raceOrder = await createOrder();
  await payOrder(raceOrder, adminCookie, register);
  const raceRequests = await Promise.all([
    reverse(raceOrder.id, adminCookie, register, {
      action: "refund",
      amount: raceOrder.total,
      reasonCode: "customer_request",
      reason: "Concurrent refund request A",
    }),
    reverse(raceOrder.id, adminCookie, register, {
      action: "refund",
      amount: raceOrder.total,
      reasonCode: "customer_request",
      reason: "Concurrent refund request B",
    }),
  ]);
  assert.deepEqual(
    raceRequests.map((entry) => entry.response.status).sort(),
    [201, 409]
  );
  const raceRefundCount = await db.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS "count"
     FROM "PaymentEvent"
     WHERE "orderId" = $1 AND "eventType" = 'refund' AND "status" = 'succeeded'`,
    raceOrder.id
  );
  assert.equal(raceRefundCount[0]?.count, 1);

  console.log("\n[p1-reversal] voids are full, replay-safe, and unavailable after completion");
  const voidOrder = await createOrder();
  await payOrder(voidOrder, adminCookie, register);
  const voidKey = `p1-reversal-void-${crypto.randomUUID()}`;
  const voided = await reverse(
    voidOrder.id,
    adminCookie,
    register,
    {
      action: "void",
      reasonCode: "duplicate_charge",
      reason: "Duplicate order was charged before completion",
    },
    voidKey
  );
  assertStatus(voided.response, 201, "Payment void");
  assert.equal(voided.data.order.paymentStatus, "voided");
  assert.equal(voided.data.reversal.amount, voidOrder.total);
  assert.equal(voided.data.summary.remaining, 0);

  const voidReplay = await reverse(
    voidOrder.id,
    adminCookie,
    register,
    {
      action: "void",
      reasonCode: "duplicate_charge",
      reason: "Duplicate order was charged before completion",
    },
    voidKey
  );
  assertStatus(voidReplay.response, 200, "Payment void replay");
  assert.equal(voidReplay.data.replayed, true);
  assert.equal(voidReplay.data.reversal.id, voided.data.reversal.id);

  const completedOrder = await createOrder();
  await payOrder(completedOrder, adminCookie, register);
  await db.order.update({
    where: { id: completedOrder.id },
    data: { status: "completed", completedAt: new Date() },
  });
  const completedVoid = await reverse(completedOrder.id, adminCookie, register, {
    action: "void",
    reasonCode: "operator_error",
    reason: "Completed orders must use the refund flow",
  });
  assertStatus(completedVoid.response, 409, "Completed-order void rejection");
  assert.equal(completedVoid.data.code, "COMPLETED_ORDER_REQUIRES_REFUND");

  const completedRefund = await reverse(
    completedOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: completedOrder.total,
      reasonCode: "quality_issue",
      reason: "Completed order refunded after customer complaint",
    }
  );
  assertStatus(completedRefund.response, 201, "Completed-order refund");
  assert.equal(completedRefund.data.order.paymentStatus, "refunded");

  console.log("\n[p1-reversal] database relationship and immutability constraints");
  const refundEntries = await db.$queryRawUnsafe<
    Array<{ count: number; sessionId: string | null }>
  >(
    `SELECT COUNT(*)::int AS "count", MIN("registerSessionId") AS "sessionId"
     FROM "CashDrawerEntry"
     WHERE "type" = 'refund' AND "note" LIKE $1`,
    `%${firstOrder.orderNumber}%`
  );
  assert.equal(refundEntries[0]?.count, 2);
  assert.equal(refundEntries[0]?.sessionId, registerSessionId);

  const reversalAuditCount = await db.auditEvent.count({
    where: {
      action: { in: ["payment.cash.refund", "payment.cash.void"] },
    },
  });
  assert.ok(reversalAuditCount >= 5);

  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "PaymentEvent" SET "reason" = $1 WHERE "id" = $2',
        "Mutated reason",
        partial.data.reversal.id
      ),
    "Succeeded payment events must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'DELETE FROM "PaymentEvent" WHERE "id" = $1',
        partial.data.reversal.id
      ),
    "Payment events must not be deletable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `INSERT INTO "PaymentEvent" (
           "id", "idempotencyKey", "orderId", "eventType", "method", "status",
           "amountCents", "currency", "actorName", "parentEventId",
           "reasonCode", "reason"
         ) VALUES ($1, $2, $3, 'refund', 'cash', 'succeeded', 1, 'USD',
           'Integration', $4, 'operator_error', 'Cross-order parent must fail')`,
        `payment_event_cross_${crypto.randomUUID().replaceAll("-", "")}`,
        `cross-order-${crypto.randomUUID()}`,
        voidOrder.id,
        ledger.data.capture.id
      ),
    "A reversal cannot reference a capture from another order"
  );

  console.log("\n[p1-reversal] a closed register cannot fund a later refund");
  const closeCandidate = await createOrder();
  await payOrder(closeCandidate, adminCookie, register);
  const liveLedger = await api<any>(
    "/api/cash",
    { headers: { cookie: adminCookie } },
    register
  );
  assertStatus(liveLedger.response, 200, "Register ledger before close");

  const close = await api<any>(
    `/api/registers/${encodeURIComponent(register.id)}/session`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": `p1-reversal-close-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        sessionId: registerSessionId,
        countedCash: liveLedger.data.balance,
        note: "Close reversal integration register",
      }),
    },
    register
  );
  assertStatus(close.response, 200, "Register close");

  const closedRefund = await reverse(closeCandidate.id, adminCookie, register, {
    action: "refund",
    amount: closeCandidate.total,
    reasonCode: "customer_request",
    reason: "Closed register must reject returned cash",
  });
  assertStatus(closedRefund.response, 409, "Closed-register refund rejection");
  assert.equal(closedRefund.data.code, "REGISTER_SESSION_REQUIRED");

  console.log("\n[p1-reversal] All payment reversal assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-reversal] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
