import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.35";
const TRIGGER_NAME = "p0_force_kds_outbox_failure_trigger";
const FUNCTION_NAME = "p0_force_kds_outbox_failure";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-rollback-${crypto.randomUUID()}`);

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

async function removeFailureTrigger() {
  await db.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "${TRIGGER_NAME}" ON "KdsOutboxEvent"`
  );
  await db.$executeRawUnsafe(
    `DROP FUNCTION IF EXISTS "${FUNCTION_NAME}"()`
  );
}

async function installFailureTrigger() {
  await removeFailureTrigger();
  await db.$executeRawUnsafe(`
    CREATE FUNCTION "${FUNCTION_NAME}"()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'P0 forced KDS outbox failure';
    END;
    $$
  `);
  await db.$executeRawUnsafe(`
    CREATE TRIGGER "${TRIGGER_NAME}"
    BEFORE INSERT ON "KdsOutboxEvent"
    FOR EACH ROW
    EXECUTE FUNCTION "${FUNCTION_NAME}"()
  `);
}

async function main() {
  const table = await db.restaurantTable.findFirst({
    where: { status: "open" },
    orderBy: { number: "asc" },
    select: { id: true, number: true, status: true },
  });
  assert.ok(table, "Seed data must contain an open table");

  const menuItems = await db.menuItem.findMany({
    where: { isAvailable: true },
    include: { category: true, modifierGroups: true },
  });
  const item = menuItems.find(
    (candidate) =>
      candidate.category.isAvailable &&
      candidate.modifierGroups.every(
        (group) => Math.max(group.minSelect, group.isRequired ? 1 : 0) === 0
      )
  );
  assert.ok(item, "Seed data must contain an orderable item without required modifiers");

  const customerPhone = `+964705${String(Date.now()).slice(-7)}`;
  const idempotencyKey = `p0-rollback-order-${crypto.randomUUID()}`;
  const body = {
    type: "dine_in",
    tableNumber: table.number,
    customerName: "P0 Rollback Guest",
    customerPhone,
    notes: "Forced transaction rollback integration test",
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
  };

  const testStartedAt = new Date(Date.now() - 1_000);
  let successfulOrderId: string | null = null;

  try {
    console.log("[p0-rollback] forcing failure at the final transactional outbox write");
    await installFailureTrigger();

    const failed = await request("/api/orders", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    });
    expectStatus(failed, 500, "Forced order transaction failure");
    assert.equal(failed.data?.code, "ORDER_CREATE_FAILED");

    const [failedOrders, failedCustomer, tableAfterFailure, failedAudits, failedOutbox] =
      await Promise.all([
        db.order.count({ where: { customerPhone } }),
        db.customer.findUnique({ where: { phone: customerPhone } }),
        db.restaurantTable.findUnique({
          where: { id: table.id },
          select: { status: true },
        }),
        db.auditEvent.count({
          where: {
            action: "order.create",
            entityType: "Order",
            createdAt: { gte: testStartedAt },
          },
        }),
        db.kdsOutboxEvent.count({
          where: { createdAt: { gte: testStartedAt } },
        }),
      ]);

    assert.equal(failedOrders, 0, "Failed transaction must not persist the order");
    assert.equal(failedCustomer, null, "Failed transaction must not persist the customer");
    assert.equal(
      tableAfterFailure?.status,
      table.status,
      "Failed transaction must restore the original table state"
    );
    assert.equal(
      failedAudits,
      0,
      "Failed transaction must roll back its order audit event"
    );
    assert.equal(
      failedOutbox,
      0,
      "The rejected outbox insert must leave no partial event"
    );

    console.log("[p0-rollback] removing the fault and safely retrying the same idempotency key");
    await removeFailureTrigger();

    const retried = await request("/api/orders", {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    });
    expectStatus(retried, 201, "Retry after rolled-back transaction");
    assert.equal(retried.data?.replayed, false);
    successfulOrderId = String(retried.data?.order?.id || "");
    assert.ok(successfulOrderId, "Successful retry must return an order ID");

    const [persistedOrders, persistedCustomer, tableAfterRetry, auditCount, outboxCount] =
      await Promise.all([
        db.order.count({ where: { customerPhone } }),
        db.customer.findUnique({ where: { phone: customerPhone } }),
        db.restaurantTable.findUnique({
          where: { id: table.id },
          select: { status: true },
        }),
        db.auditEvent.count({
          where: {
            action: "order.create",
            entityType: "Order",
            entityId: successfulOrderId,
          },
        }),
        db.kdsOutboxEvent.count({
          where: {
            payload: {
              path: ["orderId"],
              equals: successfulOrderId,
            },
          },
        }),
      ]);

    assert.equal(persistedOrders, 1, "Safe retry must create exactly one order");
    assert.ok(persistedCustomer, "Safe retry must persist its customer");
    assert.equal(tableAfterRetry?.status, "ordered");
    assert.equal(auditCount, 1, "Successful retry must persist one audit event");
    assert.equal(outboxCount, 1, "Successful retry must persist one outbox event");

    console.log("[p0-rollback] Atomic rollback and retry assertions passed.");
  } finally {
    await removeFailureTrigger().catch(() => undefined);

    if (successfulOrderId) {
      const cleanupOrderId = successfulOrderId;
      await db.$transaction(async (tx) => {
        await tx.auditEvent.deleteMany({
          where: { entityType: "Order", entityId: cleanupOrderId },
        });
        await tx.order.deleteMany({ where: { id: cleanupOrderId } });
        await tx.customer.deleteMany({ where: { phone: customerPhone } });
        await tx.restaurantTable.update({
          where: { id: table.id },
          data: { status: table.status },
        });
      });
      await db.kdsOutboxEvent.deleteMany({
        where: {
          payload: {
            path: ["orderId"],
            equals: cleanupOrderId,
          },
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("[p0-rollback] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
