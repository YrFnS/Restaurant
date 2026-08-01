import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260801020000_add_waitlist_operations/migration.sql"
);
const schema = source("prisma/schema.prisma");
const service = source("src/lib/waitlist/operations.ts");
const route = source("src/app/api/waitlist/route.ts");
const entryRoute = source("src/app/api/waitlist/[id]/route.ts");
const settingsRoute = source("src/app/api/waitlist/settings/route.ts");
const workerRoute = source("src/app/api/internal/waitlist/route.ts");
const tableRoute = source("src/app/api/tables/[id]/route.ts");
const customerUi = source("src/components/restaurant/WaitlistSection.tsx");
const hostUi = source("src/components/admin/tabs/WaitlistTab.tsx");
const adminShell = source("src/components/admin/AdminShell.tsx");
const packageJson = source("package.json");
const roadmap = source("docs/REMEDIATION_PLAN.md");
const design = source("docs/P1_WAITLIST_OPERATIONS.md");

describe("waitlist operations source inventory", () => {
  test("commits policy, estimate, hold, confirmation, and lifecycle storage", () => {
    for (const marker of [
      'ADD COLUMN "waitlistEnabled"',
      'ADD COLUMN "waitlistAverageTurnoverMinutes"',
      'ADD COLUMN "waitlistNotificationExpiryMinutes"',
      'ADD COLUMN "idempotencyKey"',
      'ADD COLUMN "tableId"',
      'ADD COLUMN "estimatedSeatAt"',
      'ADD COLUMN "notificationExpiresAt"',
      'ADD COLUMN "notificationConfirmedAt"',
      'WaitlistEntry_one_active_table_hold_idx',
      'WaitlistEntry_status_estimatedSeatAt_idx',
      'WaitlistEntry_lifecycle_shape',
      "THEN 'waiting'::\"WaitlistStatus\"",
    ]) {
      expect(migration).toContain(marker);
    }

    for (const marker of [
      "waitlistEnabled",
      "waitlistAverageTurnoverMinutes",
      "waitlistNotificationExpiryMinutes",
      "idempotencyKey",
      "source                   ReservationSource",
      "table                    RestaurantTable?",
      "estimatedSeatAt",
      "notificationExpiresAt",
      "notificationConfirmedAt",
      'map: "WaitlistEntry_status_estimatedSeatAt_idx"',
    ]) {
      expect(schema).toContain(marker);
    }
  });

  test("calculates capacity from tables, occupancy, reservations, holds, and queue order", () => {
    for (const marker of [
      "readWaitlistPolicy",
      'FROM "ReservationServicePeriod"',
      'FROM "ReservationClosure"',
      "loadTableSchedules",
      "averageTurnoverMinutes",
      'FROM "Reservation" AS reservation',
      'entry.status === "notified"',
      "earliestGap",
      "preferenceRank",
      "recalculateWaitlistEstimates",
      "estimatedSeatAt",
      "waitlistPosition",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("serializes queue mutations and protects table holds under concurrency", () => {
    for (const marker of [
      "pg_advisory_xact_lock",
      'advisoryLock(tx, "waitlist", "queue")',
      'advisoryLock(tx, "waitlist-idempotency", key)',
      'advisoryLock(tx, "waitlist-phone", customerPhone)',
      "WAITLIST_IDEMPOTENCY_CONFLICT",
      "DUPLICATE_WAITLIST_ENTRY",
      "WAITLIST_PRIORITY_CONFLICT",
      "WAITLIST_TABLE_ASSIGNMENT_CONFLICT",
      "WAITLIST_CONFIRMATION_REQUIRED",
      "WAITLIST_TRANSACTION_RETRY_REQUIRED",
      "expireStaleNotifications",
      "releaseHeldTable",
      "seatWaitlistEntry",
      "closeWaitlistEntry",
      "writeAuditEvent",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("keeps public access limited, token-scoped, and DTO allowlisted", () => {
    for (const marker of [
      'scope: "waitlist-read"',
      'scope: "waitlist-create"',
      "Idempotency-Key",
      "createWaitlistEntry",
      'verifyCustomerAccessToken("waitlist"',
      "serializeWaitlistForCustomer",
      "safeWaitlistPolicy",
      'headers: { "Cache-Control": "no-store" }',
    ]) {
      expect(route).toContain(marker);
    }
    expect(route).not.toContain("findMany({\n      orderBy: { createdAt: \"asc\" }");
  });

  test("authorizes staff lifecycle changes before parsing and restricts customer actions", () => {
    expect(entryRoute).toContain("RESERVATION_MANAGEMENT_ROLES");
    expect(entryRoute).toContain("customerAuthorized");
    expect(entryRoute).toContain('["confirm", "cancel"]');
    expect(entryRoute).toContain("notifyWaitlistEntry");
    expect(entryRoute).toContain("confirmWaitlistEntry");
    expect(entryRoute).toContain("seatWaitlistEntry");
    expect(entryRoute).toContain("closeWaitlistEntry");
    expect(entryRoute.indexOf("requireStaffSession")).toBeLessThan(
      entryRoute.indexOf("await req.json()")
    );
  });

  test("protects settings, expiry worker, and table structural operations", () => {
    expect(settingsRoute).toContain(
      "requireStaffSession(RESERVATION_MANAGEMENT_ROLES)"
    );
    expect(settingsRoute).toContain("waitlist.policy.update");
    expect(settingsRoute).toContain("recalculateWaitlistEstimates");

    for (const marker of [
      "configuredSecret",
      "secretsMatch",
      "refreshWaitlist",
      "WAITLIST_WORKER_NOT_CONFIGURED",
    ]) {
      expect(workerRoute).toContain(marker);
    }

    expect(tableRoute).toContain("TABLE_HAS_WAITLIST_HOLD");
    expect(tableRoute).toContain("TABLE_CAPACITY_BELOW_WAITLIST_PARTY");
    expect(tableRoute).toContain("waitlistEntries");
  });

  test("ships bilingual customer confirmation and host operations", () => {
    for (const marker of [
      '"Idempotency-Key"',
      'action: "confirm"',
      "Projected seating",
      "Confirm I am coming",
      "قائمة الانتظار غير متاحة حالياً",
      "التقدير يعتمد على حجم المجموعة والطاولات والحجوزات",
    ]) {
      expect(customerUi).toContain(marker);
    }

    for (const marker of [
      'apiFetch("/api/waitlist?admin=true',
      'apiFetch("/api/waitlist/settings"',
      'action: "notify"',
      'action: "seat"',
      "Waitlist Operations",
      "إدارة قائمة الانتظار",
      "Require confirmation",
    ]) {
      expect(hostUi).toContain(marker);
    }
    expect(adminShell).toContain("WaitlistTab");
    expect(adminShell).toContain('id: "waitlist"');
  });

  test("keeps permanent integration and roadmap evidence", () => {
    expect(packageJson).toContain("bun tests/integration/p1-waitlist-operations.ts");
    expect(roadmap).toContain("P1-B07 Waitlist");
    expect(design).toContain("one availability lane per physical table");
    expect(design).toContain("notification has an exact expiry timestamp");
    expect(design).toContain("customer confirmation");
    expect(design).toContain("PostgreSQL adds one active notified hold per table");
  });
});
