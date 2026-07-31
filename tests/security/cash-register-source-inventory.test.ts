import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260731235920_add_cash_register_sessions/migration.sql"
);
const service = source("src/lib/cash/register-session.ts");
const registersRoute = source("src/app/api/registers/route.ts");
const sessionRoute = source("src/app/api/registers/[id]/session/route.ts");
const cashRoute = source("src/app/api/cash/route.ts");
const checkoutRoute = source("src/app/api/pos/checkout/route.ts");

describe("cash-register session source inventory", () => {
  test("commits the register, session, close, and ledger-link schema", () => {
    for (const marker of [
      'CREATE TABLE "CashRegister"',
      'CREATE TABLE "CashRegisterSession"',
      'CREATE TABLE "CashRegisterClose"',
      'ADD COLUMN "registerSessionId" TEXT',
      'CashRegisterSession_one_open_per_register_idx',
      'CashDrawerEntry_registerSession_createdAt_idx',
      'PaymentEvent_registerSession_createdAt_idx',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("keeps closing records immutable and validates open-session ledger links", () => {
    for (const marker of [
      'CashRegisterClose_immutable',
      'CashRegisterSession_protect_closed',
      'CashRegisterClose_validate_session',
      'CashDrawerEntry_open_session_link',
      'PaymentEvent_open_session_link',
      "Closed cash-register sessions are immutable",
      "Cash-register closing records are immutable",
      "Cash ledger records can only be linked to an open register session",
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("serializes register operations with database row locks", () => {
    expect(service).toContain("FOR UPDATE");
    expect(service).toContain("lockRegister");
    expect(service).toContain("lockOpenRegisterSession");
    expect(service).toContain("readSessionExpectedCashMinor");
    expect(service).toContain("REGISTER_DEVICE_MISMATCH");
    expect(service).toContain("REGISTER_SESSION_REQUIRED");
  });

  test("requires protected, idempotent register provisioning and lifecycle APIs", () => {
    expect(registersRoute).toContain(
      'const REGISTER_MANAGEMENT_ROLES = ["owner", "admin", "manager"]'
    );
    expect(registersRoute).toContain("requireStaffSession(REGISTER_MANAGEMENT_ROLES)");
    expect(registersRoute).toContain('action: "cash.register.create"');

    expect(sessionRoute).toContain("requireStaffSession(CASH_MANAGEMENT_ROLES)");
    expect(sessionRoute).toContain("registerDeviceIdFromRequest");
    expect(sessionRoute).toContain("idempotencyKeyFromRequest");
    expect(sessionRoute).toContain("MANAGER_APPROVAL_REQUIRED");
    expect(sessionRoute).toContain("APPROVAL_REASON_REQUIRED");
    expect(sessionRoute).toContain('action: "cash.session.open"');
    expect(sessionRoute).toContain('action: "cash.session.close"');
  });

  test("binds every active cash mutation and cash capture to an open session", () => {
    for (const marker of [
      "lockOpenRegisterSession",
      "linkCashEntryToSession",
      "registerSessionId",
    ]) {
      expect(cashRoute).toContain(marker);
      expect(checkoutRoute).toContain(marker);
    }
    expect(checkoutRoute).toContain("linkPaymentEventToSession");
    expect(checkoutRoute).toContain("allowLegacyFallback: true");
    expect(cashRoute).not.toContain("allowLegacyFallback: true");
  });
});
