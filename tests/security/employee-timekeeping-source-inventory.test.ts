import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260731235970_add_employee_timekeeping/migration.sql"
);
const schema = source("prisma/schema.prisma");
const service = source("src/lib/timekeeping/timekeeping.ts");
const clockRoute = source("src/app/api/employees/clock/route.ts");
const timekeepingRoute = source("src/app/api/timekeeping/route.ts");
const employeeRoute = source("src/app/api/employees/[id]/route.ts");
const settingsRoute = source("src/app/api/settings/route.ts");
const settingsUi = source("src/components/admin/tabs/SettingsTab.tsx");
const timesheetUi = source("src/app/admin/timesheet/page.tsx");
const packageJson = source("package.json");
const roadmap = source("docs/REMEDIATION_PLAN.md");
const design = source("docs/P1_EMPLOYEE_TIMEKEEPING.md");

describe("employee timekeeping source inventory", () => {
  test("commits immutable event, shift, break, adjustment, and policy storage", () => {
    for (const marker of [
      'CREATE TYPE "TimeEventType"',
      'CREATE TYPE "TimeEventSource"',
      'CREATE TYPE "TimeShiftStatus"',
      'ADD COLUMN "timezone" TEXT',
      'ADD COLUMN "operationalDayStartMinutes" INTEGER',
      'CREATE TABLE "EmployeeTimeEvent"',
      'CREATE TABLE "EmployeeShift"',
      'CREATE TABLE "EmployeeBreak"',
      'CREATE TABLE "EmployeeTimeAdjustment"',
      'EmployeeShift_one_open_employee_idx',
      'EmployeeBreak_one_open_shift_idx',
      'EmployeeTimeEvent_idempotencyKey_key',
      'EmployeeTimeAdjustment_idempotencyKey_key',
    ]) {
      expect(migration).toContain(marker);
    }
    for (const marker of [
      "enum TimeEventType",
      "enum TimeEventSource",
      "enum TimeShiftStatus",
      "model EmployeeTimeEvent",
      "model EmployeeShift",
      "model EmployeeBreak",
      "model EmployeeTimeAdjustment",
      "operationalDayStartMinutes",
      "timezone",
    ]) {
      expect(schema).toContain(marker);
    }
  });

  test("enforces immutable history and ledger-controlled employee cache", () => {
    for (const marker of [
      'EmployeeTimeEvent_immutable_update',
      'EmployeeTimeEvent_immutable_delete',
      'EmployeeShift_protect_update',
      'EmployeeShift_protect_delete',
      'EmployeeBreak_protect_update',
      'EmployeeBreak_protect_delete',
      'EmployeeTimeAdjustment_immutable_update',
      'EmployeeTimeAdjustment_immutable_delete',
      'Employee clock state is timekeeping-ledger controlled',
      'Closed employee shifts are immutable',
      'Employee time adjustments are immutable',
      'Time adjustment would make paid shift duration negative',
    ]) {
      expect(migration).toContain(marker);
    }
    expect(employeeRoute).toContain("EMPLOYEE_HAS_TIME_HISTORY");
    expect(employeeRoute).toContain("EMPLOYEE_HAS_OPEN_SHIFT");
  });

  test("serializes event state transitions and exact labor snapshots", () => {
    for (const marker of [
      "clockEmployee",
      "lockKey",
      "pg_advisory_xact_lock",
      "openShift",
      "openBreak",
      "ACTIVE_BREAK_MUST_END",
      "CLOCK_EVENT_OUT_OF_ORDER",
      "laborCostForSeconds",
      "set_config('app.timekeeping_write'",
      'INSERT INTO "EmployeeTimeEvent"',
      'INSERT INTO "EmployeeShift"',
      'INSERT INTO "EmployeeBreak"',
      'UPDATE "EmployeeShift"',
      "addTimeAdjustment",
      "replay.source !== input.source",
      "replay.paidSecondsDelta !== paidSecondsDelta",
      `AND shift."status" = 'closed'`,
      "totalPaidSeconds",
      "totalLaborCostMinor",
      'INSERT INTO "EmployeeTimeAdjustment"',
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("keeps kiosk and manager routes authorized, limited, audited, and replay-safe", () => {
    expect(clockRoute).toContain("authenticateEmployeePin");
    expect(clockRoute).toContain("consumeRateLimit");
    expect(clockRoute).toContain("requireStaffSession(STAFF_ADMIN_ROLES)");
    expect(clockRoute).toContain("Idempotency-Key");
    expect(clockRoute).toContain("clockEmployee");
    expect(clockRoute).toContain("writeAuditEvent");
    expect(clockRoute).toContain("KIOSK_CLOCK_FIELDS_FORBIDDEN");

    expect(timekeepingRoute).toContain("requireStaffSession(STAFF_ADMIN_ROLES)");
    expect(timekeepingRoute).toContain("readTimesheet");
    expect(timekeepingRoute).toContain("addTimeAdjustment");
    expect(timekeepingRoute).toContain("Idempotency-Key");
    expect(timekeepingRoute).toContain("employee.time.adjust");
  });

  test("makes restaurant timezone and operational-day policy configurable", () => {
    expect(settingsRoute).toContain("timezone");
    expect(settingsRoute).toContain("operationalDayStartMinutes");
    expect(settingsRoute).toContain("pg_timezone_names");
    expect(settingsRoute).toContain("INVALID_RESTAURANT_TIMEZONE");
    expect(settingsUi).toContain("operationalDayStartMinutes");
    expect(settingsUi).toContain("Asia/Baghdad");
    expect(settingsUi).toContain("Operational day starts");
  });

  test("ships a bilingual live-state, breaks, history, and adjustment console", () => {
    for (const marker of [
      'jsonFetch("/api/employees/clock"',
      'jsonFetch("/api/timekeeping"',
      '"Idempotency-Key"',
      "Start Break",
      "بدء استراحة",
      "Historical Shifts",
      "المناوبات التاريخية",
      "Paid-Time Adjustment",
      "تصحيح وقت مدفوع",
    ]) {
      expect(timesheetUi).toContain(marker);
    }
  });

  test("keeps permanent integration and roadmap evidence", () => {
    expect(packageJson).toContain("bun tests/integration/p1-employee-timekeeping.ts");
    expect(roadmap).toContain("P1-B02 Employee timekeeping");
    expect(roadmap).toContain("P1_EMPLOYEE_TIMEKEEPING.md");
    expect(roadmap).toContain("P1 immutable employee timekeeping");
    expect(design).toContain("append-only");
    expect(design).toContain("operational-day boundary");
    expect(design).toContain("signed time adjustments");
    expect(design).toContain("original normalized event or adjustment payload");
    expect(design).toContain("raw seconds plus exact minor-unit labor costs");
  });
});
