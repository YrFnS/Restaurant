import assert from "node:assert/strict";
import {
  PrismaClient,
  ReservationSource,
  ReservationStatus,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.79";
const WORKER_SECRET =
  process.env.WAITLIST_WORKER_SECRET ||
  process.env.CRON_SECRET ||
  process.env.KDS_OUTBOX_SECRET ||
  "integration-kds-outbox-secret-0123456789abcdef0123456789abcdef";

type Json = Record<string, any> | null;

function uniquePhone(prefix: string): string {
  return `+964${prefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 7)}`;
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: T }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-waitlist-${crypto.randomUUID()}`);
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
  let data: any = null;
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

function assertStatus(
  result: { response: Response; data: any },
  expected: number,
  label: string
) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected ${expected}, received ${result.response.status} (${JSON.stringify(
      result.data
    )})`
  );
}

async function loginAdmin(): Promise<string> {
  const result = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "1234" }),
  });
  assertStatus(result, 200, "Admin login");
  const cookie = result.response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Admin login must return the persisted session cookie");
  return cookie;
}

async function join(
  payload: {
    customerName: string;
    customerPhone: string;
    partySize: number;
    preference?: string;
    notes?: string;
  },
  key = `p1-waitlist-join-${crypto.randomUUID()}`
) {
  return api<any>("/api/waitlist", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({
      ...payload,
      preference: payload.preference || "any",
      notes: payload.notes || null,
    }),
  });
}

async function staffAction(
  cookie: string,
  id: string,
  action: "notify" | "confirm" | "seat" | "cancel" | "no_show"
) {
  return api<any>(`/api/waitlist/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { cookie },
    body: JSON.stringify({
      action,
      ...(action === "cancel" || action === "no_show"
        ? { reason: `P1 integration ${action}` }
        : {}),
    }),
  });
}

async function customerAction(
  id: string,
  token: string,
  action: "confirm" | "cancel"
) {
  return api<any>(
    `/api/waitlist/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }
  );
}

async function createTable(
  number: number,
  capacity: number,
  status: TableStatus,
  seatedAt: Date | null = null
) {
  return db.restaurantTable.create({
    data: {
      number,
      capacity,
      section: `p1-waitlist-${number}`,
      status,
      shape: "square",
      x: 0,
      y: 0,
      width: 80,
      height: 80,
      seatedAt,
    },
  });
}

