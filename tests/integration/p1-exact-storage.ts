import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type MenuExactRow = {
  price: number;
  price_minor: bigint;
};

type MultiplierExactRow = {
  multiplier: number;
  multiplier_micros: bigint;
};

async function main() {
  const [menuItem, pricingRule, giftCard] = await Promise.all([
    db.menuItem.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, price: true },
    }),
    db.dynamicPricing.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, multiplier: true },
    }),
    db.giftCard.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, amount: true, balance: true },
    }),
  ]);

  assert.ok(menuItem, "Seed data must contain a menu item");
  assert.ok(pricingRule, "Seed data must contain a dynamic pricing rule");
  assert.ok(giftCard, "Seed data must contain a gift card");

  try {
    await db.menuItem.update({
      where: { id: menuItem.id },
      data: { price: 12.345 },
    });

    const [menuExact] = await db.$queryRaw<MenuExactRow[]>`
      SELECT
        "price",
        "priceMinor" AS price_minor
      FROM "MenuItem"
      WHERE "id" = ${menuItem.id}
    `;
    assert.ok(menuExact, "Updated menu item was not found");
    assert.equal(
      menuExact.price_minor,
      BigInt(1235),
      "Legacy price writes must round half-up into the exact currency column"
    );

    await assert.rejects(
      db.$executeRaw`
        UPDATE "MenuItem"
        SET "priceMinor" = "priceMinor" + 1
        WHERE "id" = ${menuItem.id}
      `,
      "Direct divergence between legacy and exact menu prices must be rejected"
    );

    await assert.rejects(
      db.menuItem.update({
        where: { id: menuItem.id },
        data: { price: -0.01 },
      }),
      "Negative menu prices must be rejected by the database"
    );

    await db.dynamicPricing.update({
      where: { id: pricingRule.id },
      data: { multiplier: 1.2345675 },
    });
    const [multiplierExact] = await db.$queryRaw<MultiplierExactRow[]>`
      SELECT
        "multiplier",
        "multiplierMicros" AS multiplier_micros
      FROM "DynamicPricing"
      WHERE "id" = ${pricingRule.id}
    `;
    assert.ok(multiplierExact, "Updated dynamic-pricing rule was not found");
    assert.equal(
      multiplierExact.multiplier_micros,
      BigInt(1234568),
      "Pricing multipliers must retain six-decimal half-up precision"
    );

    await assert.rejects(
      db.giftCard.update({
        where: { id: giftCard.id },
        data: { balance: giftCard.amount + 0.01 },
      }),
      "Gift-card balance must not exceed its issued amount"
    );
  } finally {
    await Promise.all([
      db.menuItem.update({
        where: { id: menuItem.id },
        data: { price: menuItem.price },
      }),
      db.dynamicPricing.update({
        where: { id: pricingRule.id },
        data: { multiplier: pricingRule.multiplier },
      }),
      db.giftCard.update({
        where: { id: giftCard.id },
        data: { amount: giftCard.amount, balance: giftCard.balance },
      }),
    ]);
  }

  console.log(
    "[p1-exact-storage] Synchronization, precision, and constraint assertions passed."
  );
}

main()
  .catch((error) => {
    console.error("[p1-exact-storage] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
