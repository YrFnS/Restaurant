import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260801030000_add_loyalty_gift_card_ledgers/migration.sql"
);
const schema = source("prisma/schema.prisma");
const dbSource = source("src/lib/db.ts");
const roles = source("src/lib/auth/roles.ts");
const service = source("src/lib/loyalty/ledger.ts");
const checkout = source("src/app/api/pos/checkout/route.ts");
const reversals = source("src/lib/payments/reversals.ts");
const lookup = source("src/app/api/gift-cards/lookup/route.ts");
const settings = source("src/app/api/settings/route.ts");
const settingsUi = source("src/components/admin/tabs/SettingsTab.tsx");
const design = source("docs/P1_LOYALTY_GIFT_CARDS.md");

describe("loyalty and gift-card source inventory", () => {
  test("commits append-only loyalty and stored-value database contracts", () => {
    for (const marker of [
      'ADD VALUE IF NOT EXISTS \'gift_card\'',
      'CREATE TYPE "LoyaltyPointEventType"',
      'CREATE TYPE "GiftCardStatus"',
      'CREATE TYPE "GiftCardTransactionType"',
      'CREATE TABLE "LoyaltyPointEvent"',
      'CREATE TABLE "GiftCardTransaction"',
      '"redemptionCodeHash" TEXT NOT NULL',
      'protect_loyalty_point_event_ledger',
      'protect_gift_card_transaction_ledger',
      'guard_customer_loyalty_cache',
      'validate_gift_card_transaction',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("maps every exact ledger, relation, enum, and private credential field in Prisma", () => {
    for (const marker of [
      "enum LoyaltyPointEventType",
      "enum GiftCardStatus",
      "enum GiftCardTransactionType",
      "model LoyaltyPointEvent",
      "model GiftCardTransaction",
      "redemptionCodeHash",
      "redemptionCodeLast4",
      "loyaltyEvents",
      "giftCardTransactions",
      "gift_card",
    ]) {
      expect(schema).toContain(marker);
    }
    expect(dbSource).toContain("giftCardTransaction: {");
    expect(dbSource).toContain("amountMinor: true");
    expect(dbSource).toContain("balanceAfterMinor: true");
  });

  test("keeps staff permissions centralized and policy settings explicit", () => {
    expect(roles).toContain("LOYALTY_READ_ROLES");
    expect(roles).toContain("LOYALTY_MANAGEMENT_ROLES");
    for (const marker of [
      "loyaltyEnabled",
      "loyaltyPointsPerCurrencyUnit",
      "loyaltyRedemptionPointsPerCurrencyUnit",
      "loyaltyRedemptionIncrementPoints",
      "loyaltyMaxRedemptionPercent",
      "giftCardEnabled",
      "giftCardDefaultExpiryDays",
    ]) {
      expect(settings).toContain(marker);
      expect(settingsUi).toContain(marker);
    }
    expect(settingsUi).toContain("Loyalty & Gift-Card Policy");
    expect(settingsUi).toContain("سياسة الولاء وبطاقات الهدايا");
  });

  test("locks balances, hashes redemption credentials, and binds idempotent requests", () => {
    for (const marker of [
      'createHash("sha256")',
      "giftCardCodeHashes",
      "pg_advisory_xact_lock",
      "FOR UPDATE",
      "prepareCheckoutCredits",
      "appendCheckoutLedgers",
      "LOYALTY_IDEMPOTENCY_CONFLICT",
      "GIFT_CARD_IDEMPOTENCY_CONFLICT",
      "redemptionCode: null",
      "maskedCode",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("integrates trusted checkout and payment reversals without leaking full codes", () => {
    for (const marker of [
      "prepareCheckoutCredits",
      "storedValueCaptureMetadata",
      "appendCheckoutLedgers",
      "checkoutFingerprintFromRequest",
      "CHECKOUT_IDEMPOTENCY_CONFLICT",
    ]) {
      expect(checkout).toContain(marker);
    }
    expect(reversals).toContain("applyPaymentReversalLedgers");
    expect(reversals).toContain("giftCardRefundCents");
    expect(reversals).toContain("cashRefundCents");
    expect(lookup).toContain('scope: "gift-card-lookup"');
    expect(lookup).toContain('"Cache-Control": "no-store"');
    expect(lookup).not.toContain("redemptionCodeHash");
  });

  test("documents non-destructive accounting and the exact completion gate", () => {
    expect(design).toContain("append-only");
    expect(design).toContain("negative");
    expect(design).toContain("SHA-256");
    expect(design).toContain("Split tender");
    expect(design).toContain("representative existing-data adoption");
  });
});