async function main() {
  const startedAt = new Date(Date.now() - 1_000);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  const tableBase = 900_000 + Number.parseInt(suffix.slice(0, 4), 16) % 50_000;
  const adminCookie = await loginAdmin();

  console.log("\n[p1-waitlist] resetting the disposable queue and service policy");
  await db.waitlistEntry.deleteMany();
  await db.reservation.deleteMany({
    where: { notes: { startsWith: "P1 waitlist integration" } },
  });
  await db.restaurantTable.deleteMany({
    where: { number: { gte: 900_000 } },
  });
  await db.reservationClosure.deleteMany();
  await db.reservationServicePeriod.deleteMany();
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
    await db.reservationServicePeriod.create({
      data: {
        dayOfWeek,
        opensAtMinute: 0,
        closesAtMinute: 1439,
        label: "P1 waitlist all-day integration service",
        isActive: true,
      },
    });
  }
  await db.restaurantSettings.update({
    where: { id: "1" },
    data: {
      timezone: "UTC",
      reservationMinPartySize: 1,
      reservationMaxPartySize: 50,
      waitlistEnabled: true,
    },
  });

  const anonymousPolicy = await api("/api/waitlist/settings");
  assertStatus(anonymousPolicy, 401, "Anonymous waitlist policy read");

  const policy = await api<any>("/api/waitlist/settings", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      enabled: true,
      averageTurnoverMinutes: 30,
      notificationExpiryMinutes: 1,
      estimatePaddingMinutes: 0,
      maxQuoteMinutes: 180,
      requireConfirmation: true,
    }),
  });
  assertStatus(policy, 200, "Update waitlist policy");
  assert.equal(policy.data.policy.averageTurnoverMinutes, 30);
  assert.equal(policy.data.policy.notificationExpiryMinutes, 1);
  assert.equal(policy.data.policy.estimatePaddingMinutes, 0);
  assert.equal(policy.data.policy.maxQuoteMinutes, 180);
  assert.equal(policy.data.policy.requireConfirmation, true);

  console.log("\n[p1-waitlist] capacity estimates include occupancy and reservations");
  const now = new Date();
  const tableA = await createTable(
    tableBase + 1,
    20,
    TableStatus.seated,
    addMinutes(now, -10)
  );
  const tableB = await createTable(tableBase + 2, 20, TableStatus.open);
  const reservationStarts = addMinutes(now, 5);
  const reservationEnds = addMinutes(now, 80);
  const reservationRelease = addMinutes(now, 90);
  await db.reservation.create({
    data: {
      customerName: `P1 Waitlist Reservation ${suffix}`,
      customerPhone: uniquePhone("760"),
      partySize: 20,
      tableId: tableB.id,
      dateTime: reservationStarts,
      durationMinutes: 75,
      turnoverMinutes: 10,
      endsAt: reservationEnds,
      releaseAt: reservationRelease,
      status: ReservationStatus.confirmed,
      source: ReservationSource.staff,
      notes: `P1 waitlist integration ${suffix}`,
    },
  });

  const aggregateBefore = await api<any>("/api/waitlist");
  assertStatus(aggregateBefore, 200, "Public aggregate waitlist state");
  assert.equal(aggregateBefore.data.entry, null);
  assert.equal(aggregateBefore.data.waitingCount, 0);
  assert.equal(
    JSON.stringify(aggregateBefore.data).includes("customerPhone"),
    false
  );
  assert.equal(JSON.stringify(aggregateBefore.data).includes("tableId"), false);

  const phoneA = uniquePhone("761");
  const keyA = `p1-waitlist-a-${crypto.randomUUID()}`;
  const first = await join(
    {
      customerName: `P1 Waitlist A ${suffix}`,
      customerPhone: phoneA,
      partySize: 20,
      preference: "indoor",
      notes: "First compatible capacity quote",
    },
    keyA
  );
  assertStatus(first, 201, "Join first capacity queue");
  assert.ok(first.data.accessToken);
  assert.ok(
    first.data.entry.estimatedWait >= 18 && first.data.entry.estimatedWait <= 22,
    `Expected occupied-table quote near 20 minutes, received ${first.data.entry.estimatedWait}`
  );

  const replay = await join(
    {
      customerName: `P1 Waitlist A ${suffix}`,
      customerPhone: phoneA,
      partySize: 20,
      preference: "indoor",
      notes: "First compatible capacity quote",
    },
    keyA
  );
  assertStatus(replay, 200, "Join idempotency replay");
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.entry.id, first.data.entry.id);
  assert.equal(replay.data.accessToken, first.data.accessToken);

  const changedReplay = await join(
    {
      customerName: `P1 Waitlist A ${suffix}`,
      customerPhone: phoneA,
      partySize: 20,
      preference: "private",
      notes: "Changed payload must conflict",
    },
    keyA
  );
  assertStatus(changedReplay, 409, "Changed idempotency payload");
  assert.equal(changedReplay.data.code, "WAITLIST_IDEMPOTENCY_CONFLICT");

  const duplicatePhone = await join({
    customerName: `P1 Duplicate ${suffix}`,
    customerPhone: phoneA,
    partySize: 20,
  });
  assertStatus(duplicatePhone, 409, "Duplicate active phone");
  assert.equal(duplicatePhone.data.code, "DUPLICATE_WAITLIST_ENTRY");

  const second = await join({
    customerName: `P1 Waitlist B ${suffix}`,
    customerPhone: uniquePhone("762"),
    partySize: 20,
    notes: "Second compatible capacity quote",
  });
  assertStatus(second, 201, "Join second capacity queue");
  assert.ok(
    second.data.entry.estimatedWait >= 47 &&
      second.data.entry.estimatedWait <= 53,
    `Expected simulated second quote near 50 minutes, received ${second.data.entry.estimatedWait}`
  );

  const aggregateAfter = await api<any>("/api/waitlist");
  assertStatus(aggregateAfter, 200, "Aggregate after joins");
  assert.equal(aggregateAfter.data.waitingCount, 2);
  assert.equal(JSON.stringify(aggregateAfter.data).includes(phoneA), false);

  console.log("\n[p1-waitlist] notification respects queue priority and table readiness");
  await db.restaurantTable.update({
    where: { id: tableA.id },
    data: { status: TableStatus.open, seatedAt: null },
  });

  const outOfOrder = await staffAction(
    adminCookie,
    second.data.entry.id,
    "notify"
  );
  assertStatus(outOfOrder, 409, "Out-of-order notification");
  assert.equal(outOfOrder.data.code, "WAITLIST_PRIORITY_CONFLICT");

  const notified = await staffAction(
    adminCookie,
    first.data.entry.id,
    "notify"
  );
  assertStatus(notified, 200, "Notify first compatible party");
  assert.equal(notified.data.entry.status, "notified");
  assert.equal(notified.data.entry.table.number, tableA.number);
  assert.ok(notified.data.entry.notificationExpiresAt);
  assert.equal(
    (await db.restaurantTable.findUnique({ where: { id: tableA.id } }))?.status,
    TableStatus.reserved
  );

  const seatWithoutConfirmation = await staffAction(
    adminCookie,
    first.data.entry.id,
    "seat"
  );
  assertStatus(seatWithoutConfirmation, 409, "Seat before confirmation");
  assert.equal(
    seatWithoutConfirmation.data.code,
    "WAITLIST_CONFIRMATION_REQUIRED"
  );

  const wrongToken = await customerAction(
    first.data.entry.id,
    second.data.accessToken,
    "confirm"
  );
  assertStatus(wrongToken, 401, "Cross-entry confirmation token");

  const confirmation = await customerAction(
    first.data.entry.id,
    first.data.accessToken,
    "confirm"
  );
  assertStatus(confirmation, 200, "Customer confirms arrival");
  assert.ok(confirmation.data.entry.notificationConfirmedAt);
  assert.equal(confirmation.data.replayed, false);

  const confirmationReplay = await customerAction(
    first.data.entry.id,
    first.data.accessToken,
    "confirm"
  );
  assertStatus(confirmationReplay, 200, "Confirmation replay");
  assert.equal(confirmationReplay.data.replayed, true);

  const seated = await staffAction(adminCookie, first.data.entry.id, "seat");
  assertStatus(seated, 200, "Seat confirmed party");
  assert.equal(seated.data.entry.status, "seated");
  const seatedTable = await db.restaurantTable.findUnique({
    where: { id: tableA.id },
  });
  assert.equal(seatedTable?.status, TableStatus.seated);
  assert.ok(seatedTable?.seatedAt);

  const ownedTerminalRead = await api<any>(
    `/api/waitlist?id=${encodeURIComponent(
      first.data.entry.id
    )}&token=${encodeURIComponent(first.data.accessToken)}`
  );
  assertStatus(ownedTerminalRead, 200, "Read owned seated entry");
  assert.equal(ownedTerminalRead.data.entry.status, "seated");
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      ownedTerminalRead.data.entry,
      "customerPhone"
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(ownedTerminalRead.data.entry, "notes"),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(ownedTerminalRead.data.entry, "tableId"),
    false
  );

  const cancelSecond = await customerAction(
    second.data.entry.id,
    second.data.accessToken,
    "cancel"
  );
  assertStatus(cancelSecond, 200, "Customer cancels waiting entry");
  assert.equal(cancelSecond.data.entry.status, "cancelled");

  console.log("\n[p1-waitlist] cancellation and expiry release table holds");
  const tableC = await createTable(tableBase + 3, 25, TableStatus.open);
  const cancellationEntry = await join({
    customerName: `P1 Waitlist Cancel ${suffix}`,
    customerPhone: uniquePhone("763"),
    partySize: 25,
  });
  assertStatus(cancellationEntry, 201, "Join cancellation hold entry");
  const cancellationNotify = await staffAction(
    adminCookie,
    cancellationEntry.data.entry.id,
    "notify"
  );
  assertStatus(cancellationNotify, 200, "Notify cancellation hold entry");
  assert.equal(cancellationNotify.data.entry.table.number, tableC.number);
  const customerCancel = await customerAction(
    cancellationEntry.data.entry.id,
    cancellationEntry.data.accessToken,
    "cancel"
  );
  assertStatus(customerCancel, 200, "Customer cancels notified hold");
  assert.equal(customerCancel.data.entry.status, "cancelled");
  assert.equal(
    (await db.restaurantTable.findUnique({ where: { id: tableC.id } }))?.status,
    TableStatus.open
  );

  const tableD = await createTable(tableBase + 4, 30, TableStatus.open);
  const expiryEntry = await join({
    customerName: `P1 Waitlist Expiry ${suffix}`,
    customerPhone: uniquePhone("764"),
    partySize: 30,
  });
  assertStatus(expiryEntry, 201, "Join expiry entry");
  const expiryNotify = await staffAction(
    adminCookie,
    expiryEntry.data.entry.id,
    "notify"
  );
  assertStatus(expiryNotify, 200, "Notify expiry entry");
  assert.equal(expiryNotify.data.entry.table.number, tableD.number);

  await db.waitlistEntry.update({
    where: { id: expiryEntry.data.entry.id },
    data: {
    notifiedAt: addMinutes(new Date(), -2),
    notificationExpiresAt: addMinutes(new Date(), -1),
  },
  });
  const unauthorizedWorker = await api("/api/internal/waitlist", {
    method: "POST",
    headers: { authorization: "Bearer wrong-secret" },
  });
  assertStatus(unauthorizedWorker, 401, "Unauthorized waitlist worker");

  const worker = await api<any>("/api/internal/waitlist", {
    method: "POST",
    headers: { authorization: `Bearer ${WORKER_SECRET}` },
  });
  assertStatus(worker, 200, "Authenticated waitlist worker");
  assert.ok(worker.data.expired >= 1);
  const expired = await db.waitlistEntry.findUnique({
    where: { id: expiryEntry.data.entry.id },
  });
  assert.equal(expired?.status, WaitlistStatus.no_show);
  assert.ok(expired?.noShowAt);
  assert.equal(
    (await db.restaurantTable.findUnique({ where: { id: tableD.id } }))?.status,
    TableStatus.open
  );

  console.log("\n[p1-waitlist] concurrent notifications create one table hold");
  const tableE = await createTable(tableBase + 5, 35, TableStatus.open);
  const raceA = await join({
    customerName: `P1 Waitlist Race A ${suffix}`,
    customerPhone: uniquePhone("765"),
    partySize: 35,
  });
  const raceB = await join({
    customerName: `P1 Waitlist Race B ${suffix}`,
    customerPhone: uniquePhone("766"),
    partySize: 35,
  });
  assertStatus(raceA, 201, "Join race A");
  assertStatus(raceB, 201, "Join race B");

  const race = await Promise.all([
    staffAction(adminCookie, raceA.data.entry.id, "notify"),
    staffAction(adminCookie, raceB.data.entry.id, "notify"),
  ]);
  assert.deepEqual(
    race.map((result) => result.response.status).sort(),
    [200, 409]
  );
  const raceRows = await db.waitlistEntry.findMany({
    where: { id: { in: [raceA.data.entry.id, raceB.data.entry.id] } },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(
    raceRows.filter((entry) => entry.status === WaitlistStatus.notified).length,
    1
  );
  assert.equal(
    raceRows.filter((entry) => entry.status === WaitlistStatus.waiting).length,
    1
  );
  assert.equal(
    (await db.restaurantTable.findUnique({ where: { id: tableE.id } }))?.status,
    TableStatus.reserved
  );

  const held = raceRows.find((entry) => entry.status === WaitlistStatus.notified);
  assert.ok(held);
  const deleteHeldTable = await api<any>(
    `/api/tables/${encodeURIComponent(tableE.id)}`,
    { method: "DELETE", headers: { cookie: adminCookie } }
  );
  assertStatus(deleteHeldTable, 409, "Delete held table");
  assert.equal(deleteHeldTable.data.code, "TABLE_IN_USE");

  const reduceCapacity = await api<any>(
    `/api/tables/${encodeURIComponent(tableE.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ capacity: 10 }),
    }
  );
  assertStatus(reduceCapacity, 409, "Reduce held table capacity");
  assert.equal(
    reduceCapacity.data.code,
    "TABLE_CAPACITY_BELOW_WAITLIST_PARTY"
  );

  const releaseStatus = await api<any>(
    `/api/tables/${encodeURIComponent(tableE.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "open" }),
    }
  );
  assertStatus(releaseStatus, 409, "Bypass active waitlist hold");
  assert.equal(releaseStatus.data.code, "TABLE_HAS_WAITLIST_HOLD");

  await assert.rejects(
    db.waitlistEntry.create({
      data: {
        idempotencyKey: `p1-waitlist-direct-hold-${crypto.randomUUID()}`,
        customerName: `P1 Direct Hold ${suffix}`,
        customerPhone: uniquePhone("767"),
        partySize: 35,
        status: WaitlistStatus.notified,
        estimatedWait: 0,
        source: ReservationSource.staff,
        tableId: tableE.id,
        estimatedSeatAt: new Date(),
        estimateCalculatedAt: new Date(),
        notifiedAt: new Date(),
        notificationExpiresAt: addMinutes(new Date(), 1),
      },
    }),
    "PostgreSQL must prevent two active notification holds on one table"
  );

  console.log("\n[p1-waitlist] audit and privacy evidence is durable");
  const auditActions = await db.auditEvent.findMany({
    where: {
      action: {
        in: [
          "waitlist.join",
          "waitlist.notify",
          "waitlist.notification.confirm",
          "waitlist.seat",
          "waitlist.cancel",
          "waitlist.notification.expire",
          "waitlist.policy.update",
        ],
      },
      createdAt: { gte: startedAt },
    },
    select: { action: true },
  });
  const actionSet = new Set(auditActions.map((event) => event.action));
  for (const action of [
    "waitlist.join",
    "waitlist.notify",
    "waitlist.notification.confirm",
    "waitlist.seat",
    "waitlist.cancel",
    "waitlist.notification.expire",
    "waitlist.policy.update",
  ]) {
    assert.ok(actionSet.has(action), `Missing waitlist audit action ${action}`);
  }

  const adminQueue = await api<any>(
    "/api/waitlist?admin=true&scope=recent&limit=300",
    { headers: { cookie: adminCookie } }
  );
  assertStatus(adminQueue, 200, "Staff queue history");
  assert.ok(
    adminQueue.data.entries.some(
      (entry: any) => entry.customerPhone === phoneA
    ),
    "Authorized staff history should include operational customer details"
  );

  console.log("\n[p1-waitlist] All waitlist lifecycle assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p1-waitlist] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
