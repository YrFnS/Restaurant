import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    "prisma/migrations/20260801020001_add_waitlist_timestamp_default/migration.sql"
  ),
  "utf8"
);

describe("waitlist timestamp default", () => {
  test("keeps atomic raw queue inserts compatible with the required updatedAt column", () => {
    expect(migration).toContain('ALTER TABLE "WaitlistEntry"');
    expect(migration).toContain(
      'ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP'
    );
  });
});
