import assert from "node:assert/strict";
import { PrismaClient, ReservationSource } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SOURCE_IP = "198.51.100.219";

type ApiResult<T> = { response: Response; data: T };

async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-reservation-${crypto.randomUUID()}`);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("origin", BASE_URL);
    headers.set("sec-fetch-site", "same-origin");
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers, redirect: "manual" });
  const raw = await response.text();
  let data: T;
  try {
    data = (raw ? JSON.parse(raw) : null) as T;
  } catch {
    throw new Error(`${method} ${path} returned non-JSON ${response.status}: ${raw.slice(0, 400)}`);
  }
  return { response, data };
}

function status(result: ApiResult<any>, expected: number, label: string) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected ${expected}, received ${result.response.status} (${JSON.stringify(result.data)})`
  );
}

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  assert.ok(value, "Login must set a session cookie");
  return value.split(";", 1)[0];
}

async function login(): Promise<string> {
  const result = await api<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "1234" }),
  });
  status(result, 200, "Administrative login");
  return cookieFrom(result.response);
}

function dateKey(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

function localPlus(date: string, time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCMinutes(hours * 60 + mins + minutes);
  return instant.toISOString().slice(0, 16);
}

async function availability(date: string, partySize: number) {
  const params = new URLSearchParams({ date, partySize: String(partySize) });
  return api<any>(`/api/reservations/availability?${params}`);
}

async function book(input: {
  date: string;
  time: string;
  partySize: number;
  phone: string;
  name?: string;
  key?: string;
}) {
  return api<any>("/api/reservations", {
    method: "POST",
    headers: { "Idempotency-Key": input.key || `p1-res-${crypto.randomUUID()}` },
    body: JSON.stringify({
      customerName: input.name || `Reservation ${input.phone}`,
      customerPhone: input.phone,
      customerEmail: null,
      partySize: input.partySize,
      date: input.date,
      time: input.time,
      occasion: null,
      preference: null,
      notes: null,
    }),
  });
}

async function main() {
  const adminCookie = await login();

  console.log("\n[p1-reservations] authorization and policy setup");
  const anonymousSettings = await api<any>("/api/reservation-settings");
  status(anonymousSettings, 401, "Anonymous reservation settings");
  const settings = await api<any>("/api/reservation-settings", {
    headers: { cookie: adminCookie },
  });
  status(settings, 200, "Reservation settings read");
  assert.equal(settings.data.policy.timezone, "UTC");
  assert.equal(settings.data.periods.length, 7);

  const policyUpdate = await api<any>("/api/reservation-settings", {
    method: "PUT",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      minNoticeMinutes: 0,
      maxAdvanceDays: 60,
      defaultDurationMinutes: 60,
      turnoverMinutes: 15,
      slotIntervalMinutes: 30,
      minPartySize: 1,
      maxPartySize: 10,
      customerCancelCutoffMinutes: 120,
    }),
  });
  status(policyUpdate, 200, "Reservation policy update");

  console.log("\n[p1-reservations] safe public slots and closure subtraction");
  const slotDate = dateKey(10);
  const firstAvailability = await availability(slotDate, 2);
  status(firstAvailability, 200, "Public availability");
  assert.ok(firstAvailability.data.slots.length > 0, "Future date must expose slots");
  assert.equal(firstAvailability.data.timezone, "UTC");
  assert.equal(JSON.stringify(firstAvailability.data).includes("customerPhone"), false);
  assert.equal(JSON.stringify(firstAvailability.data).includes("tableId"), false);
  const firstSlot = firstAvailability.data.slots[0];

  const closure = await api<any>("/api/reservation-settings", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      type: "closure",
      localStart: `${slotDate}T${firstSlot.time}`,
      localEnd: localPlus(slotDate, firstSlot.time, 90),
      reason: "Integration closure",
    }),
  });
  status(closure, 201, "Create partial closure");
  const closedAvailability = await availability(slotDate, 2);
  status(closedAvailability, 200, "Availability after closure");
  assert.equal(
    closedAvailability.data.slots.some((slot: any) => slot.time === firstSlot.time),
    false,
    "Closure must remove overlapping slots"
  );
  status(
    await api<any>(
      `/api/reservation-settings?${new URLSearchParams({ type: "closure", id: closure.data.closure.id })}`,
      { method: "DELETE", headers: { cookie: adminCookie } }
    ),
    200,
    "Delete partial closure"
  );

  console.log("\n[p1-reservations] overnight weekly service");
  const overnightDate = dateKey(12);
  const overnightDay = new Date(`${overnightDate}T00:00:00.000Z`).getUTCDay();
  const currentSettings = await api<any>("/api/reservation-settings", {
    headers: { cookie: adminCookie },
  });
  const existingDayPeriods = currentSettings.data.periods.filter(
    (period: any) => period.dayOfWeek === overnightDay
  );
  for (const period of existingDayPeriods) {
    status(
      await api<any>(
        `/api/reservation-settings?${new URLSearchParams({ type: "period", id: period.id })}`,
        { method: "DELETE", headers: { cookie: adminCookie } }
      ),
      200,
      "Delete regular period for overnight test"
    );
  }
  const overnightPeriod = await api<any>("/api/reservation-settings", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      type: "period",
      dayOfWeek: overnightDay,
      opensAt: "22:00",
      closesAt: "02:00",
      label: "Overnight integration service",
      isActive: true,
    }),
  });
  status(overnightPeriod, 201, "Create overnight service period");
  const overnightAvailability = await availability(overnightDate, 2);
  status(overnightAvailability, 200, "Overnight start-date availability");
  assert.ok(
    overnightAvailability.data.slots.some((slot: any) => slot.time === "22:00"),
    "Overnight service must expose its evening start"
  );
  const nextDate = new Date(`${overnightDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const continuation = await availability(nextDate.toISOString().slice(0, 10), 2);
  status(continuation, 200, "Overnight continuation availability");
  assert.ok(
    continuation.data.slots.some((slot: any) => slot.time === "00:00"),
    "Previous-day overnight service must continue after midnight"
  );
  status(
    await api<any>(
      `/api/reservation-settings?${new URLSearchParams({ type: "period", id: overnightPeriod.data.period.id })}`,
      { method: "DELETE", headers: { cookie: adminCookie } }
    ),
    200,
    "Delete overnight period"
  );
  status(
    await api<any>("/api/reservation-settings", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        type: "period",
        dayOfWeek: overnightDay,
        opensAt: "10:00",
        closesAt: "23:00",
        label: "Restored regular service",
        isActive: true,
      }),
    }),
    201,
    "Restore regular period"
  );

  console.log("\n[p1-reservations] concurrency and database overlap boundary");
  const raceDate = dateKey(20);
  const raceAvailability = await availability(raceDate, 10);
  status(raceAvailability, 200, "Single-table capacity lookup");
  assert.ok(raceAvailability.data.slots.length > 0);
  const raceTime = raceAvailability.data.slots[0].time;
  const race = await Promise.all([
    book({ date: raceDate, time: raceTime, partySize: 10, phone: "+96475081" + Math.floor(Math.random() * 1000000) }),
    book({ date: raceDate, time: raceTime, partySize: 10, phone: "+96475082" + Math.floor(Math.random() * 1000000) }),
  ]);
  assert.deepEqual(
    race.map((entry) => entry.response.status).sort(),
    [201, 409],
    "Only one booking may win the single compatible table"
  );
  const raceWinner = race.find((entry) => entry.response.status === 201)!;
  const winner = await db.reservation.findUniqueOrThrow({
    where: { id: raceWinner.data.reservation.id },
  });
  let exclusionFailed = false;
  try {
    await db.reservation.create({
      data: {
        idempotencyKey: `p1-direct-overlap-${crypto.randomUUID()}`,
        customerName: "Direct overlap",
        customerPhone: `+96475083${Math.floor(Math.random() * 1000000)}`,
        partySize: 10,
        tableId: winner.tableId,
        dateTime: winner.dateTime,
        durationMinutes: winner.durationMinutes,
        turnoverMinutes: winner.turnoverMinutes,
        endsAt: winner.endsAt,
        releaseAt: winner.releaseAt,
        source: ReservationSource.import,
        status: "confirmed",
      },
    });
  } catch {
    exclusionFailed = true;
  }
  assert.equal(exclusionFailed, true, "PostgreSQL must reject a direct overlapping insert");

  console.log("\n[p1-reservations] reassignment conflict and idempotent replay");
  const reassignDate = dateKey(25);
  const reassignAvailability = await availability(reassignDate, 8);
  status(reassignAvailability, 200, "Reassignment slot lookup");
  const reassignTime = reassignAvailability.data.slots[0].time;
  const firstKey = `p1-reassign-first-${crypto.randomUUID()}`;
  const firstPhone = `+96475084${Math.floor(Math.random() * 1000000)}`;
  const first = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    key: firstKey,
  });
  status(first, 201, "First reassignment reservation");
  const replay = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    name: first.data.reservation.customerName,
    key: firstKey,
  });
  status(replay, 200, "Reservation idempotent replay");
  assert.equal(replay.data.replayed, true);
  const replayConflict = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    name: "Changed reservation payload",
    key: firstKey,
  });
  status(replayConflict, 409, "Changed-payload idempotency conflict");
  assert.equal(
    replayConflict.data.code,
    "RESERVATION_IDEMPOTENCY_CONFLICT"
  );
  const second = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: `+96475085${Math.floor(Math.random() * 1000000)}`,
  });
  status(second, 201, "Second reassignment reservation");
  const reassign = await api<any>(
    `/api/reservations/${encodeURIComponent(first.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ tableId: second.data.reservation.table.id }),
    }
  );
  status(reassign, 409, "Conflicting table reassignment");
  assert.equal(reassign.data.code, "RESERVATION_TABLE_CONFLICT");

  console.log("\n[p1-reservations] customer cutoff and audited lifecycle");
  const cutoffPolicy = await api<any>("/api/reservation-settings", {
    method: "PUT",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      minNoticeMinutes: 0,
      maxAdvanceDays: 60,
      defaultDurationMinutes: 60,
      turnoverMinutes: 15,
      slotIntervalMinutes: 30,
      minPartySize: 1,
      maxPartySize: 10,
      customerCancelCutoffMinutes: 10_080,
    }),
  });
  status(cutoffPolicy, 200, "Set customer cancellation cutoff");
  const lifecycleDate = dateKey(3);
  const lifecycleAvailability = await availability(lifecycleDate, 2);
  const lifecycleTime = lifecycleAvailability.data.slots[0].time;
  const lifecycle = await book({
    date: lifecycleDate,
    time: lifecycleTime,
    partySize: 2,
    phone: `+96475086${Math.floor(Math.random() * 1000000)}`,
  });
  status(lifecycle, 201, "Lifecycle reservation creation");
  const customerCancel = await api<any>(
    `/api/reservations/${encodeURIComponent(lifecycle.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${lifecycle.data.accessToken}` },
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  status(customerCancel, 409, "Customer cancellation cutoff");
  assert.equal(customerCancel.data.code, "CUSTOMER_CANCELLATION_CUTOFF");

  const seated = await api<any>(
    `/api/reservations/${encodeURIComponent(lifecycle.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "seated" }),
    }
  );
  status(seated, 200, "Seat reservation");
  const completed = await api<any>(
    `/api/reservations/${encodeURIComponent(lifecycle.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "completed" }),
    }
  );
  status(completed, 200, "Complete reservation");
  const table = await db.restaurantTable.findUniqueOrThrow({
    where: { id: lifecycle.data.reservation.table.id },
  });
  assert.equal(table.status, "cleaning");

  const auditActions = await db.auditEvent.findMany({
    where: {
      action: {
        in: [
          "reservation.policy.update",
          "reservation.closure.create",
          "reservation.service_period.create",
          "reservation.customer.create",
          "reservation.status.update",
        ],
      },
    },
    select: { action: true },
  });
  const actions = new Set(auditActions.map((entry) => entry.action));
  for (const expected of [
    "reservation.policy.update",
    "reservation.closure.create",
    "reservation.service_period.create",
    "reservation.customer.create",
    "reservation.status.update",
  ]) {
    assert.ok(actions.has(expected), `Missing reservation audit action ${expected}`);
  }

  console.log("\n[p1-reservations] Reservation availability assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-reservations] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
