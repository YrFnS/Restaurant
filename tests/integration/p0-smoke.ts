import assert from "node:assert/strict";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SOURCE_IP = "198.51.100.27";

interface ApiResponse<T> {
  response: Response;
  data: T;
}

function logStep(message: string) {
  console.log(`\n[p0-integration] ${message}`);
}

async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();

  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-smoke-${crypto.randomUUID()}`);

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

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Successful login must set the staff session cookie");
  return setCookie.split(";", 1)[0];
}

function assertStatus(response: Response, expected: number, context: string) {
  assert.equal(
    response.status,
    expected,
    `${context}: expected HTTP ${expected}, received ${response.status}`
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

async function createOrder(
  body: Record<string, unknown>,
  idempotencyKey: string
): Promise<ApiResponse<any>> {
  return api("/api/orders", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}

async function main() {
  logStep("protected employee data fails closed without a session");
  const unauthenticatedEmployees = await api<any>("/api/employees");
  assertStatus(
    unauthenticatedEmployees.response,
    401,
    "Unauthenticated employee listing"
  );

  logStep("login errors are generic and successful login creates a persisted cookie session");
  const failedLogin = await api<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "9999" }),
  });
  assertStatus(failedLogin.response, 401, "Invalid staff login");
  assert.equal(failedLogin.data?.code, "INVALID_CREDENTIALS");

  const login = await api<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "1234" }),
  });
  assertStatus(login.response, 200, "Valid staff login");
  assert.equal(login.data?.user?.role, "admin");
  const sessionCookie = cookieFrom(login.response);

  const session = await api<any>("/api/auth/session", {
    headers: { cookie: sessionCookie },
  });
  assertStatus(session.response, 200, "Session lookup");
  assert.equal(session.data?.user?.role, "admin");

  const employees = await api<any>("/api/employees", {
    headers: { cookie: sessionCookie },
  });
  assertStatus(employees.response, 200, "Authorized employee listing");
  assert.ok(Array.isArray(employees.data?.employees));
  assertNoKeysMatching(employees.data, /^(pin|pinHash|pinVerifier|tokenHash)$/i);

  logStep("public ordering uses the server price and rejects financial-field tampering");
  const menu = await api<any>("/api/menu");
  assertStatus(menu.response, 200, "Public menu");
  const menuItems = (menu.data?.categories || []).flatMap(
    (category: any) => category.items || []
  );
  const menuItem = menuItems.find(
    (item: any) =>
      item.isAvailable &&
      !(item.modifierGroups || []).some((group: any) => group.isRequired)
  );
  assert.ok(menuItem, "Seed data must include an available item without required modifiers");

  const customerPhone = `+964700${String(Date.now()).slice(-7)}`;
  const orderBody = {
    type: "takeout",
    customerName: "P0 Integration Guest",
    customerPhone,
    notes: "Automated P0 integration order",
    tip: { mode: "none" },
    items: [
      {
        menuItemId: menuItem.id,
        quantity: 1,
        modifierOptionIds: [],
        notes: null,
        course: 1,
      },
    ],
  };

  const firstKey = `p0-smoke-order-${crypto.randomUUID()}`;
  const firstOrder = await createOrder(orderBody, firstKey);
  assertStatus(firstOrder.response, 201, "Initial order creation");
  assert.equal(firstOrder.data?.order?.paymentStatus, "unpaid");
  assert.ok(firstOrder.data?.order?.total > 0, "Server-calculated total must be positive");
  assert.ok(
    typeof firstOrder.data?.accessToken === "string" &&
      firstOrder.data.accessToken.length >= 20,
    "Order creation must return an opaque access token"
  );

  const replay = await createOrder(orderBody, firstKey);
  assertStatus(replay.response, 200, "Idempotent replay");
  assert.equal(replay.data?.replayed, true);
  assert.equal(replay.data?.order?.id, firstOrder.data.order.id);
  assert.equal(replay.data?.order?.orderNumber, firstOrder.data.order.orderNumber);

  const tampered = await createOrder(
    {
      ...orderBody,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      paymentStatus: "paid",
    },
    `p0-smoke-tamper-${crypto.randomUUID()}`
  );
  assertStatus(tampered.response, 400, "Tampered financial order payload");
  assert.equal(tampered.data?.code, "VALIDATION_ERROR");

  logStep("concurrent retries stay idempotent and distinct requests receive unique references");
  const raceKey = `p0-smoke-race-${crypto.randomUUID()}`;
  const raced = await Promise.all(
    Array.from({ length: 5 }, () => createOrder(orderBody, raceKey))
  );
  raced.forEach(({ response }, index) => {
    assert.ok(
      response.status === 200 || response.status === 201,
      `Concurrent idempotent request ${index + 1} returned ${response.status}`
    );
  });
  const racedIds = new Set(raced.map(({ data }) => data?.order?.id));
  const racedNumbers = new Set(raced.map(({ data }) => data?.order?.orderNumber));
  assert.equal(racedIds.size, 1, "Concurrent idempotent requests created multiple orders");
  assert.equal(
    racedNumbers.size,
    1,
    "Concurrent idempotent requests created multiple references"
  );

  const distinct = await Promise.all(
    Array.from({ length: 4 }, () =>
      createOrder(orderBody, `p0-smoke-distinct-${crypto.randomUUID()}`)
    )
  );
  distinct.forEach(({ response }, index) =>
    assertStatus(response, 201, `Distinct concurrent order ${index + 1}`)
  );
  assert.equal(
    new Set(distinct.map(({ data }) => data?.order?.orderNumber)).size,
    distinct.length,
    "Distinct concurrent orders must receive unique references"
  );

  logStep("tracking requires the opaque credential and returns a redacted DTO");
  const orderNumber = String(firstOrder.data.order.orderNumber).replace(/^#/, "");
  const trackingWithoutToken = await api<any>(
    `/api/orders/track/${encodeURIComponent(orderNumber)}`
  );
  assertStatus(trackingWithoutToken.response, 404, "Tracking without credential");

  const tracking = await api<any>(
    `/api/orders/track/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(
      firstOrder.data.accessToken
    )}`
  );
  assertStatus(tracking.response, 200, "Tracking with credential");
  assert.equal(tracking.data?.order?.orderNumber, firstOrder.data.order.orderNumber);
  assertNoKeysMatching(
    tracking.data,
    /^(customerPhone|customerId|paymentStatus|tokenHash|accessToken)$/i
  );

  logStep("cash checkout is authorized, atomic, and replay-safe");
  const insufficientTender = await api<any>("/api/pos/checkout", {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: JSON.stringify({
      orderId: firstOrder.data.order.id,
      paymentMethod: "cash",
      tendered: 0,
    }),
  });
  assertStatus(insufficientTender.response, 400, "Insufficient cash tender");
  assert.equal(insufficientTender.data?.code, "INSUFFICIENT_TENDER");

  const checkout = await api<any>("/api/pos/checkout", {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: JSON.stringify({
      orderId: firstOrder.data.order.id,
      paymentMethod: "cash",
      tendered: firstOrder.data.order.total,
    }),
  });
  assertStatus(checkout.response, 200, "Cash checkout");
  assert.equal(checkout.data?.order?.paymentStatus, "paid");
  assert.equal(checkout.data?.replayed, false);

  const checkoutReplay = await api<any>("/api/pos/checkout", {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: JSON.stringify({
      orderId: firstOrder.data.order.id,
      paymentMethod: "cash",
      tendered: firstOrder.data.order.total,
    }),
  });
  assertStatus(checkoutReplay.response, 200, "Cash checkout replay");
  assert.equal(checkoutReplay.data?.replayed, true);

  const cash = await api<any>("/api/cash", {
    headers: { cookie: sessionCookie },
  });
  assertStatus(cash.response, 200, "Cash ledger read");
  const matchingSales = (cash.data?.entries || []).filter(
    (entry: any) =>
      entry.type === "sale" &&
      String(entry.note || "").includes(firstOrder.data.order.orderNumber)
  );
  assert.equal(
    matchingSales.length,
    1,
    "Replayed checkout must not create a duplicate cash sale"
  );

  logStep("logout revokes the persisted session");
  const logout = await api<any>("/api/auth/logout", {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: JSON.stringify({}),
  });
  assertStatus(logout.response, 200, "Logout");

  const revokedSession = await api<any>("/api/auth/session", {
    headers: { cookie: sessionCookie },
  });
  assertStatus(revokedSession.response, 401, "Revoked session lookup");

  const revokedEmployees = await api<any>("/api/employees", {
    headers: { cookie: sessionCookie },
  });
  assertStatus(revokedEmployees.response, 401, "Revoked session authorization");

  console.log("\n[p0-integration] All database-backed smoke assertions passed.");
}

main().catch((error) => {
  console.error("\n[p0-integration] Smoke test failed:", error);
  process.exitCode = 1;
});
