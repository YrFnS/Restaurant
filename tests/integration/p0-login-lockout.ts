import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const ADMIN_SOURCE = "198.51.100.33";
const ATTEMPT_SOURCE = "198.51.100.34";
const LOGIN_SCOPES = ["auth-login-source", "auth-login-pin"];

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {},
  source = ADMIN_SOURCE
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", source);
  headers.set("x-request-id", `p0-lockout-${crypto.randomUUID()}`);

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

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Successful login must set a session cookie");
  return setCookie.split(";", 1)[0];
}

async function login(pin: string, source: string) {
  return request(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ pin }),
    },
    source
  );
}

async function main() {
  let targetId: string | null = null;
  const testStartedAt = new Date(Date.now() - 1_000);

  try {
    const adminLogin = await login("1234", ADMIN_SOURCE);
    expectStatus(adminLogin, 200, "Administrative login");
    const adminCookie = cookieFrom(adminLogin.response);

    const targetPin = String(randomInt(10_000_000, 100_000_000));
    const created = await request("/api/employees", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        name: `P0 Lockout ${crypto.randomUUID().slice(0, 8)}`,
        pin: targetPin,
        role: "staff",
        hourlyWage: 0,
        email: null,
        phone: null,
        isActive: true,
      }),
    });
    expectStatus(created, 201, "Create lockout test employee");
    targetId = String(created.data?.employee?.id || "");
    assert.ok(targetId, "Employee creation must return an ID");

    const deactivate = await request(
      `/api/employees/${encodeURIComponent(targetId)}`,
      {
        method: "PATCH",
        headers: { cookie: adminCookie },
        body: JSON.stringify({ isActive: false }),
      }
    );
    expectStatus(deactivate, 200, "Deactivate lockout test employee");

    console.log("[p0-lockout] exhausting the shared per-credential allowance");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await login(targetPin, ATTEMPT_SOURCE);
      expectStatus(failed, 401, `Inactive credential attempt ${attempt}`);
      assert.equal(failed.data?.code, "INVALID_CREDENTIALS");
      assert.equal(failed.data?.error, "Invalid credentials");
    }

    const blocked = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(blocked, 429, "Credential attempt beyond threshold");
    assert.equal(blocked.data?.code, "LOGIN_RATE_LIMITED");
    assert.ok(
      Number(blocked.response.headers.get("retry-after")) >= 1,
      "Rate-limited response must include Retry-After"
    );

    const limiterRows = await db.rateLimitCounter.findMany({
      where: {
        scope: { in: LOGIN_SCOPES },
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      new Set(limiterRows.map((row) => row.scope)).size,
      2,
      "Login attempts must create both source and credential counters"
    );
    assert.ok(
      limiterRows.some(
        (row) => row.scope === "auth-login-pin" && row.count >= 6
      ),
      "Credential counter must record the blocked attempt"
    );
    assert.ok(
      limiterRows.some(
        (row) => row.scope === "auth-login-source" && row.count >= 6
      ),
      "Source counter must record every attempt"
    );
    const limiterKeys = limiterRows.map((row) => row.key);

    const reactivate = await request(
      `/api/employees/${encodeURIComponent(targetId)}`,
      {
        method: "PATCH",
        headers: { cookie: adminCookie },
        body: JSON.stringify({ isActive: true }),
      }
    );
    expectStatus(reactivate, 200, "Reactivate lockout test employee");

    const stillBlocked = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(
      stillBlocked,
      429,
      "Reactivation alone must not bypass the active credential window"
    );

    console.log("[p0-lockout] simulating fixed-window expiry and validating recovery");
    await db.rateLimitCounter.deleteMany({
      where: { key: { in: limiterKeys } },
    });

    const recovered = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(recovered, 200, "Login after fixed-window expiry");
    assert.equal(recovered.data?.user?.id, targetId);
    const recoveredCookie = cookieFrom(recovered.response);

    const remainingCounters = await db.rateLimitCounter.count({
      where: { key: { in: limiterKeys } },
    });
    assert.equal(
      remainingCounters,
      0,
      "Successful login must reset its current source and credential counters"
    );

    const successAudit = await db.auditEvent.findFirst({
      where: {
        action: "auth.login.success",
        entityType: "Employee",
        entityId: targetId,
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(successAudit, "Recovered login must create a security audit event");

    const logout = await request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: { cookie: recoveredCookie },
        body: JSON.stringify({}),
      },
      ATTEMPT_SOURCE
    );
    expectStatus(logout, 200, "Recovered employee logout");

    console.log("[p0-lockout] Shared lockout and recovery assertions passed.");
  } finally {
    await db.rateLimitCounter.deleteMany({
      where: {
        scope: { in: LOGIN_SCOPES },
        createdAt: { gte: testStartedAt },
      },
    });

    if (targetId) {
      await db.$transaction(async (tx) => {
        await tx.staffSession.deleteMany({ where: { employeeId: targetId } });
        await tx.schedule.deleteMany({ where: { employeeId: targetId } });
        await tx.employee.deleteMany({ where: { id: targetId } });
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("[p0-lockout] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
