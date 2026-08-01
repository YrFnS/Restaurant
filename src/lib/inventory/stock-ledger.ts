import "server-only";

import { Prisma } from "@prisma/client";
import * as implementation from "./stock-ledger-impl";

export * from "./stock-ledger-impl";

type StockClient = Parameters<typeof implementation.createStockMovement>[0];
type RawQuery = {
  readonly text?: string;
  readonly sql?: string;
  readonly values?: readonly unknown[];
};

function prismaSafeInventoryClient(client: StockClient): StockClient {
  const originalQueryRaw = client.$queryRaw.bind(client);

  return new Proxy(client, {
    get(target, property) {
      if (property === "$queryRaw") {
        return async (query: RawQuery, ...args: unknown[]) => {
          const sqlText = query?.text || query?.sql || "";
          if (sqlText.includes("pg_advisory_xact_lock")) {
            const key = query?.values?.[0];
            if (typeof key !== "string") {
              return originalQueryRaw(query as never, ...args as never[]);
            }

            return originalQueryRaw(Prisma.sql`
              WITH inventory_lock AS (
                SELECT pg_advisory_xact_lock(
                  hashtextextended(${key}, 0)
                )
              )
              SELECT 1::integer AS "locked"
              FROM inventory_lock
            `);
          }

          return originalQueryRaw(query as never, ...args as never[]);
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function databaseErrorDetails(error: unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number): void => {
    if (depth > 4 || value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (value instanceof Error) {
      parts.push(value.name, value.message);
      visit(value.cause, depth + 1);
    }

    const record = value as Record<string, unknown>;
    for (const key of [
      "code",
      "message",
      "meta",
      "cause",
      "constraint",
      "target",
    ]) {
      visit(record[key], depth + 1);
    }
  };

  visit(error, 0);
  return parts.join(" ");
}

export function inventoryLedgerErrorFromDatabase(
  error: unknown
): implementation.InventoryLedgerError | null {
  const mapped = implementation.inventoryLedgerErrorFromDatabase(error);
  if (mapped) return mapped;

  const details = databaseErrorDetails(error);
  const lowerDetails = details.toLowerCase();
  const duplicateReversal =
    details.includes("StockMovement_one_reversal_per_movement_idx") ||
    (details.includes("reversalOfId") &&
      (details.includes("23505") ||
        details.includes("P2010") ||
        lowerDetails.includes("unique constraint")));

  if (duplicateReversal) {
    return new implementation.InventoryLedgerError(
      "This stock movement was already reversed",
      "STOCK_MOVEMENT_ALREADY_REVERSED",
      409
    );
  }

  const retriableTransactionConflict =
    details.includes("40P01") ||
    details.includes("40001") ||
    details.includes("P2034") ||
    lowerDetails.includes("deadlock detected") ||
    lowerDetails.includes("write conflict") ||
    lowerDetails.includes("serialization failure");

  if (retriableTransactionConflict) {
    return new implementation.InventoryLedgerError(
      "Stock changed concurrently; retry the movement",
      "STOCK_TRANSACTION_RETRY_REQUIRED",
      409,
      { retryable: true }
    );
  }

  return null;
}

export const createStockMovement: typeof implementation.createStockMovement = (
  client,
  input
) => implementation.createStockMovement(prismaSafeInventoryClient(client), input);

export const reverseStockMovement: typeof implementation.reverseStockMovement = (
  client,
  input
) => implementation.reverseStockMovement(prismaSafeInventoryClient(client), input);

export const publishRecipeVersion: typeof implementation.publishRecipeVersion = (
  client,
  input
) => implementation.publishRecipeVersion(prismaSafeInventoryClient(client), input);

export const consumeOrderItemInventory: typeof implementation.consumeOrderItemInventory = (
  client,
  input
) => implementation.consumeOrderItemInventory(prismaSafeInventoryClient(client), input);

export const consumeOrderInventory: typeof implementation.consumeOrderInventory = (
  client,
  input
) => implementation.consumeOrderInventory(prismaSafeInventoryClient(client), input);
