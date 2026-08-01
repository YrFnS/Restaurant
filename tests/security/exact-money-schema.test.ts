import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
const dbClient = readFileSync(resolve("src/lib/db.ts"), "utf8");
const migration = readFileSync(
  resolve(
    "prisma/migrations/20260731235900_expand_exact_money_storage/migration.sql"
  ),
  "utf8"
);
const registerMigration = readFileSync(
  resolve(
    "prisma/migrations/20260731235920_add_cash_register_sessions/migration.sql"
  ),
  "utf8"
);

const exactFields = [
  ["RestaurantSettings", "restaurantSettings", "taxRateMicros", "BigInt"],
  ["RestaurantSettings", "restaurantSettings", "deliveryFeeMinor", "BigInt"],
  [
    "RestaurantSettings",
    "restaurantSettings",
    "minDeliveryOrderMinor",
    "BigInt",
  ],
  ["MenuItem", "menuItem", "priceMinor", "BigInt"],
  ["ModifierOption", "modifierOption", "priceMinor", "BigInt"],
  ["Customer", "customer", "totalSpentMinor", "BigInt"],
  ["Order", "order", "subtotalMinor", "BigInt"],
  ["Order", "order", "taxAmountMinor", "BigInt"],
  ["Order", "order", "deliveryFeeMinor", "BigInt"],
  ["Order", "order", "discountAmountMinor", "BigInt"],
  ["Order", "order", "tipAmountMinor", "BigInt"],
  ["Order", "order", "totalMinor", "BigInt"],
  ["OrderItem", "orderItem", "unitPriceMinor", "BigInt"],
  ["OrderItem", "orderItem", "totalPriceMinor", "BigInt"],
  ["SpecialOffer", "specialOffer", "discountBasisPoints", "Int"],
  ["PromoCode", "promoCode", "discountBasisPoints", "Int"],
  ["GiftCard", "giftCard", "amountMinor", "BigInt"],
  ["GiftCard", "giftCard", "balanceMinor", "BigInt"],
  ["Employee", "employee", "hourlyWageMinor", "BigInt"],
  ["Ingredient", "ingredient", "costPerUnitMicros", "BigInt"],
  ["PurchaseOrder", "purchaseOrder", "totalCostMinor", "BigInt"],
  ["CashDrawerEntry", "cashDrawerEntry", "amountMinor", "BigInt"],
  ["DynamicPricing", "dynamicPricing", "multiplierMicros", "BigInt"],
  ["ComboMeal", "comboMeal", "priceMinor", "BigInt"],
] as const;

const registerExactFields = [
  [
    "CashRegister",
    "cashRegister",
    "discrepancyApprovalThresholdMinor",
    "BigInt",
  ],
  [
    "CashRegisterSession",
    "cashRegisterSession",
    "openingFloatMinor",
    "BigInt",
  ],
  ["CashRegisterClose", "cashRegisterClose", "expectedCashMinor", "BigInt"],
  ["CashRegisterClose", "cashRegisterClose", "countedCashMinor", "BigInt"],
  ["CashRegisterClose", "cashRegisterClose", "discrepancyMinor", "BigInt"],
  ["CashRegisterClose", "cashRegisterClose", "thresholdMinor", "BigInt"],
] as const;

function modelBlock(model: string): string {
  const match = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "m").exec(
    schema
  );
  if (!match) throw new Error(`Model ${model} not found`);
  return match[1];
}

function omitBlock(model: string): string {
  const match = new RegExp(
    `\\b${model}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`,
    "m"
  ).exec(dbClient);
  if (!match) throw new Error(`Global omit block ${model} not found`);
  return match[1];
}

describe("exact financial storage inventory", () => {
  test("exposes every compatibility-window exact field to Prisma Client", () => {
    for (const [model, , field, type] of exactFields) {
      expect(modelBlock(model)).toMatch(
        new RegExp(`\\b${field}\\s+${type}\\s+@default\\(0\\)(?!\\s+@ignore)`)
      );
    }
  });

  test("maps every register-session exact field in Prisma", () => {
    for (const [model, , field, type] of registerExactFields) {
      expect(modelBlock(model)).toMatch(
        new RegExp(`\\b${field}\\s+${type}\\b(?![^\\n]*@ignore)`)
      );
      expect(registerMigration).toContain(`"${field}" BIGINT`);
    }
  });

  test("globally omits exact fields from unreviewed shared-client results", () => {
    for (const [, prismaModel, field] of [
      ...exactFields,
      ...registerExactFields,
    ]) {
      expect(omitBlock(prismaModel)).toMatch(
        new RegExp(`\\b${field}:\\s*true\\b`)
      );
    }
    expect(dbClient).toContain("omit: exactFinancialFieldOmit");
  });

  test("adds and backfills every compatibility-window exact field", () => {
    for (const [, , field] of exactFields) {
      expect(migration).toContain(`ADD COLUMN "${field}"`);
      expect(migration).toContain(`"${field}" = ROUND`);
    }
  });

  test("keeps compatibility writes synchronized during application cutover", () => {
    for (const model of new Set(exactFields.map(([model]) => model))) {
      expect(migration).toContain(`CREATE FUNCTION "sync_${model}_exact_values"()`);
      expect(migration).toContain(`CREATE TRIGGER "${model}_exact_values_sync"`);
    }
  });

  test("retains legacy float fields until the contract migration", () => {
    expect(modelBlock("MenuItem")).toMatch(/\bprice\s+Float\b/);
    expect(modelBlock("Order")).toMatch(/\btotal\s+Float\b/);
    expect(modelBlock("CashDrawerEntry")).toMatch(/\bamount\s+Float\b/);
  });
});
