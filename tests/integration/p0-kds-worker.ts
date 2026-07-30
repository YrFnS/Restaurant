import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const secret = process.env.KDS_OUTBOX_SECRET;

async function readJson(response: Response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error(
      `Expected JSON from ${response.url}, received ${response.status}: ${raw.slice(0, 500)}`
    );
  }
}

async function main() {
  assert.ok(secret && secret.length >= 32, "KDS_OUTBOX_SECRET must be configured");

  const event = await db.kdsOutboxEvent.create({
    data: {
      eventType: "screen:update",
      screenSlugs: ["integration-screen"],
      payload: {
        testRun: `p0-kds-worker-${crypto.randomUUID()}`,
      },
      nextAttemptAt: new Date(),
    },
  });

  const unauthorized = await fetch(
    `${BASE_URL}/api/internal/kds-outbox?limit=25`,
    {
      headers: {
        "x-forwarded-for": "198.51.100.28",
        "x-request-id": `p0-kds-unauthorized-${crypto.randomUUID()}`,
      },
    }
  );
  assert.equal(unauthorized.status, 401, "Outbox worker must reject missing secret");
  const unauthorizedBody = await readJson(unauthorized);
  assert.equal(unauthorizedBody?.code, "AUTH_REQUIRED");

  const authorized = await fetch(`${BASE_URL}/api/internal/kds-outbox?limit=25`, {
    headers: {
      authorization: `Bearer ${secret}`,
      "x-forwarded-for": "198.51.100.28",
      "x-request-id": `p0-kds-authorized-${crypto.randomUUID()}`,
    },
  });
  assert.equal(authorized.status, 200, "Authorized outbox worker call must succeed");
  const workerBody = await readJson(authorized);
  assert.ok(workerBody?.processed >= 1, "Worker must process at least one event");
  assert.ok(workerBody?.delivered >= 1, "Worker must deliver at least one event");

  const delivered = await db.kdsOutboxEvent.findUnique({
    where: { id: event.id },
  });
  assert.ok(delivered?.deliveredAt, "Worker must mark the event as delivered");
  assert.equal(delivered?.lastError, null, "Delivered event must clear its error");

  console.log("[p0-kds-worker] Authentication and delivery assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p0-kds-worker] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
