import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.88";
const db = new PrismaClient();

interface ApiResponse<T> {
  response: Response;
  data: T;
}

interface RegisterIdentity {
  id: string;
  deviceId: string;
}

interface CountRow {
  count: number;
}

function logStep(message: string) {
  console.log(`\n[p1-register] ${message}`);
}

async function api<T>(
  path: string,
  init: RequestInit = {},
  register?: RegisterIdentity
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-register-${crypto.randomUUID()}`);

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
  const menuItems = (menu.data?.categories || []).flatMap(
    (category: any) => category.items || []
  );
  const item = menuItems.find(
    (candidate: any) =>
      candidate.isAvailable &&
      !(candidate.modifierGroups || []).some((group: any) => group.isRequired)
  );
  assert.ok(item, "Seed data must include an orderable item without required modifiers");

  const result = await api<any>("/api/orders", {
    method: "POST",
    headers: {
      "idempotency-key": `p1-register-order-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      type: "takeout",
      customerName: "P1 Register Guest",
      customerPhone: `+964711${String(Date.now()).slice(-7)}`,
      deliveryAddress: null,
      notes: "Cash-register lifecycle integration order",
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
  assertStatus(result.response, 201, "Register test order creation");
  return result.data.order;
}

function roundedCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function main() {
  const originalSarah = await db.employee.findFirst({
    where: { name: "Sarah" },
    select: { id: true, role: true },
  });
  assert.ok(originalSarah, "Seed data must contain Sarah");

  try {
    logStep("register provisioning is manager-only");
    const [adminCookie, serverCookie] = await Promise.all([
      login("1234"),
      login("1111"),
    ]);

    const forbiddenCreate = await api<any>("/api/registers", {
      method: "POST",
      headers: { cookie: serverCookie },
      body: JSON.stringify({
        code: `DENIED-${Date.now()}`,
        name: "Forbidden Register",
        deviceId: `denied-device-${crypto.randomUUID()}`,
        location: "Integration",
        discrepancyApprovalThreshold: 5,
      }),
    });
    assertStatus(forbiddenCreate.response, 403, "Server register provisioning");

    await db.employee.update({
      where: { id: originalSarah.id },
      data: { role: "cashier" },
    });

    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const deviceId = `p1-register-device-${suffix}`;
    const registerCreate = await api<any>("/api/registers", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        code: `P1-${suffix}`,
        name: `P1 Register ${suffix}`,
        deviceId,
        location: "Integration terminal",
        discrepancyApprovalThreshold: 5,
      }),
    });
    assertStatus(registerCreate.response, 201, "Manager register provisioning");
    const register: RegisterIdentity = {
      id: registerCreate.data.register.id,
      deviceId,
    };
    assert.equal(
      registerCreate.data.register.discrepancyApprovalThreshold,
      5
    );

    logStep("cashier opens one idempotent session for the assigned device");
    const openKey = `p1-register-open-${crypto.randomUUID()}`;
    const opened = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "POST",
        headers: {
          cookie: serverCookie,
          "idempotency-key": openKey,
        },
        body: JSON.stringify({ openingFloat: 100 }),
      },
      register
    );
    assertStatus(opened.response, 201, "Register opening");
    assert.equal(opened.data.session.status, "open");
    assert.equal(opened.data.session.openingFloat, 100);
    assert.equal(opened.data.replayed, false);
    const firstSessionId = opened.data.session.id as string;

    const openReplay = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "POST",
        headers: {
          cookie: serverCookie,
          "idempotency-key": openKey,
        },
        body: JSON.stringify({ openingFloat: 100 }),
      },
      register
    );
    assertStatus(openReplay.response, 200, "Register opening replay");
    assert.equal(openReplay.data.replayed, true);
    assert.equal(openReplay.data.session.id, firstSessionId);

    const duplicateOpen = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "POST",
        headers: {
          cookie: serverCookie,
          "idempotency-key": `p1-register-open-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ openingFloat: 100 }),
      },
      register
    );
    assertStatus(duplicateOpen.response, 409, "Second open session");
    assert.equal(duplicateOpen.data.code, "REGISTER_ALREADY_OPEN");

    const wrongDevice = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      { headers: { cookie: serverCookie } },
      { id: register.id, deviceId: `wrong-${deviceId}` }
    );
    assertStatus(wrongDevice.response, 409, "Mismatched register device");
    assert.equal(wrongDevice.data.code, "REGISTER_DEVICE_MISMATCH");

    logStep("checkout and cash movements attach to the locked open session");
    const order = await createOrder();
    const checkout = await api<any>(
      "/api/pos/checkout",
      {
        method: "POST",
        headers: { cookie: serverCookie },
        body: JSON.stringify({
          orderId: order.id,
          paymentMethod: "cash",
          tendered: order.total,
        }),
      },
      register
    );
    assertStatus(checkout.response, 200, "Register-bound cash checkout");
    assert.equal(checkout.data.replayed, false);
    assert.equal(checkout.data.payment.registerSessionId, firstSessionId);
    assert.equal(checkout.data.session.id, firstSessionId);

    const payout = await api<any>(
      "/api/cash",
      {
        method: "POST",
        headers: { cookie: serverCookie },
        body: JSON.stringify({
          type: "payout",
          amount: 10,
          note: "P1 integration payout",
        }),
      },
      register
    );
    assertStatus(payout.response, 201, "Register-bound payout");
    assert.equal(payout.data.entry.registerSessionId, firstSessionId);

    const liveLedger = await api<any>(
      "/api/cash",
      { headers: { cookie: serverCookie } },
      register
    );
    assertStatus(liveLedger.response, 200, "Live register ledger");
    assert.equal(liveLedger.data.session.id, firstSessionId);
    const expectedBalance = roundedCurrency(100 + order.total - 10);
    assert.equal(liveLedger.data.balance, expectedBalance);
    assert.equal(
      (liveLedger.data.entries || []).filter(
        (entry: any) => entry.registerSessionId === firstSessionId
      ).length,
      2
    );

    logStep("large discrepancies require manager approval and close records are replay-safe");
    const closeKey = `p1-register-close-${crypto.randomUUID()}`;
    const countedCash = roundedCurrency(expectedBalance + 10);
    const cashierClose = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "PATCH",
        headers: {
          cookie: serverCookie,
          "idempotency-key": closeKey,
        },
        body: JSON.stringify({
          sessionId: firstSessionId,
          countedCash,
          note: "Cashier close attempt",
        }),
      },
      register
    );
    assertStatus(cashierClose.response, 409, "Unapproved cashier discrepancy");
    assert.equal(cashierClose.data.code, "MANAGER_APPROVAL_REQUIRED");

    const managerClose = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "PATCH",
        headers: {
          cookie: adminCookie,
          "idempotency-key": closeKey,
        },
        body: JSON.stringify({
          sessionId: firstSessionId,
          countedCash,
          note: "Approved integration discrepancy",
          approvalReason: "Verified against the physical test count",
        }),
      },
      register
    );
    assertStatus(managerClose.response, 200, "Manager-approved register close");
    assert.equal(managerClose.data.session.status, "closed");
    assert.equal(managerClose.data.close.approvalRequired, true);
    assert.equal(managerClose.data.close.discrepancy, 10);
    assert.equal(managerClose.data.close.approvedByName, "Admin");
    assert.equal(managerClose.data.replayed, false);
    const firstCloseId = managerClose.data.close.id as string;

    const closeReplay = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "PATCH",
        headers: {
          cookie: adminCookie,
          "idempotency-key": closeKey,
        },
        body: JSON.stringify({
          sessionId: firstSessionId,
          countedCash,
          note: "Approved integration discrepancy",
          approvalReason: "Verified against the physical test count",
        }),
      },
      register
    );
    assertStatus(closeReplay.response, 200, "Register close replay");
    assert.equal(closeReplay.data.replayed, true);
    assert.equal(closeReplay.data.close.id, firstCloseId);

    const afterCloseMovement = await api<any>(
      "/api/cash",
      {
        method: "POST",
        headers: { cookie: serverCookie },
        body: JSON.stringify({
          type: "payin",
          amount: 1,
          note: "Must not reach a closed register",
        }),
      },
      register
    );
    assertStatus(afterCloseMovement.response, 409, "Post-close cash movement");
    assert.equal(afterCloseMovement.data.code, "REGISTER_SESSION_REQUIRED");

    logStep("concurrent opening requests still produce one open session");
    const raceRequests = await Promise.all([
      api<any>(
        `/api/registers/${encodeURIComponent(register.id)}/session`,
        {
          method: "POST",
          headers: {
            cookie: serverCookie,
            "idempotency-key": `p1-register-race-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ openingFloat: 25 }),
        },
        register
      ),
      api<any>(
        `/api/registers/${encodeURIComponent(register.id)}/session`,
        {
          method: "POST",
          headers: {
            cookie: serverCookie,
            "idempotency-key": `p1-register-race-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ openingFloat: 25 }),
        },
        register
      ),
    ]);
    assert.deepEqual(
      raceRequests.map((entry) => entry.response.status).sort(),
      [201, 409]
    );
    const winningOpen = raceRequests.find((entry) => entry.response.status === 201);
    assert.ok(winningOpen, "One concurrent register opening must succeed");
    const raceSessionId = winningOpen.data.session.id as string;

    const exactClose = await api<any>(
      `/api/registers/${encodeURIComponent(register.id)}/session`,
      {
        method: "PATCH",
        headers: {
          cookie: serverCookie,
          "idempotency-key": `p1-register-exact-close-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          sessionId: raceSessionId,
          countedCash: 25,
          note: "Exact cashier close",
        }),
      },
      register
    );
    assertStatus(exactClose.response, 200, "Exact cashier close");
    assert.equal(exactClose.data.close.approvalRequired, false);
    assert.equal(exactClose.data.close.discrepancy, 0);

    logStep("database links, audit events, and immutable close records are enforced");
    const paymentLinks = await db.$queryRawUnsafe<
      Array<{ registerSessionId: string | null }>
    >(
      'SELECT "registerSessionId" FROM "PaymentEvent" WHERE "id" = $1',
      checkout.data.payment.eventId
    );
    assert.equal(paymentLinks[0]?.registerSessionId, firstSessionId);

    const payoutLinks = await db.$queryRawUnsafe<
      Array<{ registerSessionId: string | null }>
    >(
      'SELECT "registerSessionId" FROM "CashDrawerEntry" WHERE "id" = $1',
      payout.data.entry.id
    );
    assert.equal(payoutLinks[0]?.registerSessionId, firstSessionId);

    const saleCounts = await db.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS "count"
       FROM "CashDrawerEntry"
       WHERE "registerSessionId" = $1 AND "type"::text = 'sale'`,
      firstSessionId
    );
    assert.equal(saleCounts[0]?.count, 1);

    const closeCounts = await db.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS "count"
       FROM "CashRegisterClose"
       WHERE "sessionId" = $1`,
      firstSessionId
    );
    assert.equal(closeCounts[0]?.count, 1);

    const openCounts = await db.$queryRawUnsafe<CountRow[]>(
      `SELECT COUNT(*)::int AS "count"
       FROM "CashRegisterSession"
       WHERE "registerId" = $1 AND "status" = 'open'`,
      register.id
    );
    assert.equal(openCounts[0]?.count, 0);

    const auditCounts = await db.auditEvent.groupBy({
      by: ["action"],
      where: {
        action: {
          in: [
            "cash.register.create",
            "cash.session.open",
            "cash.session.close",
            "cash.payout",
            "payment.cash.capture",
          ],
        },
      },
      _count: { _all: true },
    });
    const auditActions = new Set(auditCounts.map((entry) => entry.action));
    for (const action of [
      "cash.register.create",
      "cash.session.open",
      "cash.session.close",
      "cash.payout",
      "payment.cash.capture",
    ]) {
      assert.ok(auditActions.has(action), `Missing immutable audit action ${action}`);
    }

    await assert.rejects(
      db.$executeRawUnsafe(
        'UPDATE "CashRegisterClose" SET "note" = $1 WHERE "id" = $2',
        "tampered",
        firstCloseId
      ),
      /immutable/i
    );
    await assert.rejects(
      db.$executeRawUnsafe(
        'UPDATE "CashRegisterSession" SET "openedByName" = $1 WHERE "id" = $2',
        "tampered",
        firstSessionId
      ),
      /immutable/i
    );

    console.log("\n[p1-register] Cash-register lifecycle assertions passed.");
  } finally {
    await db.employee.updateMany({
      where: { id: originalSarah.id },
      data: { role: originalSarah.role },
    });
  }
}

main()
  .catch((error) => {
    console.error("\n[p1-register] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
