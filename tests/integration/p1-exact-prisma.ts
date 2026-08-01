import assert from "node:assert/strict";
import { db } from "../../src/lib/db";

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function main() {
  const defaultMenuItem = await db.menuItem.findFirst({
    orderBy: { createdAt: "asc" },
  });
  assert.ok(defaultMenuItem, "Seed data must contain a menu item");
  assert.equal(
    hasOwn(defaultMenuItem, "priceMinor"),
    false,
    "Shared Prisma results must omit exact BigInt fields by default"
  );
  assert.doesNotThrow(
    () => JSON.stringify(defaultMenuItem),
    "Default menu-item results must remain JSON serializable"
  );

  const explicitMenuPrice = await db.menuItem.findUnique({
    where: { id: defaultMenuItem.id },
    select: { id: true, price: true, priceMinor: true },
  });
  assert.ok(explicitMenuPrice);
  assert.equal(typeof explicitMenuPrice.priceMinor, "bigint");
  assert.equal(
    explicitMenuPrice.priceMinor,
    BigInt(Math.round(explicitMenuPrice.price * 100)),
    "Explicit exact menu price must match its compatibility value"
  );

  const defaultOrder = await db.order.findFirst({
    where: { orderNumber: { startsWith: "#R-" } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  assert.ok(defaultOrder, "P0 integration must create a public order");
  for (const field of [
    "subtotalMinor",
    "taxAmountMinor",
    "deliveryFeeMinor",
    "discountAmountMinor",
    "tipAmountMinor",
    "totalMinor",
  ]) {
    assert.equal(
      hasOwn(defaultOrder, field),
      false,
      `Default order result must omit ${field}`
    );
  }
  assert.ok(
    defaultOrder.items.every(
      (item) =>
        !hasOwn(item, "unitPriceMinor") &&
        !hasOwn(item, "totalPriceMinor")
    ),
    "Default order-item results must omit exact BigInt fields"
  );
  assert.doesNotThrow(
    () => JSON.stringify(defaultOrder),
    "Default order graphs must remain JSON serializable"
  );

  const exactOrder = await db.order.findUnique({
    where: { id: defaultOrder.id },
    select: {
      id: true,
      subtotal: true,
      subtotalMinor: true,
      taxAmount: true,
      taxAmountMinor: true,
      deliveryFee: true,
      deliveryFeeMinor: true,
      discountAmount: true,
      discountAmountMinor: true,
      tipAmount: true,
      tipAmountMinor: true,
      total: true,
      totalMinor: true,
      items: {
        select: {
          id: true,
          unitPrice: true,
          unitPriceMinor: true,
          totalPrice: true,
          totalPriceMinor: true,
        },
      },
    },
  });
  assert.ok(exactOrder);

  const exactPairs: Array<[number, bigint, string]> = [
    [exactOrder.subtotal, exactOrder.subtotalMinor, "subtotal"],
    [exactOrder.taxAmount, exactOrder.taxAmountMinor, "tax amount"],
    [exactOrder.deliveryFee, exactOrder.deliveryFeeMinor, "delivery fee"],
    [exactOrder.discountAmount, exactOrder.discountAmountMinor, "discount"],
    [exactOrder.tipAmount, exactOrder.tipAmountMinor, "tip"],
    [exactOrder.total, exactOrder.totalMinor, "total"],
  ];
  for (const [compatibilityValue, exactValue, label] of exactPairs) {
    assert.equal(
      exactValue,
      BigInt(Math.round(compatibilityValue * 100)),
      `Exact order ${label} must match its compatibility value`
    );
  }

  for (const item of exactOrder.items) {
    assert.equal(
      item.unitPriceMinor,
      BigInt(Math.round(item.unitPrice * 100)),
      "Exact unit price must match its compatibility value"
    );
    assert.equal(
      item.totalPriceMinor,
      BigInt(Math.round(item.totalPrice * 100)),
      "Exact line total must match its compatibility value"
    );
  }

  const defaultCashEntry = await db.cashDrawerEntry.findFirst({
    where: { type: "sale" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(defaultCashEntry, "P0 checkout must create a cash sale");
  assert.equal(hasOwn(defaultCashEntry, "amountMinor"), false);
  assert.doesNotThrow(() => JSON.stringify(defaultCashEntry));

  const exactCashEntry = await db.cashDrawerEntry.findUnique({
    where: { id: defaultCashEntry.id },
    select: { amount: true, amountMinor: true },
  });
  assert.ok(exactCashEntry);
  assert.equal(
    exactCashEntry.amountMinor,
    BigInt(Math.round(exactCashEntry.amount * 100)),
    "Exact cash amount must match its compatibility value"
  );

  console.log(
    "[p1-exact-prisma] First-class exact fields and JSON-safe defaults passed."
  );
}

main()
  .catch((error) => {
    console.error("[p1-exact-prisma] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
