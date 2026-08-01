import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.207";
const db = new PrismaClient();

interface ApiResult<T> {
  response: Response;
  data: T;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-time-${crypto.randomUUID()}`);
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

function uniquePin(): string {
  return String(70_000_000 + Math.floor(Math.random() * 9_000_000));
}

async function createEmployee(
  cookie: string,
  name: string,
  hourlyWage = 20
): Promise<{ id: string; pin: string }> {
  const pin = uniquePin();
  const result = await api<any>("/api/employees", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name,
      pin,
      role: "staff",
      hourlyWage,
      isActive: true,
    }),
  });
  assertStatus(result.response, 201, `Create employee ${name}`);
  return { id: result.data.employee.id, pin };
}

async function managerClock(
  cookie: string,
  employeeId: string,
  action: string,
  occurredAt: Date,
  key = `p1-time-event-${crypto.randomUUID()}`
) {
  return api<any>("/api/employees/clock", {
    method: "POST",
    headers: { cookie, "Idempotency-Key": key },
    body: JSON.stringify({
      employeeId,
      action,
      occurredAt: occurredAt.toISOString(),
      reasonCode: "integration_test",
      reason: "Database-backed employee timekeeping integration test",
    }),
  });
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

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

async function main() {
  console.log("\n[p1-timekeeping] authorization and migration consistency");
  const adminCookie = await login("1234");
  const anonymous = await api<any>("/api/employees/clock");
  assertStatus(anonymous.response, 401, "Anonymous clock-status read");
  const anonymousTimesheet = await api<any>("/api/timekeeping");
  assertStatus(anonymousTimesheet.response, 401, "Anonymous timesheet read");

  const cacheMismatch = await db.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::integer AS "count"
    FROM "Employee" AS employee
    LEFT JOIN "EmployeeShift" AS shift
      ON shift."employeeId" = employee."id" AND shift."status" = 'open'
    WHERE employee."clockedIn" IS DISTINCT FROM (shift."id" IS NOT NULL)
  `);
  assert.equal(cacheMismatch[0]?.count, 0, "Legacy clock cache must match open shifts");

  const settings = await db.$queryRawUnsafe<
    Array<{ timezone: string; operationalDayStartMinutes: number }>
  >(`SELECT "timezone", "operationalDayStartMinutes" FROM "RestaurantSettings" WHERE "id" = '1'`);
  assert.equal(settings[0]?.timezone, "UTC");
  assert.equal(settings[0]?.operationalDayStartMinutes, 0);
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `UPDATE "RestaurantSettings" SET "timezone" = 'Not/A_Timezone' WHERE "id" = '1'`
      ),
    "Unknown restaurant timezone must be rejected"
  );

  console.log("\n[p1-timekeeping] exact shift, break, and labor calculation");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const employee = await createEmployee(
    adminCookie,
    `P1 Time Employee ${suffix}`,
    20
  );
  const now = new Date();
  const clockInAt = new Date(now.getTime() - 9 * 60 * 60 * 1_000);
  const breakStartAt = new Date(now.getTime() - 5 * 60 * 60 * 1_000);
  const breakEndAt = new Date(now.getTime() - 4.5 * 60 * 60 * 1_000);
  const clockOutAt = now;

  const clockInKey = `p1-time-clock-in-${crypto.randomUUID()}`;
  const clockIn = await managerClock(
    adminCookie,
    employee.id,
    "clock_in",
    clockInAt,
    clockInKey
  );
  assertStatus(clockIn.response, 201, "Manager clock in");
  assert.equal(clockIn.data.employee.clockedIn, true);
  assert.equal(clockIn.data.employee.onBreak, false);

  const clockInReplay = await managerClock(
    adminCookie,
    employee.id,
    "clock_in",
    clockInAt,
    clockInKey
  );
  assertStatus(clockInReplay.response, 200, "Clock-in replay");
  assert.equal(clockInReplay.data.replayed, true);

  const clockInConflict = await api<any>("/api/employees/clock", {
    method: "POST",
    headers: { cookie: adminCookie, "Idempotency-Key": clockInKey },
    body: JSON.stringify({
      employeeId: employee.id,
      action: "clock_in",
      occurredAt: clockInAt.toISOString(),
      reasonCode: "integration_test",
      reason: "A different replay payload must be rejected",
    }),
  });
  assertStatus(clockInConflict.response, 409, "Clock-in payload conflict");
  assert.equal(clockInConflict.data.code, "TIME_EVENT_IDEMPOTENCY_CONFLICT");

  const duplicateClockIn = await managerClock(
    adminCookie,
    employee.id,
    "clock_in",
    new Date(clockInAt.getTime() + 1_000)
  );
  assertStatus(duplicateClockIn.response, 409, "Second open shift rejection");

  const breakStart = await managerClock(
    adminCookie,
    employee.id,
    "break_start",
    breakStartAt
  );
  assertStatus(breakStart.response, 201, "Break start");
  assert.equal(breakStart.data.employee.onBreak, true);

  const clockOutDuringBreak = await managerClock(
    adminCookie,
    employee.id,
    "clock_out",
    new Date(breakStartAt.getTime() + 60_000)
  );
  assertStatus(clockOutDuringBreak.response, 409, "Clock out during active break");
  assert.equal(clockOutDuringBreak.data.code, "ACTIVE_BREAK_MUST_END");

  const breakEnd = await managerClock(
    adminCookie,
    employee.id,
    "break_end",
    breakEndAt
  );
  assertStatus(breakEnd.response, 201, "Break end");
  assert.equal(breakEnd.data.employee.onBreak, false);

  const clockOut = await managerClock(
    adminCookie,
    employee.id,
    "clock_out",
    clockOutAt
  );
  assertStatus(clockOut.response, 201, "Manager clock out");
  assert.equal(clockOut.data.employee.clockedIn, false);

  const shiftRows = await db.$queryRawUnsafe<
    Array<{
      id: string;
      status: string;
      grossSeconds: number;
      breakSeconds: number;
      paidSeconds: number;
      hourlyWageMinor: bigint;
      baseLaborCostMinor: bigint;
    }>
  >(
    `SELECT "id", "status"::text AS "status", "grossSeconds", "breakSeconds",
            "paidSeconds", "hourlyWageMinor", "baseLaborCostMinor"
     FROM "EmployeeShift" WHERE "employeeId" = $1`,
    employee.id
  );
  assert.equal(shiftRows.length, 1);
  assert.equal(shiftRows[0].status, "closed");
  assert.equal(shiftRows[0].grossSeconds, 32_400);
  assert.equal(shiftRows[0].breakSeconds, 1_800);
  assert.equal(shiftRows[0].paidSeconds, 30_600);
  assert.equal(shiftRows[0].hourlyWageMinor, 2_000n);
  assert.equal(shiftRows[0].baseLaborCostMinor, 17_000n);

  const eventCount = await db.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS "count" FROM "EmployeeTimeEvent" WHERE "employeeId" = $1`,
    employee.id
  );
  assert.equal(eventCount[0]?.count, 4);
  const breakRows = await db.$queryRawUnsafe<
    Array<{ status: string; durationSeconds: number }>
  >(
    `SELECT "status"::text AS "status", "durationSeconds"
     FROM "EmployeeBreak" WHERE "shiftId" = $1`,
    shiftRows[0].id
  );
  assert.deepEqual(breakRows, [{ status: "closed", durationSeconds: 1_800 }]);

  console.log("\n[p1-timekeeping] timesheet and append-only manager adjustment");
  const from = isoDate(new Date(clockInAt.getTime() - 24 * 60 * 60 * 1_000));
  const to = isoDate(new Date(clockOutAt.getTime() + 24 * 60 * 60 * 1_000));
  const timesheet = await api<any>(
    `/api/timekeeping?from=${from}&to=${to}&employeeId=${encodeURIComponent(employee.id)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(timesheet.response, 200, "Timesheet lookup");
  assert.equal(timesheet.data.shifts.length, 1);
  assert.equal(timesheet.data.shifts[0].paidHours, 8.5);
  assert.equal(timesheet.data.shifts[0].laborCost, 170);

  const adjustmentKey = `p1-time-adjustment-${crypto.randomUUID()}`;
  const adjustment = await api<any>("/api/timekeeping", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "Idempotency-Key": adjustmentKey,
    },
    body: JSON.stringify({
      shiftId: shiftRows[0].id,
      paidMinutesDelta: 30,
      reasonCode: "missed_work",
      reason: "Manager confirmed thirty paid minutes were omitted",
    }),
  });
  assertStatus(adjustment.response, 201, "Create time adjustment");
  assert.equal(adjustment.data.adjustment.paidSecondsDelta, 1_800);
  assert.equal(adjustment.data.adjustment.laborCostDelta, 10);

  const adjustmentReplay = await api<any>("/api/timekeeping", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "Idempotency-Key": adjustmentKey,
    },
    body: JSON.stringify({
      shiftId: shiftRows[0].id,
      paidMinutesDelta: 30,
      reasonCode: "missed_work",
      reason: "Manager confirmed thirty paid minutes were omitted",
    }),
  });
  assertStatus(adjustmentReplay.response, 200, "Adjustment replay");
  assert.equal(adjustmentReplay.data.replayed, true);

  const adjustmentConflict = await api<any>("/api/timekeeping", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "Idempotency-Key": adjustmentKey,
    },
    body: JSON.stringify({
      shiftId: shiftRows[0].id,
      paidMinutesDelta: 45,
      reasonCode: "missed_work",
      reason: "A different adjustment payload must be rejected",
    }),
  });
  assertStatus(adjustmentConflict.response, 409, "Adjustment payload conflict");
  assert.equal(
    adjustmentConflict.data.code,
    "TIME_ADJUSTMENT_IDEMPOTENCY_CONFLICT"
  );

  const corrected = await api<any>(
    `/api/timekeeping?from=${from}&to=${to}&employeeId=${encodeURIComponent(employee.id)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(corrected.response, 200, "Corrected timesheet lookup");
  assert.equal(corrected.data.shifts[0].paidHours, 9);
  assert.equal(corrected.data.shifts[0].laborCost, 180);
  assert.equal(corrected.data.shifts[0].adjustmentCount, 1);

  const roundingEmployee = await createEmployee(
    adminCookie,
    `P1 Raw Summary ${suffix}`,
    60
  );
  const firstShortStart = new Date(Date.now() - 10 * 60_000);
  const firstShortEnd = new Date(firstShortStart.getTime() + 61_000);
  const secondShortStart = new Date(firstShortEnd.getTime() + 60_000);
  const secondShortEnd = new Date(secondShortStart.getTime() + 61_000);
  assertStatus(
    (await managerClock(adminCookie, roundingEmployee.id, "clock_in", firstShortStart)).response,
    201,
    "First short shift clock in"
  );
  assertStatus(
    (await managerClock(adminCookie, roundingEmployee.id, "clock_out", firstShortEnd)).response,
    201,
    "First short shift clock out"
  );
  assertStatus(
    (await managerClock(adminCookie, roundingEmployee.id, "clock_in", secondShortStart)).response,
    201,
    "Second short shift clock in"
  );
  assertStatus(
    (await managerClock(adminCookie, roundingEmployee.id, "clock_out", secondShortEnd)).response,
    201,
    "Second short shift clock out"
  );
  const rawSummary = await api<any>(
    `/api/timekeeping?from=${from}&to=${to}&employeeId=${encodeURIComponent(roundingEmployee.id)}`,
    { headers: { cookie: adminCookie } }
  );
  assertStatus(rawSummary.response, 200, "Raw-second timesheet summary");
  assert.equal(rawSummary.data.shifts.length, 2);
  assert.deepEqual(
    rawSummary.data.shifts.map((shift: any) => shift.paidHours),
    [0.02, 0.02]
  );
  assert.equal(rawSummary.data.summary.paidHours, 0.03);
  assert.equal(rawSummary.data.summary.laborCost, 2.04);

  const excessiveNegative = await api<any>("/api/timekeeping", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "Idempotency-Key": `p1-time-negative-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      shiftId: shiftRows[0].id,
      paidMinutesDelta: -600,
      reasonCode: "invalid_negative",
      reason: "This must be rejected because it exceeds paid time",
    }),
  });
  assertStatus(excessiveNegative.response, 409, "Negative effective duration rejection");
  assert.equal(excessiveNegative.data.code, "NEGATIVE_EFFECTIVE_SHIFT");

  console.log("\n[p1-timekeeping] kiosk flow and concurrent open-shift boundary");
  const kioskEmployee = await createEmployee(
    adminCookie,
    `P1 Kiosk Employee ${suffix}`,
    15
  );
  const kioskIn = await api<any>("/api/employees/clock", {
    method: "POST",
    headers: { "Idempotency-Key": `p1-kiosk-in-${crypto.randomUUID()}` },
    body: JSON.stringify({ pin: kioskEmployee.pin, action: "in" }),
  });
  assertStatus(kioskIn.response, 201, "Kiosk clock in");
  const kioskOut = await api<any>("/api/employees/clock", {
    method: "POST",
    headers: { "Idempotency-Key": `p1-kiosk-out-${crypto.randomUUID()}` },
    body: JSON.stringify({ pin: kioskEmployee.pin, action: "out" }),
  });
  assertStatus(kioskOut.response, 201, "Kiosk clock out");

  const raceEmployee = await createEmployee(
    adminCookie,
    `P1 Clock Race ${suffix}`,
    12
  );
  const raceTime = new Date(Date.now() - 60_000);
  const race = await Promise.all([
    managerClock(adminCookie, raceEmployee.id, "clock_in", raceTime),
    managerClock(adminCookie, raceEmployee.id, "clock_in", raceTime),
  ]);
  assert.deepEqual(
    race.map((entry) => entry.response.status).sort(),
    [201, 409]
  );
  const raceOut = await managerClock(
    adminCookie,
    raceEmployee.id,
    "clock_out",
    new Date()
  );
  assertStatus(raceOut.response, 201, "Close concurrency-test shift");

  console.log("\n[p1-timekeeping] immutability, lifecycle blocks, and audits");
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `UPDATE "Employee" SET "clockedIn" = true WHERE "id" = $1`,
        employee.id
      ),
    "Direct employee clock-cache edits must fail"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `UPDATE "EmployeeTimeEvent" SET "reason" = 'tampered' WHERE "employeeId" = $1`,
        employee.id
      ),
    "Time events must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `UPDATE "EmployeeShift" SET "paidSeconds" = 1 WHERE "id" = $1`,
        shiftRows[0].id
      ),
    "Closed shifts must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `DELETE FROM "EmployeeBreak" WHERE "shiftId" = $1`,
        shiftRows[0].id
      ),
    "Break history must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        `DELETE FROM "EmployeeTimeAdjustment" WHERE "shiftId" = $1`,
        shiftRows[0].id
      ),
    "Time adjustments must be immutable"
  );

  const deactivateWithOpenShift = await api<any>(
    `/api/employees/${encodeURIComponent(raceEmployee.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ isActive: false }),
    }
  );
  assertStatus(deactivateWithOpenShift.response, 200, "Deactivate after shift closure");

  const deleteWithHistory = await api<any>(
    `/api/employees/${encodeURIComponent(employee.id)}`,
    { method: "DELETE", headers: { cookie: adminCookie } }
  );
  assertStatus(deleteWithHistory.response, 409, "Delete employee with time history");
  assert.equal(deleteWithHistory.data.code, "EMPLOYEE_HAS_TIME_HISTORY");

  const auditCounts = await db.auditEvent.groupBy({
    by: ["action"],
    where: {
      action: {
        in: [
          "employee.time.clock_in",
          "employee.time.clock_out",
          "employee.time.break_start",
          "employee.time.break_end",
          "employee.time.adjust",
        ],
      },
    },
    _count: { _all: true },
  });
  const actions = new Set(auditCounts.map((entry) => entry.action));
  for (const action of [
    "employee.time.clock_in",
    "employee.time.clock_out",
    "employee.time.break_start",
    "employee.time.break_end",
    "employee.time.adjust",
  ]) {
    assert.ok(actions.has(action), `Missing audit action ${action}`);
  }

  console.log("\n[p1-timekeeping] Immutable timekeeping assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-timekeeping] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
