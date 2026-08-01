import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const operations = readFileSync(
  resolve("src/lib/waitlist/operations.ts"),
  "utf8"
);
const integration = readFileSync(
  resolve("tests/integration/p1-waitlist-operations.ts"),
  "utf8"
);

describe("waitlist notification expiry", () => {
  test("casts Prisma's bound duration before calling PostgreSQL make_interval", () => {
    expect(operations).toContain(
      "make_interval(mins => CAST(${policy.notificationExpiryMinutes} AS integer))"
    );
  });

  test("keeps the simulated expired notification inside the lifecycle range constraint", () => {
    expect(integration).toContain(
      "notifiedAt: addMinutes(new Date(), -2)"
    );
    expect(integration).toContain(
      "notificationExpiresAt: addMinutes(new Date(), -1)"
    );
  });
});
