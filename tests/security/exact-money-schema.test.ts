import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(
    "prisma/migrations/20260731235900_expand_exact_money_storage/migration.sql"
  ),
  "utf8"
);

const exactFields = [
  ["RestaurantSettings", "taxRateMicros", "BigInt"],
  ["RestaurantSettings", "deliveryFeeMinor", "BigInt"],
  ["RestaurantSettings", "minDeliveryOrderMinor", "BigInt"],
  ["MenuItem", "priceMinor", "BigInt"],
  ["ModifierOption", "priceMinor", "BigInt"],
  ["Customer", "totalSpentMinor", "BigInt"],
  ["Order", "subtotalMinor", "BigInt"],
  ["Order", "taxAmountMinor", "BigInt"],
  ["Order", "deliveryFeeMinor", "BigInt"],
  ["Order", "discountAmountMinor", "BigInt"],
  ["Order", "tipAmountMinor", "BigInt"],
  ["Order", "totalMinor", "BigInt"],
  ["OrderItem", "unitPriceMinor", "BigInt"],
  ["OrderItem", "totalPriceMinor", "BigInt"],
  ["SpecialOffer", "discountBasisPoints", "Int"],
  ["PromoCode", "discountBasisPoints", "Int"],
  ["GiftCard", "amountMinor", "BigInt"],
  ["GiftCard", "balanceMinor", "BigInt"],
  ["Employee", "hourlyWageMinor", "BigInt"],
  ["Ingredient", "costPerUnitMicros", "BigInt"],
  ["PurchaseOrder", "totalCostMinor", "BigInt"],
  ["CashDrawerEntry", "amountMinor", "BigInt"],
  ["DynamicPricing", "multiplierMicros", "BigInt"],
  ["ComboMeal", "priceMinor", "BigInt"],
] as const;

function modelBlock(model: string): string {
  const match = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "m").exec(
    schema
  );
  if (!match) throw new Error(`Model ${model} not found`);
  return match[1];
}

describe("exact financial storage inventory", () => {
  test("documents every expand-phase field while excluding it from Prisma Client", () => {
    for (const [model, field, type] of exactFields) {
      expect(modelBlock(model)).toMatch(
        new RegExp(
          `\\b${field}\\s+${type}\\s+@default\\(0\\)\\s+@ignore\\b`
        )
      );
    }
  });

  test("adds and backfills every exact field in the committed migration", () => {
    for (const [, field] of exactFields) {
      expect(migration).toContain(`ADD COLUMN "${field}"`);
      expect(migration).toContain(`"${field}" = ROUND`);
    }
  });

  test("keeps legacy application writes synchronized during the expand phase", () => {
    for (const model of new Set(exactFields.map(([model]) => model))) {
      expect(migration).toContain(`CREATE FUNCTION "sync_${model}_exact_values"()`);
      expect(migration).toContain(`CREATE TRIGGER "${model}_exact_values_sync"`);
    }
  });

  test("retains legacy float fields until the application cutover is complete", () => {
    expect(modelBlock("MenuItem")).toMatch(/\bprice\s+Float\b/);
    expect(modelBlock("Order")).toMatch(/\btotal\s+Float\b/);
    expect(modelBlock("CashDrawerEntry")).toMatch(/\bamount\s+Float\b/);
  });
});
