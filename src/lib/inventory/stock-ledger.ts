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
