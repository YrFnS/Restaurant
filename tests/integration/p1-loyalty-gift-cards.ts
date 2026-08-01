import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.212";
const db = new PrismaClient();

interface ApiResponse<T> {
  response: Response;
  data: T;
}

interface RegisterIdentity {
  id: string;
  deviceId: string;
}

function logStep(message: string) {
  console.log(`\n[p1-loyalty] ${message}`);
}

async function api<T>(
  path: string,
  init: RequestInit = {},
  register?: RegisterIdentity
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-loyalty-${crypto.randomUUID()}`);

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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toMinor(value: number): number {
  return Math.round(value * 100);
}

let menuItemId = "";

async function loadOrderableMenuItem(): Promise<string> {
  if (menuItemId) return menuItemId;
  const menu = await api<any>("/api/menu");
  assertStatus(menu.response, 200, "Public menu lookup");
  const items = (menu.data?.categories || []).flatMap(
    (category: any) => category.items || []
  );
  const item = items.find(
    (candidate: any) =>
      candidate.isAvailable &&
      candidate.price > 0 &&
      !(candidate.modifierGroups || []).some((group: any) => group.isRequired)
  );
  assert.ok(item, "Seed data must contain an available item without required modifiers");
  menuItemId = item.id;
  return menuItemId;
}

async function createOrder(phone: string, quantity = 3): Promise<any> {
  const itemId = await loadOrderableMenuItem();
  const result = await api<any>("/api/orders", {
    method: "POST",
    headers: {
      "idempotency-key": `p1-loyalty-order-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      type: "takeout",
      customerName: "P1 Loyalty Guest",
      customerPhone: phone,
      deliveryAddress: null,
      notes: "Loyalty and stored-value integration order",
      promoCode: null,
      tip: { mode: "none" },
      items: [
        {
          menuItemId: itemId,
          quantity,
          modifierOptionIds: [],
          notes: null,
          course: 1,
        },
      ],
    }),
  });
  assertStatus(result.response, 201, "Loyalty integration order creation");
  assert.ok(result.data.order.total > 0);
  return result.data.order;
}

async function checkout(
  cookie: string,
  register: RegisterIdentity,
  body: Record<string, unknown>,
  key = `p1-loyalty-checkout-${crypto.randomUUID()}`
) {
  return api<any>(
    "/api/pos/checkout",
    {
      method: "POST",
      headers: { cookie, "idempotency-key": key },
      body: JSON.stringify({ paymentMethod: "cash", ...body }),
    },
    register
  );
}

