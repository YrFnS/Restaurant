import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const mode = process.argv[2];
const snapshotPath = process.argv[3];

assert.ok(
  mode === "snapshot" || mode === "verify",
  "Usage: bun p0-existing-data-rehearsal.ts <snapshot|verify> <snapshot-file>"
);
assert.ok(snapshotPath, "A snapshot file path is required");

const legacyModels = [
  "restaurantSettings",
  "menuCategory",
  "menuItem",
  "modifierGroup",
  "modifierOption",
  "customer",
  "order",
  "orderItem",
  "restaurantTable",
  "reservation",
  "waitlistEntry",
  "employee",
  "schedule",
  "ingredient",
  "wasteLog",
  "purchaseOrder",
  "cashDrawerEntry",
  "notification",
  "specialOffer",
  "promoCode",
  "rewardTier",
  "giftCard",
  "feedback",
  "testimonial",
  "newsletterSubscription",
  "dynamicPricing",
  "comboMeal",
  "kitchenStation",
  "kitchenScreen",
] as const;

type LegacyModelName = (typeof legacyModels)[number];
type Snapshot = {
  counts: Record<LegacyModelName, number>;
  sentinels: {
    employee: { id: string; name: string; role: string } | null;
    order: { id: string; orderNumber: string; total: number } | null;
    customer: { id: string; name: string; phone: string } | null;
    menuItem: { id: string; nameEn: string; price: number } | null;
    settings: { id: string; nameEn: string; currency: string } | null;
  };
};

async function capture(): Promise<Snapshot> {
  const countEntries = await Promise.all(
    legacyModels.map(async (modelName) => {
      const model = (db as any)[modelName] as { count: () => Promise<number> };
      return [modelName, await model.count()] as const;
    })
  );

  const [employee, order, customer, menuItem, settings] = await Promise.all([
    db.employee.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, role: true },
    }),
    db.order.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, orderNumber: true, total: true },
    }),
    db.customer.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    db.menuItem.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, nameEn: true, price: true },
    }),
    db.restaurantSettings.findUnique({
      where: { id: "1" },
      select: { id: true, nameEn: true, currency: true },
    }),
  ]);

  return {
    counts: Object.fromEntries(countEntries) as Record<LegacyModelName, number>,
    sentinels: { employee, order, customer, menuItem, settings },
  };
}

async function snapshot() {
  const current = await capture();
  assert.ok(current.counts.employee > 0, "Legacy seed must create employees");
  assert.ok(current.counts.order > 0, "Legacy seed must create orders");
  assert.ok(current.counts.menuItem > 0, "Legacy seed must create menu items");
  await writeFile(snapshotPath, JSON.stringify(current, null, 2), "utf8");
  console.log(`[p0-existing-data] Snapshot written to ${snapshotPath}`);
}

async function verify() {
  const expected = JSON.parse(await readFile(snapshotPath, "utf8")) as Snapshot;
  const actual = await capture();

  assert.deepEqual(
    actual.counts,
    expected.counts,
    "Additive P0 migrations must preserve every legacy record count"
  );
  assert.deepEqual(
    actual.sentinels,
    expected.sentinels,
    "Additive P0 migrations must preserve representative legacy records"
  );

  const employees = await db.employee.findMany({ select: { pin: true } });
  assert.ok(
    employees.every((employee) => !/^\d{4,8}$/.test(employee.pin)),
    "Existing employee PINs must be converted to non-recoverable verifiers"
  );

  await Promise.all([
    db.auditEvent.count(),
    db.staffSession.count(),
    db.rateLimitCounter.count(),
    db.kdsOutboxEvent.count(),
    db.paymentEvent.count(),
  ]);

  console.log("[p0-existing-data] Baseline adoption and data-preservation assertions passed.");
}

(mode === "snapshot" ? snapshot() : verify())
  .catch((error) => {
    console.error("[p0-existing-data] Rehearsal failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
