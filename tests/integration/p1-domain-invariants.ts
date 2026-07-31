import assert from "node:assert/strict";
import {
  PaymentEventStatus,
  PaymentEventType,
  PaymentMethod,
  PrismaClient,
} from "@prisma/client";

const db = new PrismaClient();

const expectedConstraints = [
  "RestaurantSettings_operational_bounds",
  "MenuItem_operational_bounds",
  "ModifierGroup_selection_bounds",
  "Customer_loyalty_bounds",
  "Order_discount_bounds",
  "OrderItem_operational_bounds",
  "RestaurantTable_geometry_bounds",
  "Reservation_party_size_bounds",
  "WaitlistEntry_operational_bounds",
  "RewardTier_points_bounds",
  "Feedback_rating_bounds",
  "Testimonial_stars_bounds",
  "Schedule_day_bounds",
  "Ingredient_stock_bounds",
  "WasteLog_quantity_bounds",
  "KitchenStation_prep_bounds",
  "KitchenScreen_operational_bounds",
  "RateLimitCounter_count_bounds",
  "KdsOutboxEvent_attempt_bounds",
  "PaymentEvent_financial_consistency",
] as const;

const expectedIndexes = [
  "WaitlistEntry_one_active_phone_idx",
  "PaymentEvent_one_succeeded_capture_per_order_idx",
  "Reservation_active_datetime_idx",
  "Order_active_createdAt_idx",
] as const;

async function assertCatalog() {
  const constraints = await db.$queryRaw<Array<{ name: string }>>`
    SELECT conname AS name
    FROM pg_constraint
    WHERE conname = ANY(${[...expectedConstraints]}::text[])
  `;
  const constraintNames = new Set(constraints.map((row) => row.name));
  for (const name of expectedConstraints) {
    assert.ok(constraintNames.has(name), `Missing database constraint ${name}`);
  }

  const indexes = await db.$queryRaw<Array<{ name: string }>>`
    SELECT indexname AS name
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY(${[...expectedIndexes]}::text[])
  `;
  const indexNames = new Set(indexes.map((row) => row.name));
  for (const name of expectedIndexes) {
    assert.ok(indexNames.has(name), `Missing database index ${name}`);
  }
}

async function assertInvalidWritesFail() {
  const [group, table, ingredient, feedback, order, orderItem] =
    await Promise.all([
      db.modifierGroup.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, maxSelect: true },
      }),
      db.restaurantTable.findFirst({
        orderBy: { number: "asc" },
        select: { id: true },
      }),
      db.ingredient.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      db.feedback.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      db.order.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, subtotal: true },
      }),
      db.orderItem.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    ]);

  assert.ok(group && table && ingredient && feedback && order && orderItem);

  await assert.rejects(
    db.modifierGroup.update({
      where: { id: group.id },
      data: { minSelect: group.maxSelect + 1 },
    }),
    "Modifier minimum selections must not exceed the maximum"
  );

  await assert.rejects(
    db.restaurantTable.update({
      where: { id: table.id },
      data: { capacity: 0 },
    }),
    "Restaurant tables must have positive capacity"
  );

  await assert.rejects(
    db.ingredient.update({
      where: { id: ingredient.id },
      data: { quantity: -1 },
    }),
    "Ingredient stock must not become negative through generic writes"
  );

  await assert.rejects(
    db.feedback.update({
      where: { id: feedback.id },
      data: { rating: 6 },
    }),
    "Feedback ratings must remain within the reviewed scale"
  );

  await assert.rejects(
    db.order.update({
      where: { id: order.id },
      data: { discountAmount: order.subtotal + 0.01 },
    }),
    "Order discounts must not exceed the subtotal"
  );

  await assert.rejects(
    db.orderItem.update({
      where: { id: orderItem.id },
      data: { quantity: 0 },
    }),
    "Order-item quantity must stay positive"
  );
}

async function assertConcurrencyIndexes() {
  const activeWaitlist = await db.waitlistEntry.findFirst({
    where: { status: { in: ["waiting", "notified"] } },
    orderBy: { createdAt: "asc" },
    select: { customerPhone: true, customerName: true, partySize: true },
  });
  assert.ok(activeWaitlist, "Seed data must contain an active waitlist entry");

  await assert.rejects(
    db.waitlistEntry.create({
      data: {
        customerName: `${activeWaitlist.customerName} duplicate`,
        customerPhone: activeWaitlist.customerPhone,
        partySize: activeWaitlist.partySize,
        status: "waiting",
      },
    }),
    "Concurrent active waitlist entries must be unique per phone"
  );

  const capture = await db.paymentEvent.findFirst({
    where: {
      eventType: PaymentEventType.capture,
      status: PaymentEventStatus.succeeded,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(capture, "P0 checkout tests must create a successful capture");

  await assert.rejects(
    db.paymentEvent.create({
      data: {
        idempotencyKey: `p1-duplicate-capture-${crypto.randomUUID()}`,
        orderId: capture.orderId,
        eventType: PaymentEventType.capture,
        method: capture.method,
        status: PaymentEventStatus.succeeded,
        amountCents: capture.amountCents,
        tenderedCents: capture.tenderedCents,
        changeCents: capture.changeCents,
        currency: capture.currency,
        actorName: "P1 invariant test",
      },
    }),
    "An order must not receive two successful capture events"
  );

  const uncapturedOrder = await db.order.findFirst({
    where: {
      paymentEvents: { none: {} },
      total: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, total: true },
  });
  assert.ok(uncapturedOrder, "Seed data must contain an uncaptured order");
  const amountCents = Math.round(uncapturedOrder.total * 100);

  await assert.rejects(
    db.paymentEvent.create({
      data: {
        idempotencyKey: `p1-invalid-cash-${crypto.randomUUID()}`,
        orderId: uncapturedOrder.id,
        eventType: PaymentEventType.capture,
        method: PaymentMethod.cash,
        status: PaymentEventStatus.succeeded,
        amountCents,
        tenderedCents: amountCents,
        changeCents: 1,
        currency: "USD",
        actorName: "P1 invariant test",
      },
    }),
    "Cash change must equal tendered cash minus the captured amount"
  );
}

async function main() {
  await assertCatalog();
  await assertInvalidWritesFail();
  await assertConcurrencyIndexes();
  console.log("[p1-domain-invariants] Constraint and index assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p1-domain-invariants] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