async function reversePayment(
  orderId: string,
  cookie: string,
  register: RegisterIdentity,
  body: Record<string, unknown>,
  key = `p1-loyalty-reversal-${crypto.randomUUID()}`
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

async function issueCard(
  cookie: string,
  amount: number,
  label: string,
  key = `p1-gift-issue-${crypto.randomUUID()}`
) {
  const body = {
    amount,
    purchaserName: `Purchaser ${label}`,
    recipientName: `Recipient ${label}`,
    message: `Issued for ${label}`,
    template: "classic",
  };
  const result = await api<any>("/api/gift-cards", {
    method: "POST",
    headers: { cookie, "idempotency-key": key },
    body: JSON.stringify(body),
  });
  assertStatus(result.response, 201, `Gift-card issuance for ${label}`);
  assert.equal(result.data.replayed, false);
  assert.equal(toMinor(result.data.card.balance), toMinor(amount));
  assert.ok(
    typeof result.data.redemptionCode === "string" &&
      result.data.redemptionCode.length >= 16,
    "Issuance must return the complete high-entropy credential once"
  );
  assertNoKeysMatching(result.data, /^(redemptionCodeHash|tokenHash|secretHash)$/i);
  return { result, body, key };
}

async function main() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const [adminCookie, serverCookie] = await Promise.all([
    login("1234"),
    login("1111"),
  ]);

  await db.restaurantSettings.update({
    where: { id: "1" },
    data: {
      loyaltyEnabled: true,
      loyaltyPointsPerCurrencyUnit: 1,
      loyaltyRedemptionPointsPerCurrencyUnit: 100,
      loyaltyRedemptionIncrementPoints: 100,
      loyaltyMaxRedemptionPercent: 100,
      giftCardEnabled: true,
      giftCardDefaultExpiryDays: 0,
    },
  });

  logStep("register setup and manager authorization");
  const deviceId = `p1-loyalty-device-${suffix}`;
  const registerCreate = await api<any>("/api/registers", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      code: `LOY-${suffix}`,
      name: `Loyalty Register ${suffix}`,
      deviceId,
      location: "Loyalty integration",
      discrepancyApprovalThreshold: 1000,
    }),
  });
  assertStatus(registerCreate.response, 201, "Loyalty register creation");
  const register: RegisterIdentity = {
    id: registerCreate.data.register.id,
    deviceId,
  };
  const registerOpen = await api<any>(
    `/api/registers/${encodeURIComponent(register.id)}/session`,
    {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "idempotency-key": `p1-loyalty-register-open-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({ openingFloat: 1000 }),
    },
    register
  );
  assertStatus(registerOpen.response, 201, "Loyalty register opening");

  const phone = `+964750${String(Date.now()).slice(-7)}${suffix.slice(0, 2)}`;
  const customer = await db.customer.create({
    data: { name: "P1 Loyalty Customer", phone },
    select: { id: true, loyaltyPoints: true },
  });
  assert.equal(customer.loyaltyPoints, 0);

  const forbiddenAdjustment = await api<any>("/api/loyalty", {
    method: "POST",
    headers: {
      cookie: serverCookie,
      "idempotency-key": `p1-loyalty-forbidden-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      customerId: customer.id,
      pointsDelta: 100,
      reasonCode: "customer_support",
      reason: "Operational staff cannot change customer points",
    }),
  });
  assertStatus(forbiddenAdjustment.response, 403, "Server loyalty adjustment");

  logStep("manager point adjustments are immutable, replay-safe, and payload-bound");
  const adjustmentKey = `p1-loyalty-adjust-${crypto.randomUUID()}`;
  const adjustmentBody = {
    customerId: customer.id,
    pointsDelta: 600,
    reasonCode: "customer_support",
    reason: "Integration opening credit",
  };
  const adjustment = await api<any>("/api/loyalty", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": adjustmentKey },
    body: JSON.stringify(adjustmentBody),
  });
  assertStatus(adjustment.response, 201, "Manager loyalty adjustment");
  assert.equal(adjustment.data.event.balanceAfter, 600);
  assert.equal(adjustment.data.replayed, false);

  const adjustmentReplay = await api<any>("/api/loyalty", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": adjustmentKey },
    body: JSON.stringify(adjustmentBody),
  });
  assertStatus(adjustmentReplay.response, 200, "Loyalty adjustment replay");
  assert.equal(adjustmentReplay.data.replayed, true);
  assert.equal(adjustmentReplay.data.event.id, adjustment.data.event.id);

  const adjustmentConflict = await api<any>("/api/loyalty", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": adjustmentKey },
    body: JSON.stringify({ ...adjustmentBody, pointsDelta: 700 }),
  });
  assertStatus(adjustmentConflict.response, 409, "Loyalty adjustment conflict");
  assert.equal(adjustmentConflict.data.code, "LOYALTY_IDEMPOTENCY_CONFLICT");

  const loyaltyAccount = await api<any>(
    `/api/loyalty?customerId=${encodeURIComponent(customer.id)}&limit=20`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(loyaltyAccount.response, 200, "Loyalty account read");
  assert.equal(loyaltyAccount.data.customer.loyaltyPoints, 600);
  assert.equal(loyaltyAccount.data.events[0].eventType, "adjustment");
  assertNoKeysMatching(loyaltyAccount.data, /^(metadata|idempotencyKey|tokenHash)$/i);

  await assert.rejects(
    db.$executeRawUnsafe(
      'UPDATE "Customer" SET "loyaltyPoints" = 999 WHERE "id" = $1',
      customer.id
    ),
    /ledger-controlled/i
  );

  logStep("gift-card issuance returns a secret once and rejects changed replays");
  const deniedIssue = await api<any>("/api/gift-cards", {
    method: "POST",
    headers: {
      cookie: serverCookie,
      "idempotency-key": `p1-gift-denied-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      amount: 10,
      purchaserName: "Denied purchaser",
      recipientName: "Denied recipient",
      message: null,
      template: "classic",
    }),
  });
  assertStatus(deniedIssue.response, 403, "Server gift-card issuance");

  const primaryIssue = await issueCard(adminCookie, 500, "primary");
  const primaryCard = primaryIssue.result.data.card;
  const primaryCode = primaryIssue.result.data.redemptionCode as string;

  const issueReplay = await api<any>("/api/gift-cards", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": primaryIssue.key },
    body: JSON.stringify(primaryIssue.body),
  });
  assertStatus(issueReplay.response, 200, "Gift-card issuance replay");
  assert.equal(issueReplay.data.replayed, true);
  assert.equal(issueReplay.data.card.id, primaryCard.id);
  assert.equal(issueReplay.data.redemptionCode, null);

  const issueConflict = await api<any>("/api/gift-cards", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": primaryIssue.key },
    body: JSON.stringify({ ...primaryIssue.body, amount: 501 }),
  });
  assertStatus(issueConflict.response, 409, "Gift-card issuance conflict");
  assert.equal(issueConflict.data.code, "GIFT_CARD_IDEMPOTENCY_CONFLICT");

  const publicLookup = await api<any>("/api/gift-cards/lookup", {
    method: "POST",
    body: JSON.stringify({ code: primaryCode }),
  });
  assertStatus(publicLookup.response, 200, "Public gift-card lookup");
  assert.equal(toMinor(publicLookup.data.card.balance), 50_000);
  assert.equal(publicLookup.response.headers.get("cache-control"), "no-store");
  assertNoKeysMatching(
    publicLookup.data,
    /^(id|redemptionCode|redemptionCodeHash|purchaserName|recipientName|message|issuedById|issuedByName|transactions)$/i
  );

  const missingLookup = await api<any>("/api/gift-cards/lookup", {
    method: "POST",
    body: JSON.stringify({ code: `MISSING-${suffix}-CARD` }),
  });
  assertStatus(missingLookup.response, 404, "Unknown gift-card lookup");
  assert.equal(missingLookup.data.code, "GIFT_CARD_NOT_FOUND");

  const cardAccount = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(primaryCard.id)}&limit=20`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(cardAccount.response, 200, "Gift-card account read");
  assert.equal(cardAccount.data.transactions.length, 1);
  assert.equal(cardAccount.data.transactions[0].transactionType, "issue");
  assertNoKeysMatching(cardAccount.data, /^(redemptionCode|redemptionCodeHash)$/i);

  logStep("gift-card adjustments are replay-safe and amount-bound");
  const cardAdjustmentKey = `p1-gift-adjust-${crypto.randomUUID()}`;
  const cardAdjustmentBody = {
    action: "adjust",
    amount: 10,
    reasonCode: "top_up",
    reason: "Approved integration top-up",
  };
  const cardAdjustment = await api<any>(
    `/api/gift-cards/${encodeURIComponent(primaryCard.id)}`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": cardAdjustmentKey,
      },
      body: JSON.stringify(cardAdjustmentBody),
    }
  );
  assertStatus(cardAdjustment.response, 201, "Gift-card adjustment");
  assert.equal(toMinor(cardAdjustment.data.card.balance), 51_000);

  const cardAdjustmentReplay = await api<any>(
    `/api/gift-cards/${encodeURIComponent(primaryCard.id)}`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": cardAdjustmentKey,
      },
      body: JSON.stringify(cardAdjustmentBody),
    }
  );
  assertStatus(cardAdjustmentReplay.response, 200, "Gift-card adjustment replay");
  assert.equal(cardAdjustmentReplay.data.replayed, true);

  const cardAdjustmentConflict = await api<any>(
    `/api/gift-cards/${encodeURIComponent(primaryCard.id)}`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": cardAdjustmentKey,
      },
      body: JSON.stringify({ ...cardAdjustmentBody, amount: 11 }),
    }
  );
  assertStatus(
    cardAdjustmentConflict.response,
    409,
    "Gift-card adjustment payload conflict"
  );
  assert.equal(
    cardAdjustmentConflict.data.code,
    "GIFT_CARD_IDEMPOTENCY_CONFLICT"
  );

  logStep("gift-card-only checkout records no cash and earns trusted points");
  const giftOnlyOrder = await createOrder(phone, 2);
  const giftOnlyKey = `p1-gift-only-${crypto.randomUUID()}`;
  const giftOnlyCheckout = await checkout(
    adminCookie,
    register,
    {
      orderId: giftOnlyOrder.id,
      giftCardCode: primaryCode,
      giftCardAmount: giftOnlyOrder.total,
    },
    giftOnlyKey
  );
  assertStatus(giftOnlyCheckout.response, 200, "Gift-card-only checkout");
  assert.equal(giftOnlyCheckout.data.replayed, false);
  assert.equal(giftOnlyCheckout.data.payment.method, "gift_card");
  assert.equal(toMinor(giftOnlyCheckout.data.payment.cashAmount), 0);
  assert.equal(
    toMinor(giftOnlyCheckout.data.payment.giftCardAmount),
    toMinor(giftOnlyOrder.total)
  );
  assert.ok(giftOnlyCheckout.data.payment.loyaltyEarnedPoints > 0);

  const giftOnlyCashEntries = await db.cashDrawerEntry.count({
    where: {
      type: "sale",
      note: { contains: giftOnlyOrder.orderNumber },
    },
  });
  assert.equal(giftOnlyCashEntries, 0);

  const giftOnlyReplay = await checkout(
    adminCookie,
    register,
    {
      orderId: giftOnlyOrder.id,
      giftCardCode: primaryCode,
      giftCardAmount: giftOnlyOrder.total,
    },
    giftOnlyKey
  );
  assertStatus(giftOnlyReplay.response, 200, "Gift-card checkout replay");
  assert.equal(giftOnlyReplay.data.replayed, true);

  const giftOnlyConflict = await checkout(
    adminCookie,
    register,
    {
      orderId: giftOnlyOrder.id,
      giftCardCode: primaryCode,
      giftCardAmount: roundMoney(giftOnlyOrder.total - 0.01),
      tendered: 0.01,
    },
    giftOnlyKey
  );
  assertStatus(giftOnlyConflict.response, 409, "Changed checkout replay");
  assert.equal(giftOnlyConflict.data.code, "CHECKOUT_IDEMPOTENCY_CONFLICT");

  const primaryBalanceAfterCheckout = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(primaryCard.id)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(primaryBalanceAfterCheckout.response, 200, "Card after checkout");
  assert.equal(
    toMinor(primaryBalanceAfterCheckout.data.card.balance),
    51_000 - toMinor(giftOnlyOrder.total)
  );

  const giftOnlyRefund = await reversePayment(
    giftOnlyOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: giftOnlyCheckout.data.payment.captured,
      reasonCode: "customer_request",
      reason: "Full stored-value integration refund",
    }
  );
  assertStatus(giftOnlyRefund.response, 201, "Gift-card full refund");
  assert.equal(giftOnlyRefund.data.order.paymentStatus, "refunded");
  assert.equal(toMinor(giftOnlyRefund.data.storedValue.cashRefund), 0);
  assert.equal(
    toMinor(giftOnlyRefund.data.storedValue.giftCardRefundAmount),
    toMinor(giftOnlyOrder.total)
  );

  const primaryBalanceRestored = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(primaryCard.id)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(primaryBalanceRestored.response, 200, "Card after refund");
  assert.equal(toMinor(primaryBalanceRestored.data.card.balance), 51_000);

  logStep("mixed gift-card and cash checkout reconciles each tender independently");
  const mixedIssue = await issueCard(adminCookie, 5, "mixed");
  const mixedCode = mixedIssue.result.data.redemptionCode as string;
  const mixedCardId = mixedIssue.result.data.card.id as string;
  const mixedOrder = await createOrder(phone, 3);
  const mixedGiftAmount = Math.max(
    0.01,
    Math.min(5, roundMoney(mixedOrder.total / 2))
  );
  const mixedCashAmount = roundMoney(mixedOrder.total - mixedGiftAmount);
  const mixedCheckout = await checkout(adminCookie, register, {
    orderId: mixedOrder.id,
    giftCardCode: mixedCode,
    giftCardAmount: mixedGiftAmount,
    tendered: mixedCashAmount,
  });
  assertStatus(mixedCheckout.response, 200, "Mixed checkout");
  assert.equal(mixedCheckout.data.payment.method, "split");
  assert.equal(
    toMinor(mixedCheckout.data.payment.giftCardAmount),
    toMinor(mixedGiftAmount)
  );
  assert.equal(
    toMinor(mixedCheckout.data.payment.cashAmount),
    toMinor(mixedCashAmount)
  );

  const mixedSale = await db.cashDrawerEntry.findFirst({
    where: {
      type: "sale",
      note: { contains: mixedOrder.orderNumber },
    },
    select: { amountMinor: true },
  });
  assert.equal(Number(mixedSale?.amountMinor), toMinor(mixedCashAmount));

  const mixedRefund = await reversePayment(
    mixedOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: mixedCheckout.data.payment.captured,
      reasonCode: "customer_request",
      reason: "Return every mixed tender component",
    }
  );
  assertStatus(mixedRefund.response, 201, "Mixed full refund");
  assert.equal(
    toMinor(mixedRefund.data.storedValue.giftCardRefundAmount),
    toMinor(mixedGiftAmount)
  );
  assert.equal(
    toMinor(mixedRefund.data.storedValue.cashRefund),
    toMinor(mixedCashAmount)
  );
  const mixedCardAfterRefund = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(mixedCardId)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(mixedCardAfterRefund.response, 200, "Mixed card after refund");
  assert.equal(toMinor(mixedCardAfterRefund.data.card.balance), 500);

  logStep("loyalty redemption changes the exact total and is restored on refund");
  const redemptionOrder = await createOrder(phone, 3);
  assert.ok(redemptionOrder.total > 1);
  const redemptionCheckout = await checkout(adminCookie, register, {
    orderId: redemptionOrder.id,
    loyaltyPoints: 100,
    tendered: roundMoney(redemptionOrder.total - 1),
  });
  assertStatus(redemptionCheckout.response, 200, "Loyalty redemption checkout");
  assert.equal(redemptionCheckout.data.payment.loyaltyRedeemedPoints, 100);
  assert.equal(
    toMinor(redemptionCheckout.data.payment.loyaltyRedemptionValue),
    100
  );
  assert.equal(
    toMinor(redemptionCheckout.data.order.total),
    toMinor(redemptionOrder.total) - 100
  );

  const redemptionRefund = await reversePayment(
    redemptionOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: redemptionCheckout.data.payment.captured,
      reasonCode: "customer_request",
      reason: "Restore the redeemed loyalty points",
    }
  );
  assertStatus(redemptionRefund.response, 201, "Loyalty redemption refund");
  assert.equal(
    redemptionRefund.data.storedValue.loyaltyRedeemRestore.pointsDelta,
    100
  );
  assert.ok(
    redemptionRefund.data.storedValue.loyaltyEarnReversal.pointsDelta <= 0
  );

  const loyaltyHistory = await api<any>(
    `/api/loyalty?customerId=${encodeURIComponent(customer.id)}&limit=100`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(loyaltyHistory.response, 200, "Reconciled loyalty history");
  const loyaltyTypes = new Set(
    loyaltyHistory.data.events.map((event: any) => event.eventType)
  );
  for (const type of ["adjustment", "earn", "redeem", "earn_reversal", "redeem_restore"]) {
    assert.ok(loyaltyTypes.has(type), `Missing loyalty event type ${type}`);
  }

  logStep("concurrent redemptions cannot overdraw one card");
  const raceOrderA = await createOrder(phone, 2);
  const raceOrderB = await createOrder(phone, 2);
  const raceContribution = Math.max(
    0.01,
    Math.min(5, raceOrderA.total, raceOrderB.total)
  );
  const raceIssue = await issueCard(adminCookie, raceContribution, "race");
  const raceCode = raceIssue.result.data.redemptionCode as string;
  const raceCardId = raceIssue.result.data.card.id as string;

  const raceResults = await Promise.all([
    checkout(adminCookie, register, {
      orderId: raceOrderA.id,
      giftCardCode: raceCode,
      giftCardAmount: raceContribution,
      tendered: roundMoney(raceOrderA.total - raceContribution),
    }),
    checkout(adminCookie, register, {
      orderId: raceOrderB.id,
      giftCardCode: raceCode,
      giftCardAmount: raceContribution,
      tendered: roundMoney(raceOrderB.total - raceContribution),
    }),
  ]);
  assert.deepEqual(
    raceResults.map((entry) => entry.response.status).sort(),
    [200, 409]
  );
  const raceCard = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(raceCardId)}&limit=20`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(raceCard.response, 200, "Concurrent card account");
  assert.equal(toMinor(raceCard.data.card.balance), 0);
  assert.equal(
    raceCard.data.transactions.filter(
      (entry: any) => entry.transactionType === "redeem"
    ).length,
    1
  );

  const raceOrders = await db.order.findMany({
    where: { id: { in: [raceOrderA.id, raceOrderB.id] } },
    select: { paymentStatus: true },
  });
  assert.deepEqual(
    raceOrders.map((entry) => entry.paymentStatus).sort(),
    ["paid", "unpaid"]
  );

  logStep("full void restores stored value without a cash movement");
  const voidOrder = await createOrder(phone, 2);
  const voidIssue = await issueCard(adminCookie, voidOrder.total, "void");
  const voidCode = voidIssue.result.data.redemptionCode as string;
  const voidCardId = voidIssue.result.data.card.id as string;
  const voidCheckout = await checkout(adminCookie, register, {
    orderId: voidOrder.id,
    giftCardCode: voidCode,
    giftCardAmount: voidOrder.total,
  });
  assertStatus(voidCheckout.response, 200, "Void candidate checkout");
  assert.equal(voidCheckout.data.payment.method, "gift_card");

  const voidResult = await reversePayment(
    voidOrder.id,
    adminCookie,
    register,
    {
      action: "void",
      reasonCode: "operator_error",
      reason: "Void the untouched stored-value capture",
    }
  );
  assertStatus(voidResult.response, 201, "Stored-value payment void");
  assert.equal(voidResult.data.order.paymentStatus, "voided");
  assert.equal(toMinor(voidResult.data.storedValue.cashRefund), 0);
  assert.equal(
    toMinor(voidResult.data.storedValue.giftCardRefundAmount),
    toMinor(voidOrder.total)
  );
  const voidCard = await api<any>(
    `/api/gift-cards?cardId=${encodeURIComponent(voidCardId)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(voidCard.response, 200, "Voided payment card account");
  assert.equal(
    toMinor(voidCard.data.card.balance),
    toMinor(voidOrder.total)
  );

  logStep("earning reversals preserve a truthful negative loyalty liability");
  const negativePhone = `+964751${String(Date.now()).slice(-7)}${suffix.slice(2, 4)}`;
  const negativeCustomer = await db.customer.create({
    data: { name: "P1 Negative Loyalty", phone: negativePhone },
    select: { id: true },
  });
  const negativeOrder = await createOrder(negativePhone, 5);
  const negativeCheckout = await checkout(adminCookie, register, {
    orderId: negativeOrder.id,
    tendered: negativeOrder.total,
  });
  assertStatus(negativeCheckout.response, 200, "Negative-balance earning checkout");
  const earnedPoints = negativeCheckout.data.payment.loyaltyEarnedPoints as number;
  assert.ok(earnedPoints > 0);

  const spendEarned = await api<any>("/api/loyalty", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "idempotency-key": `p1-loyalty-consume-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      customerId: negativeCustomer.id,
      pointsDelta: -earnedPoints,
      reasonCode: "customer_support",
      reason: "Points are no longer available before the sale refund",
    }),
  });
  assertStatus(spendEarned.response, 201, "Consume earned point balance");
  assert.equal(spendEarned.data.event.balanceAfter, 0);

  const negativeRefund = await reversePayment(
    negativeOrder.id,
    adminCookie,
    register,
    {
      action: "refund",
      amount: negativeCheckout.data.payment.captured,
      reasonCode: "customer_request",
      reason: "Refund after the earned points were already consumed",
    }
  );
  assertStatus(negativeRefund.response, 201, "Negative loyalty balance refund");
  const negativeCustomerAfter = await db.customer.findUniqueOrThrow({
    where: { id: negativeCustomer.id },
    select: { loyaltyPoints: true },
  });
  assert.equal(negativeCustomerAfter.loyaltyPoints, -earnedPoints);

  logStep("gift-card voids and immutable database guards remain enforced");
  const standaloneVoid = await issueCard(adminCookie, 10, "standalone-void");
  const standaloneVoidKey = `p1-gift-void-${crypto.randomUUID()}`;
  const standaloneVoidBody = {
    action: "void",
    reasonCode: "customer_support",
    reason: "Close the unused integration gift card",
  };
  const standaloneVoidResult = await api<any>(
    `/api/gift-cards/${encodeURIComponent(standaloneVoid.result.data.card.id)}`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": standaloneVoidKey,
      },
      body: JSON.stringify(standaloneVoidBody),
    }
  );
  assertStatus(standaloneVoidResult.response, 201, "Standalone card void");
  assert.equal(standaloneVoidResult.data.card.status, "voided");
  assert.equal(toMinor(standaloneVoidResult.data.card.balance), 0);

  const standaloneVoidReplay = await api<any>(
    `/api/gift-cards/${encodeURIComponent(standaloneVoid.result.data.card.id)}`,
    {
      method: "PATCH",
      headers: {
        cookie: adminCookie,
        "idempotency-key": standaloneVoidKey,
      },
      body: JSON.stringify(standaloneVoidBody),
    }
  );
  assertStatus(standaloneVoidReplay.response, 200, "Standalone card void replay");
  assert.equal(standaloneVoidReplay.data.replayed, true);

  const immutableLoyalty = await db.loyaltyPointEvent.findFirstOrThrow({
    where: { customerId: customer.id },
    select: { id: true },
  });
  const immutableGift = await db.giftCardTransaction.findFirstOrThrow({
    where: { giftCardId: primaryCard.id },
    select: { id: true },
  });

  await assert.rejects(
    db.$executeRawUnsafe(
      'UPDATE "LoyaltyPointEvent" SET "reason" = $1 WHERE "id" = $2',
      "tampered",
      immutableLoyalty.id
    ),
    /immutable/i
  );
  await assert.rejects(
    db.$executeRawUnsafe(
      'DELETE FROM "GiftCardTransaction" WHERE "id" = $1',
      immutableGift.id
    ),
    /immutable/i
  );
  await assert.rejects(
    db.$executeRawUnsafe(
      'UPDATE "GiftCard" SET "balanceMinor" = "balanceMinor" + 1 WHERE "id" = $1',
      primaryCard.id
    ),
    /ledger-controlled/i
  );

  const auditActions = new Set(
    (
      await db.auditEvent.findMany({
        where: {
          action: {
            in: [
              "loyalty.adjust",
              "gift-card.issue",
              "gift-card.adjust",
              "gift-card.redeem",
              "gift-card.refund",
              "gift-card.void",
              "order.payment.capture",
              "payment.gift_card.refund",
              "payment.gift_card.void",
            ],
          },
        },
        select: { action: true },
      })
    ).map((entry) => entry.action)
  );
  for (const action of [
    "loyalty.adjust",
    "gift-card.issue",
    "gift-card.adjust",
    "gift-card.redeem",
    "gift-card.refund",
    "gift-card.void",
    "order.payment.capture",
  ]) {
    assert.ok(auditActions.has(action), `Missing immutable audit action ${action}`);
  }

  console.log("\n[p1-loyalty] Loyalty and gift-card assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-loyalty] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
