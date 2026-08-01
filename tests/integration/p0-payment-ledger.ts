import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const captures = await db.paymentEvent.findMany({
    where: {
      eventType: "capture",
      method: "cash",
      status: "succeeded",
    },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paymentMethod: true,
          paymentStatus: true,
        },
      },
    },
  });

  assert.ok(captures.length >= 1, "Cash checkout must create a payment event");
  assert.equal(
    new Set(captures.map((event) => event.idempotencyKey)).size,
    captures.length,
    "Every payment event must have a unique idempotency key"
  );

  const latest = captures[0];
  assert.equal(latest.order.paymentStatus, "paid");
  assert.equal(latest.order.paymentMethod, "cash");
  assert.equal(latest.amountCents, Math.round(latest.order.total * 100));
  assert.ok(latest.tenderedCents !== null);
  assert.ok(latest.changeCents !== null);
  assert.ok((latest.tenderedCents || 0) >= latest.amountCents);
  assert.equal(
    latest.changeCents,
    (latest.tenderedCents || 0) - latest.amountCents
  );

  const duplicateCaptureCount = await db.paymentEvent.count({
    where: {
      orderId: latest.orderId,
      eventType: "capture",
      status: "succeeded",
    },
  });
  assert.equal(
    duplicateCaptureCount,
    1,
    "Checkout replay must not create a second successful capture"
  );

  const saleEntries = await db.cashDrawerEntry.findMany({
    where: {
      type: "sale",
      note: { contains: latest.order.orderNumber },
    },
  });
  assert.equal(
    saleEntries.length,
    1,
    "A successful cash capture must have exactly one matching drawer sale"
  );

  const auditCount = await db.auditEvent.count({
    where: {
      action: "order.payment.capture",
      entityType: "PaymentEvent",
      entityId: latest.id,
    },
  });
  assert.equal(
    auditCount,
    1,
    "A successful capture must have one immutable audit event"
  );

  console.log("[p0-payment-ledger] Ledger and replay assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p0-payment-ledger] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
