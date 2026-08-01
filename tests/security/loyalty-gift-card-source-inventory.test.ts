import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260801030000_add_loyalty_gift_card_ledgers/migration.sql"
);
const guardMigration = source(
  "prisma/migrations/20260801030001_guard_loyalty_customer_cache/migration.sql"
);
const schema = source("prisma/schema.prisma");
const dbSource = source("src/lib/db.ts");
const roles = source("src/lib/auth/roles.ts");
const service = source("src/lib/loyalty/ledger.ts");
const issueRoute = source("src/app/api/gift-cards/route.ts");
const mutationRoute = source("src/app/api/gift-cards/[id]/route.ts");
const checkout = source("src/app/api/pos/checkout/route.ts");
const reversals = source("src/lib/payments/reversals.ts");
const lookup = source("src/app/api/gift-cards/lookup/route.ts");
const settings = source("src/app/api/settings/route.ts");
const settingsUi = source("src/components/admin/tabs/SettingsTab.tsx");
const adminApp = source("src/components/admin/AdminApp.tsx");
const adminConsole = source("src/components/admin/LoyaltyGiftCardConsole.tsx");
const adminPage = source("src/app/admin/loyalty/page.tsx");
const rewards = source("src/components/restaurant/RewardsSection.tsx");
const publicLookup = source("src/components/restaurant/GiftCardLookup.tsx");
const packageJson = source("package.json");
const integration = source("tests/integration/p1-loyalty-gift-cards.ts");
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
      'ALTER COLUMN "redemptionCodeHash" SET NOT NULL',
      'apply_loyalty_point_event_insert',
      'protect_loyalty_point_event',
      'apply_gift_card_transaction_insert',
      'protect_gift_card_transaction',
      'protect_gift_card_financial_fields',
    ]) {
      expect(migration).toContain(marker);
    }

    for (const marker of [
      "guard_customer_loyalty_cache",
      "Customer_loyalty_cache_guard",
      "app.loyalty_ledger_write",
      "Customer loyalty balance is ledger-controlled",
    ]) {
      expect(guardMigration).toContain(marker);
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
    expect(settingsUi).toContain("function ToggleRow(");
  });

  test("locks balances, hashes credentials, and binds every replay to its payload", () => {
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

    for (const marker of [
      "assertIssueReplayMatches",
      "gift-card-issue:${key}",
      "parseMoneyToMinor(input.amount)",
      "GIFT_CARD_IDEMPOTENCY_CONFLICT",
    ]) {
      expect(issueRoute).toContain(marker);
    }
    for (const marker of [
      "assertMutationReplayMatches",
      "gift-card-mutation:${key}",
      "parseSignedMoneyToMinor",
      "GIFT_CARD_IDEMPOTENCY_CONFLICT",
    ]) {
      expect(mutationRoute).toContain(marker);
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
    expect(reversals).toContain("prepareReversalAllocation");
    expect(reversals).toContain("appendReversalLedgers");
    expect(reversals).toContain("giftCardRefundCents");
    expect(reversals).toContain("cashRefundCents");
    expect(lookup).toContain('scope: "gift-card-lookup"');
    expect(lookup).toContain('"Cache-Control": "no-store"');
    expect(lookup).toContain("reference: card.reference");
    expect(lookup).toContain("balance: card.balance");
    expect(lookup).not.toContain("redemptionCodeHash");
    expect(lookup).not.toContain("id: card.id");
  });

  test("ships discoverable bilingual customer and operator workflows", () => {
    expect(adminPage).toContain("LoyaltyGiftCardConsole");
    expect(adminApp).toContain('href="/admin/loyalty"');
    for (const marker of [
      'requestJson("/api/loyalty"',
      'requestJson<GiftCardAccount>',
      '"/api/gift-cards"',
      '"Idempotency-Key"',
      "redemptionCode",
      "Loyalty & Gift Cards",
      "الولاء وبطاقات الهدايا",
      "Show this code once",
      "اعرض الرمز مرة واحدة",
    ]) {
      expect(adminConsole).toContain(marker);
    }
    expect(rewards).toContain("GiftCardLookup");
    expect(publicLookup).toContain('fetch("/api/gift-cards/lookup"');
    expect(publicLookup).toContain("Check a gift card");
    expect(publicLookup).toContain("التحقق من بطاقة هدية");
    expect(publicLookup).not.toContain("purchaserName");
    expect(publicLookup).not.toContain("recipientName");
  });

  test("keeps the complete database-backed loyalty suite in the permanent gate", () => {
    expect(packageJson).toContain("bun tests/integration/p1-loyalty-gift-cards.ts");
    for (const marker of [
      "Gift-card issuance conflict",
      "Gift-card adjustment payload conflict",
      "Gift-card-only checkout",
      "Mixed checkout",
      "Loyalty redemption checkout",
      "concurrent redemptions cannot overdraw one card",
      "Negative loyalty balance refund",
      'UPDATE "Customer" SET "loyaltyPoints"',
      'DELETE FROM "GiftCardTransaction"',
      "Loyalty and gift-card assertions passed",
    ]) {
      expect(integration).toContain(marker);
    }
  });

  test("documents non-destructive accounting and the exact completion gate", () => {
    expect(design).toContain("append-only");
    expect(design).toContain("negative");
    expect(design).toContain("SHA-256");
    expect(design).toContain("gift-card-plus-cash checkout");
    expect(design).toContain("representative existing-data adoption");
  });
});
