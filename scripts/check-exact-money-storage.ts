import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type ExactStorageCheck = {
  name: string;
  sql: string;
};

const checks: ExactStorageCheck[] = [
  {
    name: "restaurant settings",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "RestaurantSettings"
      WHERE "taxRateMicros" <> ROUND(("taxRate"::numeric) * 1000000)::bigint
         OR "deliveryFeeMinor" <> ROUND(("deliveryFee"::numeric) * 100)::bigint
         OR "minDeliveryOrderMinor" <> ROUND(("minDeliveryOrder"::numeric) * 100)::bigint`,
  },
  {
    name: "menu item prices",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "MenuItem"
      WHERE "priceMinor" <> ROUND(("price"::numeric) * 100)::bigint`,
  },
  {
    name: "modifier option prices",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "ModifierOption"
      WHERE "priceMinor" <> ROUND(("price"::numeric) * 100)::bigint`,
  },
  {
    name: "customer spend",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "Customer"
      WHERE "totalSpentMinor" <> ROUND(("totalSpent"::numeric) * 100)::bigint`,
  },
  {
    name: "order totals",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "Order"
      WHERE "subtotalMinor" <> ROUND(("subtotal"::numeric) * 100)::bigint
         OR "taxAmountMinor" <> ROUND(("taxAmount"::numeric) * 100)::bigint
         OR "deliveryFeeMinor" <> ROUND(("deliveryFee"::numeric) * 100)::bigint
         OR "discountAmountMinor" <> ROUND(("discountAmount"::numeric) * 100)::bigint
         OR "tipAmountMinor" <> ROUND(("tipAmount"::numeric) * 100)::bigint
         OR "totalMinor" <> ROUND(("total"::numeric) * 100)::bigint`,
  },
  {
    name: "order item totals",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "OrderItem"
      WHERE "unitPriceMinor" <> ROUND(("unitPrice"::numeric) * 100)::bigint
         OR "totalPriceMinor" <> ROUND(("totalPrice"::numeric) * 100)::bigint`,
  },
  {
    name: "special offer rates",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "SpecialOffer"
      WHERE "discountBasisPoints" <> ROUND(("discountPercent"::numeric) * 100)::integer`,
  },
  {
    name: "promo rates",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "PromoCode"
      WHERE "discountBasisPoints" <> ROUND(("discountPercent"::numeric) * 100)::integer`,
  },
  {
    name: "gift card balances",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "GiftCard"
      WHERE "amountMinor" <> ROUND(("amount"::numeric) * 100)::bigint
         OR "balanceMinor" <> ROUND(("balance"::numeric) * 100)::bigint`,
  },
  {
    name: "employee wages",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "Employee"
      WHERE "hourlyWageMinor" <> ROUND(("hourlyWage"::numeric) * 100)::bigint`,
  },
  {
    name: "ingredient unit costs",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "Ingredient"
      WHERE "costPerUnitMicros" <> ROUND(("costPerUnit"::numeric) * 1000000)::bigint`,
  },
  {
    name: "purchase order totals",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "PurchaseOrder"
      WHERE "totalCostMinor" <> ROUND(("totalCost"::numeric) * 100)::bigint`,
  },
  {
    name: "cash drawer amounts",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "CashDrawerEntry"
      WHERE "amountMinor" <> ROUND(("amount"::numeric) * 100)::bigint`,
  },
  {
    name: "dynamic pricing multipliers",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "DynamicPricing"
      WHERE "multiplierMicros" <> ROUND(("multiplier"::numeric) * 1000000)::bigint`,
  },
  {
    name: "combo meal prices",
    sql: `SELECT COUNT(*)::int AS mismatches FROM "ComboMeal"
      WHERE "priceMinor" <> ROUND(("price"::numeric) * 100)::bigint`,
  },
];

async function main() {
  const failures: string[] = [];

  for (const check of checks) {
    const rows = await db.$queryRawUnsafe<Array<{ mismatches: number }>>(
      check.sql
    );
    const mismatches = rows[0]?.mismatches ?? -1;
    if (mismatches !== 0) {
      failures.push(`${check.name}: ${mismatches} mismatched row(s)`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Exact financial storage verification failed:\n${failures.join("\n")}`);
  }

  console.log(
    `Verified ${checks.length} exact financial storage groups with no mismatches.`
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[money:check] ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
