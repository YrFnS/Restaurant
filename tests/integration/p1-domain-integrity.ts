import assert from "node:assert/strict";
import {
  CashMovementType,
  DynamicPricingType,
  KdsLayoutType,
  KdsScreenType,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentEventStatus,
  PaymentEventType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
  StaffRole,
  TableShape,
  TableStatus,
  WaitlistStatus,
} from "@prisma/client";

const db = new PrismaClient();

type EnumRow = {
  enum_name: string;
  enum_label: string;
  enum_order: number;
};

const expectedEnums: Record<string, readonly string[]> = {
  OrderType: ["dine_in", "takeout", "delivery"],
  OrderStatus: [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ],
  OrderItemStatus: ["pending", "preparing", "ready", "served", "cancelled"],
  PaymentMethod: ["cash", "card", "split"],
  PaymentStatus: [
    "unpaid",
    "partially_paid",
    "paid",
    "partially_refunded",
    "refunded",
    "voided",
  ],
  StaffRole: [
    "owner",
    "admin",
    "manager",
    "cashier",
    "server",
    "cook",
    "bartender",
    "host",
    "inventory_manager",
    "analyst",
    "staff",
  ],
  TableStatus: [
    "open",
    "seated",
    "ordered",
    "served",
    "paid",
    "cleaning",
    "reserved",
  ],
  TableShape: ["square", "round"],
  ReservationStatus: [
    "confirmed",
    "seated",
    "completed",
    "cancelled",
    "no_show",
  ],
  WaitlistStatus: ["waiting", "notified", "seated", "cancelled", "no_show"],
  CashMovementType: [
    "payin",
    "payout",
    "drop",
    "sale",
    "refund",
    "adjustment",
    "opening_float",
    "closing_adjustment",
  ],
  KdsScreenType: ["prep", "expo", "all"],
  KdsLayoutType: ["grid", "compact"],
  DynamicPricingType: ["happy_hour", "lunch_special", "surge"],
  PaymentEventType: ["capture", "refund", "void", "adjustment"],
  PaymentEventStatus: ["pending", "succeeded", "failed", "voided"],
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function assertEnumCatalog() {
  const enumNames = Object.keys(expectedEnums);
  const rows = await db.$queryRaw<EnumRow[]>`
    SELECT
      type.typname AS enum_name,
      value.enumlabel AS enum_label,
      value.enumsortorder::float8 AS enum_order
    FROM pg_type AS type
    JOIN pg_enum AS value ON value.enumtypid = type.oid
    JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname = ANY(${enumNames}::text[])
    ORDER BY type.typname, value.enumsortorder
  `;

  const actual = new Map<string, string[]>();
  for (const row of rows) {
    const labels = actual.get(row.enum_name) || [];
    labels.push(row.enum_label);
    actual.set(row.enum_name, labels);
  }

  for (const [name, labels] of Object.entries(expectedEnums)) {
    assert.deepEqual(
      actual.get(name),
      labels,
      `PostgreSQL enum ${name} does not match the reviewed domain contract`
    );
  }
}

async function assertInvalidEnumValuesFail() {
  for (const enumName of Object.keys(expectedEnums)) {
    await assert.rejects(
      db.$executeRawUnsafe(`SELECT 'p1_invalid_value'::"${enumName}"`),
      `PostgreSQL enum ${enumName} accepted an unknown value`
    );
  }
}

async function assertGeneratedEnumRoundTrips() {
  assert.equal(OrderType.delivery, "delivery");
  assert.equal(OrderStatus.preparing, "preparing");
  assert.equal(OrderItemStatus.ready, "ready");
  assert.equal(PaymentMethod.cash, "cash");
  assert.equal(PaymentStatus.partially_refunded, "partially_refunded");
  assert.equal(StaffRole.inventory_manager, "inventory_manager");
  assert.equal(TableStatus.cleaning, "cleaning");
  assert.equal(TableShape.round, "round");
  assert.equal(ReservationStatus.no_show, "no_show");
  assert.equal(WaitlistStatus.notified, "notified");
  assert.equal(CashMovementType.opening_float, "opening_float");
  assert.equal(KdsScreenType.expo, "expo");
  assert.equal(KdsLayoutType.compact, "compact");
  assert.equal(DynamicPricingType.lunch_special, "lunch_special");
  assert.equal(PaymentEventType.refund, "refund");
  assert.equal(PaymentEventStatus.failed, "failed");
}

async function assertMutableTimestampsAdvance() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const ingredient = await db.ingredient.create({
    data: {
      name: `P1 Timestamp Ingredient ${suffix}`,
      unit: "kg",
      quantity: 1,
      lowThreshold: 0,
      costPerUnit: 1.25,
      category: "P1 integration",
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  const screen = await db.kitchenScreen.create({
    data: {
      name: `P1 Timestamp Screen ${suffix}`,
      slug: `p1-timestamp-${suffix}`,
      screenType: KdsScreenType.prep,
      layoutType: KdsLayoutType.grid,
      isActive: false,
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  try {
    await sleep(30);

    const [updatedIngredient, updatedScreen] = await Promise.all([
      db.ingredient.update({
        where: { id: ingredient.id },
        data: { quantity: { increment: 1 } },
        select: { createdAt: true, updatedAt: true },
      }),
      db.kitchenScreen.update({
        where: { id: screen.id },
        data: { layoutType: KdsLayoutType.compact },
        select: { createdAt: true, updatedAt: true, layoutType: true },
      }),
    ]);

    assert.equal(
      updatedIngredient.createdAt.getTime(),
      ingredient.createdAt.getTime(),
      "Ingredient createdAt must remain immutable"
    );
    assert.ok(
      updatedIngredient.updatedAt.getTime() > ingredient.updatedAt.getTime(),
      "Ingredient updatedAt must advance on mutation"
    );

    assert.equal(
      updatedScreen.createdAt.getTime(),
      screen.createdAt.getTime(),
      "KitchenScreen createdAt must remain immutable"
    );
    assert.ok(
      updatedScreen.updatedAt.getTime() > screen.updatedAt.getTime(),
      "KitchenScreen updatedAt must advance on mutation"
    );
    assert.equal(updatedScreen.layoutType, KdsLayoutType.compact);
  } finally {
    await db.kitchenScreen.deleteMany({ where: { id: screen.id } });
    await db.ingredient.deleteMany({ where: { id: ingredient.id } });
  }
}

async function main() {
  await assertEnumCatalog();
  await assertInvalidEnumValuesFail();
  await assertGeneratedEnumRoundTrips();
  await assertMutableTimestampsAdvance();
  console.log("[p1-domain-integrity] Enum and timestamp assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p1-domain-integrity] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
