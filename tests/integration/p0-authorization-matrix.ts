import assert from "node:assert/strict";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.29";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-rbac-${crypto.randomUUID()}`);

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
    assert.ok(!pattern.test(key), `Sensitive KDS key ${path}.${key} was exposed`);
    assertNoKeysMatching(nested, pattern, `${path}.${key}`);
  }
}

async function login(pin: string): Promise<string> {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  expectStatus(result, 200, `Login for PIN ${pin}`);
  const setCookie = result.response.headers.get("set-cookie");
  assert.ok(setCookie, "Login must set a session cookie");
  return setCookie.split(";", 1)[0];
}

async function createRole(
  adminCookie: string,
  role: "cashier" | "inventory_manager" | "analyst"
): Promise<string> {
  const pin = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
  const created = await request("/api/employees", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      name: `P0 ${role} ${crypto.randomUUID().slice(0, 8)}`,
      pin,
      role,
      hourlyWage: 0,
      email: null,
      phone: null,
      isActive: true,
    }),
  });
  expectStatus(created, 201, `Create ${role}`);
  return login(pin);
}

async function main() {
  console.log("[p0-rbac] validating anonymous access failures");
  expectStatus(await request("/api/employees"), 401, "Anonymous employee list");
  expectStatus(await request("/api/analytics?days=7"), 401, "Anonymous analytics");
  expectStatus(await request("/api/kitchen?screen=grill"), 401, "Anonymous KDS data");
  expectStatus(await request("/api/cash"), 401, "Anonymous cash ledger");
  expectStatus(await request("/api/inventory"), 401, "Anonymous inventory");

  const adminCookie = await login("1234");
  const managerCookie = await login("2222");
  const serverCookie = await login("1111");
  const cookCookie = await login("4444");
  const hostCookie = await login("6666");
  const cashierCookie = await createRole(adminCookie, "cashier");
  const inventoryCookie = await createRole(adminCookie, "inventory_manager");
  const analystCookie = await createRole(adminCookie, "analyst");

  console.log("[p0-rbac] validating administrative boundaries");
  expectStatus(
    await request("/api/employees", { headers: { cookie: managerCookie } }),
    200,
    "Manager employee list"
  );
  expectStatus(
    await request("/api/employees", { headers: { cookie: serverCookie } }),
    403,
    "Server employee list"
  );
  expectStatus(
    await request("/api/menu?all=true", { headers: { cookie: serverCookie } }),
    403,
    "Server administrative menu read"
  );
  expectStatus(
    await request("/api/settings", {
      method: "PUT",
      headers: { cookie: analystCookie },
      body: JSON.stringify({}),
    }),
    403,
    "Analyst settings mutation"
  );

  console.log("[p0-rbac] validating operational role grants and denials");
  expectStatus(
    await request("/api/orders?limit=5", { headers: { cookie: serverCookie } }),
    200,
    "Server order read"
  );

  const kitchenResult = await request("/api/kitchen?screen=grill", {
    headers: { cookie: cookCookie },
  });
  expectStatus(kitchenResult, 200, "Cook KDS read");
  assert.equal(
    typeof kitchenResult.data?.totalToday,
    "number",
    "KDS response must include the redacted daily order count"
  );
  assertNoKeysMatching(
    kitchenResult.data,
    /^(customerPhone|deliveryAddress|subtotal|taxAmount|deliveryFee|discountAmount|tipAmount|total|paymentMethod|paymentStatus|unitPrice|totalPrice)$/i
  );

  expectStatus(
    await request("/api/orders?limit=5", { headers: { cookie: cookCookie } }),
    403,
    "Cook administrative order read"
  );
  expectStatus(
    await request("/api/reservations", { headers: { cookie: hostCookie } }),
    200,
    "Host reservation read"
  );
  expectStatus(
    await request("/api/cash", { headers: { cookie: hostCookie } }),
    403,
    "Host cash read"
  );
  expectStatus(
    await request("/api/cash", { headers: { cookie: cashierCookie } }),
    200,
    "Cashier cash read"
  );
  expectStatus(
    await request("/api/employees", { headers: { cookie: cashierCookie } }),
    403,
    "Cashier employee read"
  );
  expectStatus(
    await request("/api/inventory", { headers: { cookie: inventoryCookie } }),
    200,
    "Inventory manager inventory read"
  );
  expectStatus(
    await request("/api/cash", { headers: { cookie: inventoryCookie } }),
    403,
    "Inventory manager cash read"
  );
  expectStatus(
    await request("/api/analytics?days=7", { headers: { cookie: analystCookie } }),
    200,
    "Analyst analytics read"
  );
  expectStatus(
    await request("/api/reports", { headers: { cookie: analystCookie } }),
    200,
    "Analyst report read"
  );
  expectStatus(
    await request("/api/orders?limit=5", { headers: { cookie: analystCookie } }),
    403,
    "Analyst full order read"
  );
  expectStatus(
    await request("/api/employees", { headers: { cookie: analystCookie } }),
    403,
    "Analyst employee read"
  );

  console.log("[p0-rbac] authorization matrix passed.");
}

main().catch((error) => {
  console.error("[p0-rbac] Test failed:", error);
  process.exitCode = 1;
});
