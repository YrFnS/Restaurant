import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.36";

async function main() {
  const startedAt = new Date(Date.now() - 1_000);
  const promo = await db.promoCode.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(promo, "Seed data must include an active promo code");

  const response = await fetch(
    `${BASE_URL}/api/promo?code=${encodeURIComponent(promo.code)}`,
    {
      headers: {
        "x-forwarded-for": SOURCE_IP,
        "x-request-id": `p0-public-limits-${crypto.randomUUID()}`,
      },
    }
  );
  assert.equal(response.status, 200, "Promo lookup must succeed");
  const body = await response.json();
  assert.equal(body.valid, true);
  assert.equal(body.code, promo.code);
  assert.equal(
    response.headers.get("ratelimit-limit"),
    "60",
    "Promo lookup must expose the shared rate-limit policy"
  );

  const counters = await db.rateLimitCounter.findMany({
    where: {
      scope: "promo-check",
      createdAt: { gte: startedAt },
    },
  });
  assert.equal(counters.length, 1, "Promo lookup must persist one shared counter");
  assert.equal(counters[0]?.count, 1);
  assert.equal(
    counters[0]?.key.includes(SOURCE_IP),
    false,
    "Shared counter keys must not store the raw source address"
  );

  console.log("[p0-public-limits] Shared promo limiter assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p0-public-limits] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
