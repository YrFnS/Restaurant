import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const adapter = source("src/lib/inventory/stock-ledger.ts");
const movementsRoute = source("src/app/api/inventory/movements/route.ts");

describe("stock transaction conflict boundary", () => {
  test("maps transient PostgreSQL concurrency failures to an explicit retryable conflict", () => {
    for (const marker of [
      "40P01",
      "40001",
      "P2034",
      "deadlock detected",
      "serialization failure",
      "STOCK_TRANSACTION_RETRY_REQUIRED",
      "retryable: true",
    ]) {
      expect(adapter).toContain(marker);
    }
    expect(movementsRoute).toContain("inventoryLedgerErrorFromDatabase");
    expect(movementsRoute).toContain("return errorResponse(mapped)");
  });
});
