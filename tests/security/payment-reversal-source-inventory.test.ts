import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const schema = source("prisma/schema.prisma");
const migration = source(
  "prisma/migrations/20260731235930_add_payment_reversals/migration.sql"
);
const service = source("src/lib/payments/reversals.ts");
const route = source("src/app/api/orders/[id]/payments/route.ts");
const checkout = source("src/app/api/pos/checkout/route.ts");
const adminPage = source("src/app/admin/payment-reversals/page.tsx");
const adminConsole = source("src/components/admin/PaymentReversalConsole.tsx");
const integrationCommand = source("package.json");

describe("payment reversal source inventory", () => {
  test("commits parent-linked immutable reversal columns and indexes", () => {
    for (const marker of [
      'ADD COLUMN "parentEventId" TEXT',
      'ADD COLUMN "reasonCode" TEXT',
      'ADD COLUMN "reason" TEXT',
      'PaymentEvent_parentEventId_fkey',
      'PaymentEvent_parent_createdAt_idx',
      'PaymentEvent_order_status_createdAt_idx',
      'PaymentEvent_one_successful_void_per_capture_idx',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("enforces reversal shape, concurrency, and ledger immutability in PostgreSQL", () => {
    for (const marker of [
      'PaymentEvent_reversal_shape',
      'validate_payment_reversal_insert',
      'FOR UPDATE',
      'Payment reversal exceeds the remaining captured amount',
      'A void must reverse the untouched capture in full',
      'PaymentEvent_validate_reversal',
      'protect_payment_event_ledger',
      'PaymentEvent_immutable',
      'Payment events are immutable; append a new event instead',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("maps the reversal relationship in Prisma to prevent migration drift", () => {
    for (const marker of [
      'parentEventId    String?',
      '@relation("PaymentEventReversals"',
      'reversals        PaymentEvent[]',
      'reasonCode       String',
      'reason           String?',
      'map: "PaymentEvent_parent_createdAt_idx"',
      'map: "PaymentEvent_order_status_createdAt_idx"',
    ]) {
      expect(schema).toContain(marker);
    }
  });

  test("uses manager authorization, idempotency, register locks, and exact cash effects", () => {
    for (const marker of [
      'PAYMENT_REVERSAL_ROLES = ["owner", "admin", "manager"]',
      'lockOrder',
      'readLedgerEvents(tx, input.orderId, true)',
      'lockOpenRegisterSession',
      'type: "refund"',
      'registerSessionId: registerContext.session.id',
      'parentEventId',
      'payment.cash.${input.action}',
      'partially_refunded',
      'refunded',
      'voided',
    ]) {
      expect(service).toContain(marker);
    }

    expect(route.indexOf("requireStaffSession(PAYMENT_REVERSAL_ROLES)")).toBeLessThan(
      route.indexOf("req.json()")
    );
    expect(route).toContain("idempotencyKeyFromRequest");
    expect(route).toContain("registerIdentityFromRequest");
    expect(route).toContain("readPaymentLedgerSummary");
  });

  test("creates immutable captures with their register link at insert time", () => {
    expect(checkout).toContain("registerSessionId: registerContext.session.id");
    expect(checkout).not.toContain("linkPaymentEventToSession");
  });

  test("ships the reviewed manager console and permanent integration suite", () => {
    expect(adminPage).toContain("PaymentReversalConsole");
    for (const marker of [
      'fetch("/api/orders?limit=200"',
      '/payments`,',
      'Idempotency-Key',
      'X-Register-Id',
      'X-Register-Device-Id',
      'reasonCode',
      'canRefund',
      'canVoid',
    ]) {
      expect(adminConsole).toContain(marker);
    }
    expect(integrationCommand).toContain(
      "bun tests/integration/p1-payment-reversals.ts"
    );
  });
});
