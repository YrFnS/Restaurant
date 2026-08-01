import { Prisma } from "@prisma/client";

type RawSqlShape = {
  strings?: readonly string[];
  values?: readonly unknown[];
};

type RawQuery = (...args: unknown[]) => Promise<unknown>;

/**
 * Prisma cannot deserialize PostgreSQL's `void` result type. The loyalty
 * ledger intentionally uses transaction-scoped advisory locks, whose native
 * function returns `void`, so reviewed callers use this narrow adapter to cast
 * only that result to text while preserving every other transaction operation.
 */
export function withSafeLoyaltyRawQueries(
  transaction: Prisma.TransactionClient
): Prisma.TransactionClient {
  const originalQueryRaw = transaction.$queryRaw.bind(transaction) as RawQuery;

  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "$queryRaw") {
        return async (...args: unknown[]) => {
          const query = args[0] as RawSqlShape | undefined;
          const queryText = Array.isArray(query?.strings)
            ? query.strings.join("?")
            : "";
          if (queryText.includes("pg_advisory_xact_lock")) {
            const lockKey = query?.values?.[0];
            if (typeof lockKey !== "string") {
              throw new Error("Loyalty advisory lock key is missing");
            }
            return originalQueryRaw(Prisma.sql`
              SELECT pg_advisory_xact_lock(
                hashtextextended(${lockKey}, 0)
              )::text AS "locked"
            `);
          }
          return originalQueryRaw(...args);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Prisma.TransactionClient;
}
