import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.38";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-cancel-${crypto.randomUUID()}`);

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

async function createOrder(itemId: string, label: string) {
  const result = await request("/api/orders", {
    method: "POST",
    headers: { "idempotency-key": `p0-cancel-order-${crypto.randomUUID()}` },
    body: JSON.stringify({
      type: "takeout",
      customerName: `P0 Cancel ${label}`,
      customerPhone: "",
      notes: `Cancellation isolation ${label}`,
      tip: { mode: "none" },
      items: [
        {
          menuItemId: itemId,
          quantity: 1,
          modifierOptionIds: [],
          notes: null,
          course: 1,
        },
      ],
    }),
  });
  expectStatus(result, 201, `Create cancellable order ${label}`);
  assert.ok(result.data?.order?.id, "Order creation must return an ID");
  assert.ok(result.data?.order?.orderNumber, "Order creation must return a reference");
  assert.ok(
    typeof result.data?.accessToken === "string" &&
      result.data.accessToken.length >= 20,
    "Order creation must return an opaque access token"
  );
  return result.data as any;
}

function cancelPath(orderNumber: string, token?: string) {
  const normalized = orderNumber.replace(/^#/, "");
  return `/api/orders/track/${encodeURIComponent(normalized)}/cancel${
    token ? `?token=${encodeURIComponent(token)}` : ""
  }`;
}

async function main() {
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
  assert.ok(item, "Seed data must contain a cancellable item without required modifiers");

  const startedAt = new Date(Date.now() - 1_000);
  const orderA = await createOrder(item.id, "A");
  const orderB = await createOrder(item.id, "B");

  console.log("[p0-cancel] validating missing and cross-order token rejection");
  const missingToken = await request(
    cancelPath(orderA.order.orderNumber),
    { method: "POST", body: JSON.stringify({}) }
  );
  expectStatus(missingToken, 404, "Cancellation without access token");
  assert.equal(missingToken.data?.order, null);

  const crossToken = await request(
    cancelPath(orderB.order.orderNumber, orderA.accessToken),
    { method: "POST", body: JSON.stringify({}) }
  );
  expectStatus(crossToken, 404, "Order A token must not cancel order B");
  assert.equal(crossToken.data?.order, null);

  const orderBAfterCrossAttempt = await db.order.findUnique({
    where: { id: orderB.order.id },
    select: { status: true },
  });
  assert.equal(
    orderBAfterCrossAttempt?.status,
    "confirmed",
    "Cross-order token attempt must not mutate the target"
  );

  console.log("[p0-cancel] cancelling the owned order through the transactional path");
  const cancelled = await request(
    cancelPath(orderA.order.orderNumber, orderA.accessToken),
    { method: "POST", body: JSON.stringify({}) }
  );
  expectStatus(cancelled, 200, "Customer cancels owned order");
  assert.equal(cancelled.data?.order?.id, orderA.order.id);
  assert.equal(cancelled.data?.order?.status, "cancelled");
  assert.equal(cancelled.response.headers.get("ratelimit-limit"), "30");

  const [storedOrder, itemStates, auditEvents, outboxEvents] = await Promise.all([
    db.order.findUnique({
      where: { id: orderA.order.id },
      select: { status: true },
    }),
    db.orderItem.findMany({
      where: { orderId: orderA.order.id },
      select: { status: true, hold: true },
    }),
    db.auditEvent.findMany({
      where: {
        action: "order.customer.cancel",
        entityType: "Order",
        entityId: orderA.order.id,
      },
    }),
    db.kdsOutboxEvent.findMany({
      where: {
        eventType: "order:status",
        payload: {
          path: ["orderId"],
          equals: orderA.order.id,
        },
      },
    }),
  ]);

  assert.equal(storedOrder?.status, "cancelled");
  assert.ok(itemStates.length > 0, "Cancelled order must retain its line items");
  assert.ok(
    itemStates.every((line) => line.status === "cancelled" && line.hold === false),
    "Customer cancellation must cancel every unserved line and clear holds"
  );
  assert.equal(auditEvents.length, 1, "Cancellation must write one immutable audit event");
  assert.equal(auditEvents[0]?.actorId, null, "Customer cancellation has no staff actor");
  assert.equal(
    (auditEvents[0]?.metadata as any)?.previousStatus,
    "confirmed"
  );
  assert.equal(outboxEvents.length, 1, "Cancellation must enqueue one durable KDS event");

  console.log("[p0-cancel] validating retry safety after cancellation closes");
  const replay = await request(
    cancelPath(orderA.order.orderNumber, orderA.accessToken),
    { method: "POST", body: JSON.stringify({}) }
  );
  expectStatus(replay, 409, "Repeated customer cancellation");
  assert.equal(replay.data?.code, "ORDER_CANCELLATION_CLOSED");

  const [auditCountAfterReplay, outboxCountAfterReplay] = await Promise.all([
    db.auditEvent.count({
      where: {
        action: "order.customer.cancel",
        entityType: "Order",
        entityId: orderA.order.id,
      },
    }),
    db.kdsOutboxEvent.count({
      where: {
        eventType: "order:status",
        payload: {
          path: ["orderId"],
          equals: orderA.order.id,
        },
      },
    }),
  ]);
  assert.equal(auditCountAfterReplay, 1, "Retry must not duplicate the audit event");
  assert.equal(outboxCountAfterReplay, 1, "Retry must not duplicate the KDS event");

  const cancelB = await request(
    cancelPath(orderB.order.orderNumber, orderB.accessToken),
    { method: "POST", body: JSON.stringify({}) }
  );
  expectStatus(cancelB, 200, "Clean up order B with its own token");

  const sharedCounter = await db.rateLimitCounter.findFirst({
    where: {
      scope: "order-cancel",
      createdAt: { gte: startedAt },
    },
  });
  assert.ok(sharedCounter, "Customer cancellation must use the shared rate limiter");
  assert.equal(
    sharedCounter.key.includes(SOURCE_IP),
    false,
    "Cancellation counter must not store the raw source address"
  );

  console.log("[p0-cancel] Customer cancellation assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p0-cancel] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
