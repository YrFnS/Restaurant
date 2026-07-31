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
const CLOCK_SOURCE = "198.51.100.37";
const LOGIN_SCOPES = ["auth-login-source", "auth-login-pin"];
const CLOCK_SCOPES = ["employee-clock-source", "employee-clock-pin"];
const ALL_TEST_SCOPES = [...LOGIN_SCOPES, ...CLOCK_SCOPES];

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

async function setActive(
  employeeId: string,
  isActive: boolean,
  adminCookie: string,
  label: string
) {
  const result = await request(
    `/api/employees/${encodeURIComponent(employeeId)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ isActive }),
    }
  );
  expectStatus(result, 200, label);
}

async function clock(pin: string, action: "in" | "out") {
  return request(
    "/api/employees/clock",
    {
      method: "POST",
      body: JSON.stringify({ pin, action }),
    },
    CLOCK_SOURCE
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

    await setActive(
      targetId,
      false,
      adminCookie,
      "Deactivate login lockout test employee"
    );

    console.log("[p0-lockout] exhausting the shared login credential allowance");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await login(targetPin, ATTEMPT_SOURCE);
      expectStatus(failed, 401, `Inactive login attempt ${attempt}`);
      assert.equal(failed.data?.code, "INVALID_CREDENTIALS");
      assert.equal(failed.data?.error, "Invalid credentials");
    }

    const blocked = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(blocked, 429, "Login attempt beyond threshold");
    assert.equal(blocked.data?.code, "LOGIN_RATE_LIMITED");
    assert.ok(
      Number(blocked.response.headers.get("retry-after")) >= 1,
      "Rate-limited login response must include Retry-After"
    );

    const loginLimiterRows = await db.rateLimitCounter.findMany({
      where: {
        scope: { in: LOGIN_SCOPES },
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      new Set(loginLimiterRows.map((row) => row.scope)).size,
      2,
      "Login attempts must create both source and credential counters"
    );
    assert.ok(
      loginLimiterRows.some(
        (row) => row.scope === "auth-login-pin" && row.count >= 6
      ),
      "Login credential counter must record the blocked attempt"
    );
    assert.ok(
      loginLimiterRows.some(
        (row) => row.scope === "auth-login-source" && row.count >= 6
      ),
      "Login source counter must record every attempt"
    );
    const loginLimiterKeys = loginLimiterRows.map((row) => row.key);

    await setActive(
      targetId,
      true,
      adminCookie,
      "Reactivate login lockout test employee"
    );

    const stillBlocked = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(
      stillBlocked,
      429,
      "Reactivation alone must not bypass the active login window"
    );

    console.log("[p0-lockout] simulating login window expiry and validating recovery");
    await db.rateLimitCounter.deleteMany({
      where: { key: { in: loginLimiterKeys } },
    });

    const recovered = await login(targetPin, ATTEMPT_SOURCE);
    expectStatus(recovered, 200, "Login after fixed-window expiry");
    assert.equal(recovered.data?.user?.id, targetId);
    const recoveredCookie = cookieFrom(recovered.response);

    const remainingLoginCounters = await db.rateLimitCounter.count({
      where: { key: { in: loginLimiterKeys } },
    });
    assert.equal(
      remainingLoginCounters,
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

    console.log("[p0-lockout] exhausting the shared clock-kiosk credential allowance");
    await setActive(
      targetId,
      false,
      adminCookie,
      "Deactivate clock lockout test employee"
    );

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failedClock = await clock(targetPin, "in");
      expectStatus(failedClock, 401, `Inactive clock attempt ${attempt}`);
      assert.equal(failedClock.data?.code, "INVALID_CREDENTIALS");
      assert.equal(failedClock.data?.error, "Invalid credentials");
    }

    const blockedClock = await clock(targetPin, "in");
    expectStatus(blockedClock, 429, "Clock attempt beyond threshold");
    assert.equal(blockedClock.data?.code, "CLOCK_RATE_LIMITED");
    assert.ok(
      Number(blockedClock.response.headers.get("retry-after")) >= 1,
      "Rate-limited clock response must include Retry-After"
    );

    const clockLimiterRows = await db.rateLimitCounter.findMany({
      where: {
        scope: { in: CLOCK_SCOPES },
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      new Set(clockLimiterRows.map((row) => row.scope)).size,
      2,
      "Clock attempts must create both source and credential counters"
    );
    assert.ok(
      clockLimiterRows.some(
        (row) => row.scope === "employee-clock-pin" && row.count >= 6
      ),
      "Clock credential counter must record the blocked attempt"
    );
    assert.ok(
      clockLimiterRows.some(
        (row) => row.scope === "employee-clock-source" && row.count >= 6
      ),
      "Clock source counter must record every attempt"
    );
    const clockLimiterKeys = clockLimiterRows.map((row) => row.key);

    await setActive(
      targetId,
      true,
      adminCookie,
      "Reactivate clock lockout test employee"
    );
    const stillClockBlocked = await clock(targetPin, "in");
    expectStatus(
      stillClockBlocked,
      429,
      "Reactivation alone must not bypass the active clock window"
    );

    await db.rateLimitCounter.deleteMany({
      where: { key: { in: clockLimiterKeys } },
    });

    const clockIn = await clock(targetPin, "in");
    expectStatus(clockIn, 201, "Clock in after fixed-window expiry");
    assert.equal(clockIn.data?.employee?.id, targetId);
    assert.equal(clockIn.data?.employee?.clockedIn, true);

    const remainingClockCounters = await db.rateLimitCounter.count({
      where: { key: { in: clockLimiterKeys } },
    });
    assert.equal(
      remainingClockCounters,
      0,
      "Successful clock authentication must reset its counters"
    );

    const clockInAudit = await db.auditEvent.findFirst({
      where: {
        action: "employee.time.clock_in",
        entityType: "EmployeeTimeEvent",
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(clockInAudit, "Successful clock-in must create an audit event");
    assert.equal((clockInAudit.metadata as any)?.employeeId, targetId);
    assert.equal((clockInAudit.metadata as any)?.source, "kiosk");

    const clockOut = await clock(targetPin, "out");
    expectStatus(clockOut, 201, "Clock out with valid PIN");
    assert.equal(clockOut.data?.employee?.clockedIn, false);

    const clockOutAudit = await db.auditEvent.findFirst({
      where: {
        action: "employee.time.clock_out",
        entityType: "EmployeeTimeEvent",
        createdAt: { gte: testStartedAt },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(clockOutAudit, "Successful clock-out must create an audit event");
    assert.equal((clockOutAudit.metadata as any)?.employeeId, targetId);
    assert.equal((clockOutAudit.metadata as any)?.source, "kiosk");

    console.log("[p0-lockout] Login and clock lockout assertions passed.");
  } finally {
    await db.rateLimitCounter.deleteMany({
      where: {
        scope: { in: ALL_TEST_SCOPES },
        createdAt: { gte: testStartedAt },
      },
    });

    if (targetId) {
      const cleanupTargetId = targetId;
      await db.$transaction(async (tx) => {
        await tx.staffSession.deleteMany({
          where: { employeeId: cleanupTargetId },
        });
        await tx.schedule.deleteMany({
          where: { employeeId: cleanupTargetId },
        });
        // The clock-in/out events are an immutable audit ledger. Preserve the
        // employee record they reference and retire the disposable account.
        await tx.employee.updateMany({
          where: { id: cleanupTargetId },
          data: { isActive: false },
        });
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