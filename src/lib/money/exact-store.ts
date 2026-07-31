import "server-only";

import { Prisma } from "@prisma/client";
import {
  BASIS_POINT_DIGITS,
  CURRENCY_MINOR_DIGITS,
  RATE_MICRO_DIGITS,
  scaledIntegerToSafeInteger,
  scaledIntegerToSafeNumber,
} from "./scaled-integer";

/** Minimal structural contract shared by configured clients and transactions. */
export type ExactQueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface ExactRestaurantPricingSettings {
  taxRateMicros: bigint;
  deliveryFeeMinor: bigint;
  minDeliveryOrderMinor: bigint;
}

type IdValueRow = {
  id: string;
  value: bigint;
};

function valueMap(rows: readonly IdValueRow[]): Map<string, bigint> {
  return new Map(rows.map((row) => [row.id, row.value]));
}

export function exactMinorToCents(value: bigint): number {
  return scaledIntegerToSafeInteger(value);
}

export function exactMinorToNumber(value: bigint): number {
  return scaledIntegerToSafeNumber(value, CURRENCY_MINOR_DIGITS);
}

export function exactRateMicrosToNumber(value: bigint): number {
  return scaledIntegerToSafeNumber(value, RATE_MICRO_DIGITS);
}

export function exactBasisPointsToPercent(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("Stored discount basis points are outside the supported range");
  }
  return value / 10 ** BASIS_POINT_DIGITS;
}

export async function readExactRestaurantPricingSettings(
  client: ExactQueryClient
): Promise<ExactRestaurantPricingSettings | null> {
  const rows = await client.$queryRaw<ExactRestaurantPricingSettings[]>(Prisma.sql`
    SELECT
      "taxRateMicros",
      "deliveryFeeMinor",
      "minDeliveryOrderMinor"
    FROM "RestaurantSettings"
    WHERE "id" = '1'
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function readExactMenuItemPrices(
  client: ExactQueryClient,
  ids: readonly string[]
): Promise<Map<string, bigint>> {
  if (ids.length === 0) return new Map();
  const rows = await client.$queryRaw<IdValueRow[]>(Prisma.sql`
    SELECT "id", "priceMinor" AS "value"
    FROM "MenuItem"
    WHERE "id" IN (${Prisma.join(ids)})
  `);
  return valueMap(rows);
}

export async function readExactModifierOptionPrices(
  client: ExactQueryClient,
  ids: readonly string[]
): Promise<Map<string, bigint>> {
  if (ids.length === 0) return new Map();
  const rows = await client.$queryRaw<IdValueRow[]>(Prisma.sql`
    SELECT "id", "priceMinor" AS "value"
    FROM "ModifierOption"
    WHERE "id" IN (${Prisma.join(ids)})
  `);
  return valueMap(rows);
}

export async function readExactPricingRuleMultipliers(
  client: ExactQueryClient,
  ids: readonly string[]
): Promise<Map<string, bigint>> {
  if (ids.length === 0) return new Map();
  const rows = await client.$queryRaw<IdValueRow[]>(Prisma.sql`
    SELECT "id", "multiplierMicros" AS "value"
    FROM "DynamicPricing"
    WHERE "id" IN (${Prisma.join(ids)})
  `);
  return valueMap(rows);
}

export async function readExactPromoBasisPoints(
  client: ExactQueryClient,
  code: string
): Promise<number | null> {
  const rows = await client.$queryRaw<Array<{ value: number }>>(Prisma.sql`
    SELECT "discountBasisPoints" AS "value"
    FROM "PromoCode"
    WHERE "code" = ${code}
    LIMIT 1
  `);
  return rows[0]?.value ?? null;
}

export async function readExactOrderTotalMinor(
  client: ExactQueryClient,
  orderId: string
): Promise<bigint | null> {
  const rows = await client.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`
    SELECT "totalMinor" AS "value"
    FROM "Order"
    WHERE "id" = ${orderId}
    LIMIT 1
  `);
  return rows[0]?.value ?? null;
}

export async function readExactCashBalanceMinor(
  client: ExactQueryClient
): Promise<bigint> {
  const rows = await client.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN "type"::text IN ('refund', 'payout', 'drop')
            THEN -"amountMinor"
          ELSE "amountMinor"
        END
      ),
      0
    )::bigint AS "value"
    FROM "CashDrawerEntry"
  `);
  return rows[0]?.value ?? BigInt(0);
}

export async function readExactCashEntryAmounts(
  client: ExactQueryClient,
  ids: readonly string[]
): Promise<Map<string, bigint>> {
  if (ids.length === 0) return new Map();
  const rows = await client.$queryRaw<IdValueRow[]>(Prisma.sql`
    SELECT "id", "amountMinor" AS "value"
    FROM "CashDrawerEntry"
    WHERE "id" IN (${Prisma.join(ids)})
  `);
  return valueMap(rows);
}
