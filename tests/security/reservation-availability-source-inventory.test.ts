import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260801010000_add_reservation_availability/migration.sql"
);
const schema = source("prisma/schema.prisma");
const service = source("src/lib/reservations/availability.ts");
const reservationsRoute = source("src/app/api/reservations/route.ts");
const reservationRoute = source("src/app/api/reservations/[id]/route.ts");
const availabilityRoute = source(
  "src/app/api/reservations/availability/route.ts"
);
const settingsRoute = source("src/app/api/reservation-settings/route.ts");
const customerUi = source(
  "src/components/restaurant/ReservationsSection.tsx"
);
const calendarUi = source("src/app/admin/reservations-calendar/page.tsx");
const settingsUi = source("src/app/admin/reservation-settings/page.tsx");
const packageJson = source("package.json");
const design = source("docs/P1_RESERVATION_AVAILABILITY.md");

describe("reservation availability source inventory", () => {
  test("commits restaurant policy, weekly service, closure, and occupancy snapshots", () => {
    for (const marker of [
      'CREATE TYPE "ReservationSource"',
      'CREATE TABLE "ReservationServicePeriod"',
      'CREATE TABLE "ReservationClosure"',
      'ADD COLUMN "reservationMinNoticeMinutes"',
      'ADD COLUMN "durationMinutes"',
      'ADD COLUMN "endsAt"',
      'ADD COLUMN "releaseAt"',
      'ReservationServicePeriod_unique_window_idx',
      'Reservation_idempotencyKey_key',
    ]) {
      expect(migration).toContain(marker);
    }
    for (const marker of [
      "enum ReservationSource",
      "model ReservationServicePeriod",
      "model ReservationClosure",
      "reservationDefaultDurationMinutes",
      "reservationCustomerCancelCutoffMinutes",
      "idempotencyKey",
      "durationMinutes",
      "releaseAt",
      "seatedAt",
      "completedAt",
      "cancelledAt",
      "noShowAt",
    ]) {
      expect(schema).toContain(marker);
    }
  });

  test("makes PostgreSQL the final active-table concurrency boundary", () => {
    for (const marker of [
      "CREATE EXTENSION IF NOT EXISTS btree_gist",
      'Reservation_active_table_no_overlap',
      'EXCLUDE USING gist',
      'tstzrange("dateTime", "releaseAt", \'[)\')',
      '"status" IN (\'confirmed\', \'seated\')',
      "Existing active reservations double-book a table",
    ]) {
      expect(migration).toContain(marker);
    }
    expect(service).toContain("FOR UPDATE");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("RESERVATION_TABLE_CONFLICT");
  });

  test("calculates normal and overnight restaurant-local slots with closures", () => {
    for (const marker of [
      "listReservationAvailability",
      "ReservationServicePeriod",
      "previousWeekday",
      "generate_series",
      "AT TIME ZONE",
      "ReservationClosure",
      "availableTableCount",
      "reservationMinNoticeMinutes",
      "reservationMaxAdvanceDays",
      "reservationDefaultDurationMinutes",
      "reservationTurnoverMinutes",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("keeps public availability aggregate-only, limited, and validated", () => {
    for (const marker of [
      "availabilityQuerySchema",
      "reservation-availability",
      "consumeRateLimit",
      "listReservationAvailability",
      "availableTableCount",
    ]) {
      expect(availabilityRoute).toContain(marker);
    }
    expect(availabilityRoute).not.toContain("customerPhone");
    expect(availabilityRoute).not.toContain("customerEmail");
    expect(availabilityRoute).not.toContain("tableId");
    expect(service).not.toContain("id: reservation.table.id");
    expect(service).toContain(
      'generated."localStart"::date = service_windows."localDate"'
    );
  });

  test("creates bookings from local date/time with idempotency and audited allocation", () => {
    for (const marker of [
      "reservationCreateSchema",
      'date: z.string().regex',
      'time: z.string().regex',
      'req.headers.get("Idempotency-Key")',
      "createReservationBooking",
      "TransactionIsolationLevel.Serializable",
      "reservation.customer.create",
      "createCustomerAccessToken",
    ]) {
      expect(reservationsRoute).toContain(marker);
    }
    expect(reservationsRoute).not.toContain("new Date(parsed.data.dateTime)");
  });

  test("authorizes lifecycle changes before parsing and audits table effects", () => {
    const jsonIndex = reservationRoute.indexOf("req.json()");
    expect(jsonIndex).toBeGreaterThan(0);
    expect(reservationRoute.indexOf("verifyCustomerAccessToken")).toBeLessThan(
      jsonIndex
    );
    expect(reservationRoute.indexOf("requireStaffSession")).toBeLessThan(
      jsonIndex
    );
    for (const marker of [
      "ALLOWED_TRANSITIONS",
      "customerCancellationAllowed",
      "assertReservationTableAvailable",
      "RESERVATION_TABLE_NOT_READY",
      'status: "cleaning"',
      "reservation.customer.cancel",
      "reservation.status.update",
      "writeAuditEvent",
    ]) {
      expect(reservationRoute).toContain(marker);
    }
  });

  test("protects reservation policy, service periods, and closures", () => {
    for (const marker of [
      "requireStaffSession(RESERVATION_MANAGEMENT_ROLES)",
      "policySchema",
      "periodSchema",
      "closureSchema",
      "restaurantLocalDateTimeToUtc",
      "reservation.policy.update",
      "reservation.service_period.create",
      "reservation.closure.create",
      "writeAuditEvent",
    ]) {
      expect(settingsRoute).toContain(marker);
    }
  });

  test("ships bilingual customer availability and staff policy workflows", () => {
    for (const marker of [
      "/api/reservations/availability",
      '"Idempotency-Key"',
      "availableTableCount",
      "No times are available",
      "لا توجد أوقات متاحة",
      "Authorization: `Bearer",
    ]) {
      expect(customerUi).toContain(marker);
    }
    expect(calendarUi).toContain("reservation.localDate");
    expect(calendarUi).toContain("/admin/reservation-settings");
    expect(settingsUi).toContain("Weekly Service Periods");
    expect(settingsUi).toContain("فترات الخدمة الأسبوعية");
    expect(settingsUi).toContain("Closures & Exceptions");
    expect(settingsUi).toContain("الإغلاقات والاستثناءات");
  });

  test("keeps permanent integration and policy documentation", () => {
    expect(packageJson).toContain(
      "bun tests/integration/p1-reservation-availability.ts"
    );
    expect(design).toContain("PostgreSQL exclusion constraints");
    expect(design).toContain("restaurant-local date and time");
    expect(design).toContain("customer cancellation");
    expect(design).toContain("table combinations remain deferred");
  });
});
