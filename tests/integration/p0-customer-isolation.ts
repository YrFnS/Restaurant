import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.31";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-customer-${crypto.randomUUID()}`);

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

function futureServiceTime(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1_000);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

function uniquePhone(prefix: string): string {
  return `+964${prefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 7)}`;
}

async function createReservation(label: string, daysAhead: number) {
  const result = await request("/api/reservations", {
    method: "POST",
    body: JSON.stringify({
      customerName: `P0 Reservation ${label}`,
      customerPhone: uniquePhone("702"),
      customerEmail: null,
      partySize: 2,
      dateTime: futureServiceTime(daysAhead),
      occasion: null,
      preference: null,
      notes: `Isolation test ${label}`,
    }),
  });
  expectStatus(result, 201, `Create reservation ${label}`);
  assert.ok(result.data?.reservation?.id, "Reservation creation must return an ID");
  assert.ok(
    typeof result.data?.accessToken === "string" &&
      result.data.accessToken.length >= 20,
    "Reservation creation must return an opaque access token"
  );
  return result.data as any;
}

async function createWaitlistEntry(label: string) {
  const result = await request("/api/waitlist", {
    method: "POST",
    body: JSON.stringify({
      customerName: `P0 Waitlist ${label}`,
      customerPhone: uniquePhone("703"),
      partySize: 2,
      notes: `Isolation test ${label}`,
    }),
  });
  expectStatus(result, 201, `Create waitlist entry ${label}`);
  assert.ok(result.data?.entry?.id, "Waitlist creation must return an ID");
  assert.ok(
    typeof result.data?.accessToken === "string" &&
      result.data.accessToken.length >= 20,
    "Waitlist creation must return an opaque access token"
  );
  return result.data as any;
}

async function main() {
  console.log("[p0-customer] validating reservation token isolation");
  const reservationA = await createReservation("A", 10);
  const reservationB = await createReservation("B", 11);
  const missingReservationId = `missing-${crypto.randomUUID()}`;

  const anonymousReservationProbe = await request(
    `/api/reservations/${encodeURIComponent(missingReservationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
  expectStatus(
    anonymousReservationProbe,
    401,
    "Anonymous reservation probe must fail before validation or lookup"
  );

  const wrongTokenMissingReservation = await request(
    `/api/reservations/${encodeURIComponent(
      missingReservationId
    )}?token=${encodeURIComponent(reservationA.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(
    wrongTokenMissingReservation,
    401,
    "Wrong reservation token must not reveal whether a target exists"
  );

  const crossReservationCancel = await request(
    `/api/reservations/${encodeURIComponent(
      reservationB.reservation.id
    )}?token=${encodeURIComponent(reservationA.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(
    crossReservationCancel,
    401,
    "Reservation A token must not cancel reservation B"
  );

  const untouchedReservationB = await db.reservation.findUnique({
    where: { id: reservationB.reservation.id },
    select: { status: true },
  });
  assert.equal(
    untouchedReservationB?.status,
    "confirmed",
    "Cross-customer reservation access must not mutate the target"
  );

  const validReservationCancel = await request(
    `/api/reservations/${encodeURIComponent(
      reservationA.reservation.id
    )}?token=${encodeURIComponent(reservationA.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(validReservationCancel, 200, "Customer cancels owned reservation");
  assert.equal(validReservationCancel.data?.reservation?.status, "cancelled");

  const cancelReservationB = await request(
    `/api/reservations/${encodeURIComponent(
      reservationB.reservation.id
    )}?token=${encodeURIComponent(reservationB.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(cancelReservationB, 200, "Clean up reservation B");

  console.log("[p0-customer] validating waitlist token and resource isolation");
  const waitlistA = await createWaitlistEntry("A");
  const waitlistB = await createWaitlistEntry("B");
  const missingWaitlistId = `missing-${crypto.randomUUID()}`;

  const anonymousWaitlistProbe = await request(
    `/api/waitlist/${encodeURIComponent(missingWaitlistId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    }
  );
  expectStatus(
    anonymousWaitlistProbe,
    401,
    "Anonymous waitlist probe must fail before validation or lookup"
  );

  const wrongTokenMissingWaitlist = await request(
    `/api/waitlist/${encodeURIComponent(
      missingWaitlistId
    )}?token=${encodeURIComponent(waitlistA.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(
    wrongTokenMissingWaitlist,
    401,
    "Wrong waitlist token must not reveal whether a target exists"
  );

  const crossWaitlistRead = await request(
    `/api/waitlist?id=${encodeURIComponent(
      waitlistB.entry.id
    )}&token=${encodeURIComponent(waitlistA.accessToken)}`
  );
  expectStatus(
    crossWaitlistRead,
    404,
    "Waitlist A token must not read waitlist B"
  );
  assert.equal(crossWaitlistRead.data?.entry, null);

  const crossResourceRead = await request(
    `/api/waitlist?id=${encodeURIComponent(
      waitlistA.entry.id
    )}&token=${encodeURIComponent(reservationA.accessToken)}`
  );
  expectStatus(
    crossResourceRead,
    404,
    "Reservation token must not authorize a waitlist resource"
  );

  const crossWaitlistCancel = await request(
    `/api/waitlist/${encodeURIComponent(
      waitlistB.entry.id
    )}?token=${encodeURIComponent(waitlistA.accessToken)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    }
  );
  expectStatus(
    crossWaitlistCancel,
    401,
    "Waitlist A token must not cancel waitlist B"
  );

  const untouchedWaitlistB = await db.waitlistEntry.findUnique({
    where: { id: waitlistB.entry.id },
    select: { status: true },
  });
  assert.ok(
    untouchedWaitlistB && ["waiting", "notified"].includes(untouchedWaitlistB.status),
    "Cross-customer waitlist access must not mutate the target"
  );

  const ownedWaitlistRead = await request(
    `/api/waitlist?id=${encodeURIComponent(
      waitlistB.entry.id
    )}&token=${encodeURIComponent(waitlistB.accessToken)}`
  );
  expectStatus(ownedWaitlistRead, 200, "Customer reads owned waitlist entry");
  assert.equal(ownedWaitlistRead.data?.entry?.id, waitlistB.entry.id);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      ownedWaitlistRead.data?.entry || {},
      "customerPhone"
    ),
    false,
    "Public waitlist status must not expose the customer phone"
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(ownedWaitlistRead.data?.entry || {}, "notes"),
    false,
    "Public waitlist status must not expose internal/customer notes"
  );

  for (const waitlist of [waitlistA, waitlistB]) {
    const cancel = await request(
      `/api/waitlist/${encodeURIComponent(
        waitlist.entry.id
      )}?token=${encodeURIComponent(waitlist.accessToken)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      }
    );
    expectStatus(cancel, 200, `Clean up owned waitlist entry ${waitlist.entry.id}`);
  }

  console.log(
    "[p0-customer] Reservation and waitlist isolation/no-oracle assertions passed."
  );
}

main()
  .catch((error) => {
    console.error("[p0-customer] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
