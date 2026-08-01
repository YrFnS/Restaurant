import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const operations = readFileSync(
  resolve("src/lib/waitlist/operations.ts"),
  "utf8"
);

describe("waitlist notification expiry interval", () => {
  test("casts Prisma's bound duration before calling PostgreSQL make_interval", () => {
    expect(operations).toContain(
      "make_interval(mins => CAST(${policy.notificationExpiryMinutes} AS integer))"
    );
  });
});
