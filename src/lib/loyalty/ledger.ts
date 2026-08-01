import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { StaffSession } from "@/lib/auth/session";
import type { AuditRequestContext } from "@/lib/audit";
import { writeAuditEvent } from "@/lib/audit";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

export const LOYALTY_READ_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
] as const;
export const LOYALTY_MANAGEMENT_ROLES = ["owner", "admin", "manager"] as const;

export const LOYALTY_ADJUSTMENT_REASON_CODES = [
  "service_recovery",
  "promotion",
  "migration_correction",
  "operator_error",
  "customer_support",
  "other",
] as const;

export const GIFT_CARD_ADJUSTMENT_REASON_CODES = [
  "top_up",
  "service_recovery",
  "migration_correction",
  "operator_error",
  "fraud_suspected",
  "customer_support",
  "other",
] as const;

export type LoyaltyAdjustmentReasonCode =
  (typeof LOYALTY_ADJUSTMENT_REASON_CODES)[number];
export type GiftCardAdjustmentReasonCode =
  (typeof GIFT_CARD_ADJUSTMENT_REASON_CODES)[number];

type LedgerSqlClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

type LedgerActor = Pick<StaffSession, "id" | "name" | "role" | "sessionId">;

type LoyaltyPolicyRow = {
  currency: string;
  loyaltyEnabled: boolean;
  loyaltyPointsPerCurrencyUnit: number;
  loyaltyRedemptionPointsPerCurrencyUnit: number;
  loyaltyRedemptionIncrementPoints: number;
  loyaltyMaxRedemptionPercent: number;
  giftCardEnabled: boolean;
  giftCardDefaultExpiryDays: number;
};

type LockedOrderRow = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  paymentStatus: string;
  subtotalMinor: bigint;
  discountAmountMinor: bigint;
  taxAmountMinor: bigint;
  deliveryFeeMinor: bigint;
  tipAmountMinor: bigint;
  totalMinor: bigint;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  totalSpentMinor: bigint;
  visits: number;
  createdAt: Date;
  updatedAt: Date;
};

type LoyaltyEventRow = {
  id: string;
  idempotencyKey: string;
  customerId: string;
  eventType:
    | "opening_balance"
    | "earn"
    | "redeem"
    | "earn_reversal"
    | "redeem_restore"
    | "adjustment";
  pointsDelta: number;
  balanceAfter: number;
  orderId: string | null;
  paymentEventId: string | null;
  parentEventId: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  reasonCode: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
};

type GiftCardRow = {
  id: string;
  code: string;
  redemptionCodeHash: string;
  redemptionCodeLast4: string;
  amountMinor: bigint;
  balanceMinor: bigint;
  purchaserName: string;
  recipientName: string;
  message: string | null;
  template: string;
  status: "active" | "exhausted" | "voided" | "expired";
  currency: string;
  issuedAt: Date;
  expiresAt: Date | null;
  voidedAt: Date | null;
  issuedById: string | null;
  issuedByName: string;
  createdAt: Date;
  updatedAt: Date;
};

type GiftCardTransactionRow = {
  id: string;
  idempotencyKey: string;
  giftCardId: string;
  transactionType:
    | "opening_balance"
    | "issue"
    | "redeem"
    | "refund"
    | "adjustment"
    | "void"
    | "expiration";
  amountMinor: bigint;
  balanceAfterMinor: bigint;
  orderId: string | null;
  paymentEventId: string | null;
  parentTransactionId: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  reasonCode: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
};

export type StoredValueCaptureMetadata = {
  version: 1;
  customerId: string | null;
  originalOrderTotalCents: number;
  capturedAmountCents: number;
  cashAmountCents: number;
  giftCardAmountCents: number;
  giftCardId: string | null;
  giftCardTransactionId: string | null;
  giftCardLast4: string | null;
  loyaltyRedeemedPoints: number;
  loyaltyRedemptionValueCents: number;
  loyaltyRedeemEventId: string | null;
  loyaltyEarnedPoints: number;
  loyaltyEarnEventId: string | null;
  checkoutFingerprint: string;
};

export type CheckoutCreditPlan = {
  order: LockedOrderRow;
  policy: LoyaltyPolicyRow;
  customer: CustomerRow | null;
  giftCard: GiftCardRow | null;
  originalOrderTotalMinor: bigint;
  captureAmountMinor: bigint;
  cashAmountMinor: bigint;
  giftCardAmountMinor: bigint;
  loyaltyRedemptionValueMinor: bigint;
  loyaltyRedeemedPoints: number;
  loyaltyEarnedPoints: number;
  paymentMethod: "cash" | "gift_card" | "split";
  checkoutFingerprint: string;
  paymentEventId: string;
  giftCardTransactionId: string | null;
  loyaltyRedeemEventId: string | null;
  loyaltyEarnEventId: string | null;
};

export type ReversalAllocationPlan = {
  metadata: StoredValueCaptureMetadata;
  giftCardRefundCents: number;
  cashRefundCents: number;
  loyaltyEarnReversalPoints: number;
  loyaltyRedeemRestorePoints: number;
};

export class LoyaltyLedgerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "LoyaltyLedgerError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function ledgerId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function safeNumber(value: bigint, label: string): number {
  if (
    value < BigInt(Number.MIN_SAFE_INTEGER) ||
    value > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new LoyaltyLedgerError(
      `${label} cannot be represented safely`,
      "UNSAFE_LEDGER_VALUE",
      500
    );
  }
  return Number(value);
}

export function minorToNumber(value: bigint): number {
  return safeNumber(value, "Currency amount") / 100;
}

export function parseMoneyToMinor(value: number | string): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    CURRENCY_MINOR_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export function parseSignedMoneyToMinor(value: number | string): bigint {
  const text = String(value).trim();
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const parsed = parseMoneyToMinor(unsigned);
  return negative ? -parsed : parsed;
}

function normalizeGiftCardCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function giftCardCodeHashes(value: string): string[] {
  const trimmed = value.trim();
  const normalized = normalizeGiftCardCode(trimmed);
  return Array.from(
    new Set([hashText(trimmed), hashText(normalized)].filter(Boolean))
  );
}

function generateGiftCardSecret(): string {
  const raw = randomBytes(12).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") || raw;
}

function generateGiftCardReference(): string {
  const year = new Date().getUTCFullYear();
  return `GC-${year}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function normalizeReason(value: string): string {
  return value.trim().slice(0, 2_000);
}

function normalizeReasonCode(value: string): string {
  return value.trim().slice(0, 80);
}

async function advisoryLock(
  client: LedgerSqlClient,
  namespace: string,
  key: string
) {
  await client.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${namespace}:${key}`}, 0)
    )
  `);
}

export async function readLoyaltyPolicy(
  client: LedgerSqlClient
): Promise<LoyaltyPolicyRow> {
  const rows = await client.$queryRaw<LoyaltyPolicyRow[]>(Prisma.sql`
    SELECT
      "currency", "loyaltyEnabled", "loyaltyPointsPerCurrencyUnit",
      "loyaltyRedemptionPointsPerCurrencyUnit",
      "loyaltyRedemptionIncrementPoints", "loyaltyMaxRedemptionPercent",
      "giftCardEnabled", "giftCardDefaultExpiryDays"
    FROM "RestaurantSettings"
    WHERE "id" = '1'
    LIMIT 1
  `);
  const policy = rows[0];
  if (!policy) {
    throw new LoyaltyLedgerError(
      "Restaurant loyalty settings are missing",
      "LOYALTY_POLICY_MISSING",
      500
    );
  }
  return policy;
}

async function lockOrder(
  client: LedgerSqlClient,
  orderId: string
): Promise<LockedOrderRow> {
  const rows = await client.$queryRaw<LockedOrderRow[]>(Prisma.sql`
    SELECT
      "id", "orderNumber", "customerId", "paymentStatus"::text AS "paymentStatus",
      "subtotalMinor", "discountAmountMinor", "taxAmountMinor",
      "deliveryFeeMinor", "tipAmountMinor", "totalMinor"
    FROM "Order"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `);
  const order = rows[0];
  if (!order) {
    throw new LoyaltyLedgerError("Order not found", "ORDER_NOT_FOUND", 404);
  }
  return order;
}

async function lockCustomer(
  client: LedgerSqlClient,
  customerId: string
): Promise<CustomerRow> {
  const rows = await client.$queryRaw<CustomerRow[]>(Prisma.sql`
    SELECT
      "id", "name", "phone", "email", "loyaltyPoints", "totalSpentMinor",
      "visits", "createdAt", "updatedAt"
    FROM "Customer"
    WHERE "id" = ${customerId}
    FOR UPDATE
  `);
  const customer = rows[0];
  if (!customer) {
    throw new LoyaltyLedgerError("Customer not found", "CUSTOMER_NOT_FOUND", 404);
  }
  return customer;
}

async function readGiftCardByCode(
  client: LedgerSqlClient,
  code: string,
  lock = false
): Promise<GiftCardRow | null> {
  const hashes = giftCardCodeHashes(code);
  if (hashes.length === 0) return null;
  const locking = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw<GiftCardRow[]>(Prisma.sql`
    SELECT
      "id", "code", "redemptionCodeHash", "redemptionCodeLast4",
      "amountMinor", "balanceMinor", "purchaserName", "recipientName",
      "message", "template", "status"::text AS "status", "currency",
      "issuedAt", "expiresAt", "voidedAt", "issuedById", "issuedByName",
      "createdAt", "updatedAt"
    FROM "GiftCard"
    WHERE "redemptionCodeHash" IN (${Prisma.join(hashes)})
    LIMIT 1
    ${locking}
  `);
  return rows[0] || null;
}

async function readGiftCardById(
  client: LedgerSqlClient,
  cardId: string,
  lock = false
): Promise<GiftCardRow | null> {
  const locking = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw<GiftCardRow[]>(Prisma.sql`
    SELECT
      "id", "code", "redemptionCodeHash", "redemptionCodeLast4",
      "amountMinor", "balanceMinor", "purchaserName", "recipientName",
      "message", "template", "status"::text AS "status", "currency",
      "issuedAt", "expiresAt", "voidedAt", "issuedById", "issuedByName",
      "createdAt", "updatedAt"
    FROM "GiftCard"
    WHERE "id" = ${cardId}
    LIMIT 1
    ${locking}
  `);
  return rows[0] || null;
}

function loyaltyEventDto(row: LoyaltyEventRow) {
  return {
    id: row.id,
    eventType: row.eventType,
    pointsDelta: row.pointsDelta,
    balanceAfter: row.balanceAfter,
    orderId: row.orderId,
    paymentEventId: row.paymentEventId,
    originalEventId: row.parentEventId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    reasonCode: row.reasonCode || null,
    reason: row.reason,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

function giftCardTransactionDto(row: GiftCardTransactionRow) {
  return {
    id: row.id,
    transactionType: row.transactionType,
    amount: minorToNumber(row.amountMinor),
    balanceAfter: minorToNumber(row.balanceAfterMinor),
    orderId: row.orderId,
    paymentEventId: row.paymentEventId,
    originalTransactionId: row.parentTransactionId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    reasonCode: row.reasonCode || null,
    reason: row.reason,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

function giftCardDto(row: GiftCardRow, includePrivate = false) {
  return {
    id: row.id,
    reference: row.code,
    codeLast4: row.redemptionCodeLast4,
    maskedCode: `•••• ${row.redemptionCodeLast4}`,
    amount: minorToNumber(row.amountMinor),
    balance: minorToNumber(row.balanceMinor),
    status: row.status,
    currency: row.currency,
    expiresAt: row.expiresAt,
    issuedAt: row.issuedAt,
    template: row.template,
    ...(includePrivate
      ? {
          purchaserName: row.purchaserName,
          recipientName: row.recipientName,
          message: row.message,
          issuedById: row.issuedById,
          issuedByName: row.issuedByName,
          voidedAt: row.voidedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }
      : {}),
  };
}

export async function readLoyaltyAccount(
  client: LedgerSqlClient,
  customerId: string,
  limit = 100
) {
  const customerRows = await client.$queryRaw<CustomerRow[]>(Prisma.sql`
    SELECT
      "id", "name", "phone", "email", "loyaltyPoints", "totalSpentMinor",
      "visits", "createdAt", "updatedAt"
    FROM "Customer"
    WHERE "id" = ${customerId}
    LIMIT 1
  `);
  const customer = customerRows[0];
  if (!customer) {
    throw new LoyaltyLedgerError("Customer not found", "CUSTOMER_NOT_FOUND", 404);
  }
  const boundedLimit = Math.max(1, Math.min(500, limit));
  const events = await client.$queryRaw<LoyaltyEventRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "customerId", "eventType"::text AS "eventType",
      "pointsDelta", "balanceAfter", "orderId", "paymentEventId",
      "parentEventId", "actorId", "actorName", "actorRole", "reasonCode",
      "reason", "metadata", "occurredAt", "createdAt"
    FROM "LoyaltyPointEvent"
    WHERE "customerId" = ${customerId}
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT ${boundedLimit}
  `);
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      loyaltyPoints: customer.loyaltyPoints,
      totalSpent: minorToNumber(customer.totalSpentMinor),
      visits: customer.visits,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    events: events.map(loyaltyEventDto),
  };
}

export async function readGiftCardAccount(
  client: LedgerSqlClient,
  cardId: string,
  limit = 100
) {
  const card = await readGiftCardById(client, cardId);
  if (!card) {
    throw new LoyaltyLedgerError("Gift card not found", "GIFT_CARD_NOT_FOUND", 404);
  }
  const boundedLimit = Math.max(1, Math.min(500, limit));
  const transactions = await client.$queryRaw<GiftCardTransactionRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "giftCardId",
      "transactionType"::text AS "transactionType", "amountMinor",
      "balanceAfterMinor", "orderId", "paymentEventId", "parentTransactionId",
      "actorId", "actorName", "actorRole", "reasonCode", "reason",
      "metadata", "occurredAt", "createdAt"
    FROM "GiftCardTransaction"
    WHERE "giftCardId" = ${cardId}
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT ${boundedLimit}
  `);
  return {
    card: giftCardDto(card, true),
    transactions: transactions.map(giftCardTransactionDto),
  };
}

export async function searchGiftCards(
  client: LedgerSqlClient,
  query: string,
  limit = 100
) {
  const term = query.trim();
  const boundedLimit = Math.max(1, Math.min(300, limit));
  const pattern = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const cards = await client.$queryRaw<GiftCardRow[]>(Prisma.sql`
    SELECT
      "id", "code", "redemptionCodeHash", "redemptionCodeLast4",
      "amountMinor", "balanceMinor", "purchaserName", "recipientName",
      "message", "template", "status"::text AS "status", "currency",
      "issuedAt", "expiresAt", "voidedAt", "issuedById", "issuedByName",
      "createdAt", "updatedAt"
    FROM "GiftCard"
    WHERE
      ${term === ""} OR
      "code" ILIKE ${pattern} ESCAPE '\\' OR
      "redemptionCodeLast4" ILIKE ${pattern} ESCAPE '\\' OR
      "purchaserName" ILIKE ${pattern} ESCAPE '\\' OR
      "recipientName" ILIKE ${pattern} ESCAPE '\\'
    ORDER BY "createdAt" DESC
    LIMIT ${boundedLimit}
  `);
  return cards.map((card) => giftCardDto(card, true));
}

export async function lookupGiftCard(
  client: LedgerSqlClient,
  code: string
) {
  const card = await readGiftCardByCode(client, code);
  if (!card) {
    throw new LoyaltyLedgerError(
      "Gift card not found",
      "GIFT_CARD_NOT_FOUND",
      404
    );
  }
  return giftCardDto(card, false);
}

function checkoutFingerprint(input: {
  orderId: string;
  loyaltyPoints: number;
  giftCardHash: string | null;
  giftCardAmountMinor: bigint | null;
  captureAmountMinor: bigint;
}): string {
  return hashText(
    JSON.stringify({
      orderId: input.orderId,
      loyaltyPoints: input.loyaltyPoints,
      giftCardHash: input.giftCardHash,
      giftCardAmountMinor: input.giftCardAmountMinor?.toString() || null,
      captureAmountMinor: input.captureAmountMinor.toString(),
    })
  );
}

export function checkoutFingerprintFromRequest(input: {
  orderId: string;
  loyaltyPoints?: number;
  giftCardCode?: string;
  giftCardAmount?: number;
  captureAmountMinor: bigint;
}): string {
  const hashes = input.giftCardCode
    ? giftCardCodeHashes(input.giftCardCode)
    : [];
  return checkoutFingerprint({
    orderId: input.orderId,
    loyaltyPoints: input.loyaltyPoints || 0,
    giftCardHash: hashes[1] || hashes[0] || null,
    giftCardAmountMinor:
      input.giftCardAmount === undefined
        ? null
        : parseMoneyToMinor(input.giftCardAmount),
    captureAmountMinor: input.captureAmountMinor,
  });
}

export async function prepareCheckoutCredits(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    loyaltyPoints?: number;
    giftCardCode?: string;
    giftCardAmount?: number;
  }
): Promise<CheckoutCreditPlan> {
  const order = await lockOrder(tx, input.orderId);
  if (order.paymentStatus !== "unpaid") {
    throw new LoyaltyLedgerError(
      "Only an unpaid order can apply loyalty or gift-card value",
      "ORDER_ALREADY_PAID",
      409
    );
  }
  const policy = await readLoyaltyPolicy(tx);
  const originalOrderTotalMinor = order.totalMinor;
  let customer: CustomerRow | null = null;
  if (order.customerId) customer = await lockCustomer(tx, order.customerId);

  const requestedPoints = input.loyaltyPoints || 0;
  if (!Number.isInteger(requestedPoints) || requestedPoints < 0) {
    throw new LoyaltyLedgerError(
      "Loyalty points must be a non-negative whole number",
      "INVALID_LOYALTY_REDEMPTION",
      400
    );
  }
  if (requestedPoints > 0 && !policy.loyaltyEnabled) {
    throw new LoyaltyLedgerError(
      "Loyalty redemption is disabled",
      "LOYALTY_DISABLED",
      409
    );
  }
  if (requestedPoints > 0 && !customer) {
    throw new LoyaltyLedgerError(
      "The order is not linked to a loyalty customer",
      "LOYALTY_CUSTOMER_REQUIRED",
      409
    );
  }
  if (
    requestedPoints > 0 &&
    requestedPoints % policy.loyaltyRedemptionIncrementPoints !== 0
  ) {
    throw new LoyaltyLedgerError(
      "Loyalty redemption must use a configured point increment",
      "LOYALTY_INCREMENT_REQUIRED",
      400,
      { increment: policy.loyaltyRedemptionIncrementPoints }
    );
  }
  if (requestedPoints > 0 && customer && customer.loyaltyPoints < requestedPoints) {
    throw new LoyaltyLedgerError(
      "The customer does not have enough loyalty points",
      "LOYALTY_BALANCE_INSUFFICIENT",
      409,
      { available: customer.loyaltyPoints }
    );
  }

  let loyaltyRedemptionValueMinor = BigInt(0);
  if (requestedPoints > 0) {
    loyaltyRedemptionValueMinor =
      (BigInt(requestedPoints) * BigInt(100)) /
      BigInt(policy.loyaltyRedemptionPointsPerCurrencyUnit);
    if (loyaltyRedemptionValueMinor <= BigInt(0)) {
      throw new LoyaltyLedgerError(
        "The selected points do not create a redeemable value",
        "LOYALTY_VALUE_TOO_SMALL",
        400
      );
    }
    const merchandiseRemaining = order.subtotalMinor - order.discountAmountMinor;
    const percentageLimit =
      (merchandiseRemaining * BigInt(policy.loyaltyMaxRedemptionPercent)) /
      BigInt(100);
    const maximum = merchandiseRemaining < percentageLimit
      ? merchandiseRemaining
      : percentageLimit;
    if (loyaltyRedemptionValueMinor > maximum) {
      throw new LoyaltyLedgerError(
        "Loyalty redemption exceeds the eligible merchandise amount",
        "LOYALTY_REDEMPTION_EXCEEDS_ELIGIBLE",
        409,
        { maximum: minorToNumber(maximum) }
      );
    }

    const nextDiscount = order.discountAmountMinor + loyaltyRedemptionValueMinor;
    const nextTotal = order.totalMinor - loyaltyRedemptionValueMinor;
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Order"
      SET
        "discountAmount" = ${minorToNumber(nextDiscount)},
        "discountAmountMinor" = ${nextDiscount},
        "total" = ${minorToNumber(nextTotal)},
        "totalMinor" = ${nextTotal},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${order.id}
    `);
    order.discountAmountMinor = nextDiscount;
    order.totalMinor = nextTotal;
  }

  let giftCard: GiftCardRow | null = null;
  let giftCardAmountMinor = BigInt(0);
  let selectedGiftCardHash: string | null = null;
  if (input.giftCardCode?.trim()) {
    if (!policy.giftCardEnabled) {
      throw new LoyaltyLedgerError(
        "Gift-card redemption is disabled",
        "GIFT_CARD_DISABLED",
        409
      );
    }
    giftCard = await readGiftCardByCode(tx, input.giftCardCode, true);
    if (!giftCard) {
      throw new LoyaltyLedgerError(
        "Gift card is invalid or unavailable",
        "GIFT_CARD_NOT_FOUND",
        404
      );
    }
    if (giftCard.status !== "active") {
      throw new LoyaltyLedgerError(
        "Gift card is not active",
        "GIFT_CARD_NOT_ACTIVE",
        409,
        { status: giftCard.status }
      );
    }
    if (giftCard.expiresAt && giftCard.expiresAt.getTime() <= Date.now()) {
      throw new LoyaltyLedgerError(
        "Gift card has expired",
        "GIFT_CARD_EXPIRED",
        409
      );
    }
    const requestedAmount =
      input.giftCardAmount === undefined
        ? null
        : parseMoneyToMinor(input.giftCardAmount);
    if (requestedAmount !== null && requestedAmount <= BigInt(0)) {
      throw new LoyaltyLedgerError(
        "Gift-card amount must be greater than zero",
        "INVALID_GIFT_CARD_AMOUNT",
        400
      );
    }
    giftCardAmountMinor = requestedAmount ?? giftCard.balanceMinor;
    if (giftCardAmountMinor > giftCard.balanceMinor) {
      throw new LoyaltyLedgerError(
        "Gift card does not have enough balance",
        "GIFT_CARD_BALANCE_INSUFFICIENT",
        409,
        { available: minorToNumber(giftCard.balanceMinor) }
      );
    }
    if (giftCardAmountMinor > order.totalMinor) {
      giftCardAmountMinor = order.totalMinor;
    }
    selectedGiftCardHash = giftCard.redemptionCodeHash;
  } else if (input.giftCardAmount !== undefined) {
    throw new LoyaltyLedgerError(
      "Gift-card code is required when an amount is supplied",
      "GIFT_CARD_CODE_REQUIRED",
      400
    );
  }

  const captureAmountMinor = order.totalMinor;
  const cashAmountMinor = captureAmountMinor - giftCardAmountMinor;
  const paymentMethod =
    giftCardAmountMinor === BigInt(0)
      ? "cash"
      : cashAmountMinor === BigInt(0)
        ? "gift_card"
        : "split";

  const eligibleEarnMinor = order.subtotalMinor - order.discountAmountMinor;
  const loyaltyEarnedPoints =
    customer && policy.loyaltyEnabled && policy.loyaltyPointsPerCurrencyUnit > 0
      ? safeNumber(
          (eligibleEarnMinor * BigInt(policy.loyaltyPointsPerCurrencyUnit)) /
            BigInt(100),
          "Earned loyalty points"
        )
      : 0;

  const paymentEventId = ledgerId("payment_event");
  const fingerprint = checkoutFingerprint({
    orderId: order.id,
    loyaltyPoints: requestedPoints,
    giftCardHash: selectedGiftCardHash,
    giftCardAmountMinor:
      input.giftCardAmount === undefined
        ? null
        : parseMoneyToMinor(input.giftCardAmount),
    captureAmountMinor,
  });

  return {
    order,
    policy,
    customer,
    giftCard,
    originalOrderTotalMinor,
    captureAmountMinor,
    cashAmountMinor,
    giftCardAmountMinor,
    loyaltyRedemptionValueMinor,
    loyaltyRedeemedPoints: requestedPoints,
    loyaltyEarnedPoints,
    paymentMethod,
    checkoutFingerprint: fingerprint,
    paymentEventId,
    giftCardTransactionId:
      giftCardAmountMinor > BigInt(0) ? ledgerId("gift_card_tx") : null,
    loyaltyRedeemEventId:
      requestedPoints > 0 ? ledgerId("loyalty_event") : null,
    loyaltyEarnEventId:
      loyaltyEarnedPoints > 0 ? ledgerId("loyalty_event") : null,
  };
}

export function storedValueCaptureMetadata(
  plan: CheckoutCreditPlan
): StoredValueCaptureMetadata {
  return {
    version: 1,
    customerId: plan.order.customerId,
    originalOrderTotalCents: safeNumber(
      plan.originalOrderTotalMinor,
      "Original order total"
    ),
    capturedAmountCents: safeNumber(plan.captureAmountMinor, "Captured amount"),
    cashAmountCents: safeNumber(plan.cashAmountMinor, "Cash amount"),
    giftCardAmountCents: safeNumber(
      plan.giftCardAmountMinor,
      "Gift-card amount"
    ),
    giftCardId: plan.giftCard?.id || null,
    giftCardTransactionId: plan.giftCardTransactionId,
    giftCardLast4: plan.giftCard?.redemptionCodeLast4 || null,
    loyaltyRedeemedPoints: plan.loyaltyRedeemedPoints,
    loyaltyRedemptionValueCents: safeNumber(
      plan.loyaltyRedemptionValueMinor,
      "Loyalty redemption value"
    ),
    loyaltyRedeemEventId: plan.loyaltyRedeemEventId,
    loyaltyEarnedPoints: plan.loyaltyEarnedPoints,
    loyaltyEarnEventId: plan.loyaltyEarnEventId,
    checkoutFingerprint: plan.checkoutFingerprint,
  };
}

async function insertLoyaltyEvent(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    idempotencyKey: string;
    customerId: string;
    eventType: LoyaltyEventRow["eventType"];
    pointsDelta: number;
    orderId?: string | null;
    paymentEventId?: string | null;
    parentEventId?: string | null;
    actor: LedgerActor;
    reasonCode?: string;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<LoyaltyEventRow> {
  const metadata = JSON.stringify(input.metadata || {});
  const rows = await tx.$queryRaw<LoyaltyEventRow[]>(Prisma.sql`
    INSERT INTO "LoyaltyPointEvent" (
      "id", "idempotencyKey", "customerId", "eventType", "pointsDelta",
      "orderId", "paymentEventId", "parentEventId", "actorId", "actorName",
      "actorRole", "reasonCode", "reason", "metadata"
    ) VALUES (
      ${input.id}, ${input.idempotencyKey}, ${input.customerId},
      CAST(${input.eventType} AS "LoyaltyPointEventType"), ${input.pointsDelta},
      ${input.orderId || null}, ${input.paymentEventId || null},
      ${input.parentEventId || null}, ${input.actor.id}, ${input.actor.name},
      ${input.actor.role}, ${input.reasonCode || ""}, ${input.reason || null},
      CAST(${metadata} AS jsonb)
    )
    RETURNING
      "id", "idempotencyKey", "customerId", "eventType"::text AS "eventType",
      "pointsDelta", "balanceAfter", "orderId", "paymentEventId",
      "parentEventId", "actorId", "actorName", "actorRole", "reasonCode",
      "reason", "metadata", "occurredAt", "createdAt"
  `);
  const row = rows[0];
  if (!row) {
    throw new LoyaltyLedgerError(
      "Unable to append loyalty event",
      "LOYALTY_EVENT_CREATE_FAILED",
      500
    );
  }
  return row;
}

async function insertGiftCardTransaction(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    idempotencyKey: string;
    giftCardId: string;
    transactionType: GiftCardTransactionRow["transactionType"];
    amountMinor: bigint;
    orderId?: string | null;
    paymentEventId?: string | null;
    parentTransactionId?: string | null;
    actor: LedgerActor;
    reasonCode?: string;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<GiftCardTransactionRow> {
  const metadata = JSON.stringify(input.metadata || {});
  const rows = await tx.$queryRaw<GiftCardTransactionRow[]>(Prisma.sql`
    INSERT INTO "GiftCardTransaction" (
      "id", "idempotencyKey", "giftCardId", "transactionType", "amountMinor",
      "orderId", "paymentEventId", "parentTransactionId", "actorId",
      "actorName", "actorRole", "reasonCode", "reason", "metadata"
    ) VALUES (
      ${input.id}, ${input.idempotencyKey}, ${input.giftCardId},
      CAST(${input.transactionType} AS "GiftCardTransactionType"),
      ${input.amountMinor}, ${input.orderId || null},
      ${input.paymentEventId || null}, ${input.parentTransactionId || null},
      ${input.actor.id}, ${input.actor.name}, ${input.actor.role},
      ${input.reasonCode || ""}, ${input.reason || null},
      CAST(${metadata} AS jsonb)
    )
    RETURNING
      "id", "idempotencyKey", "giftCardId",
      "transactionType"::text AS "transactionType", "amountMinor",
      "balanceAfterMinor", "orderId", "paymentEventId", "parentTransactionId",
      "actorId", "actorName", "actorRole", "reasonCode", "reason",
      "metadata", "occurredAt", "createdAt"
  `);
  const row = rows[0];
  if (!row) {
    throw new LoyaltyLedgerError(
      "Unable to append gift-card transaction",
      "GIFT_CARD_TRANSACTION_CREATE_FAILED",
      500
    );
  }
  return row;
}

export async function appendCheckoutLedgers(
  tx: Prisma.TransactionClient,
  input: {
    plan: CheckoutCreditPlan;
    actor: LedgerActor;
    context: AuditRequestContext;
  }
) {
  const { plan } = input;
  let giftCardTransaction: GiftCardTransactionRow | null = null;
  let loyaltyRedemption: LoyaltyEventRow | null = null;
  let loyaltyEarning: LoyaltyEventRow | null = null;

  if (
    plan.giftCard &&
    plan.giftCardTransactionId &&
    plan.giftCardAmountMinor > BigInt(0)
  ) {
    giftCardTransaction = await insertGiftCardTransaction(tx, {
      id: plan.giftCardTransactionId,
      idempotencyKey: `gift-card-redeem:${plan.paymentEventId}:${plan.giftCard.id}`,
      giftCardId: plan.giftCard.id,
      transactionType: "redeem",
      amountMinor: -plan.giftCardAmountMinor,
      orderId: plan.order.id,
      paymentEventId: plan.paymentEventId,
      actor: input.actor,
      reasonCode: "checkout",
      reason: `Applied to ${plan.order.orderNumber}`,
      metadata: {
        orderNumber: plan.order.orderNumber,
        codeLast4: plan.giftCard.redemptionCodeLast4,
      },
    });
    await writeAuditEvent(tx, {
      actor: input.actor,
      action: "gift-card.redeem",
      entityType: "GiftCardTransaction",
      entityId: giftCardTransaction.id,
      context: input.context,
      metadata: {
        giftCardId: plan.giftCard.id,
        reference: plan.giftCard.code,
        codeLast4: plan.giftCard.redemptionCodeLast4,
        orderId: plan.order.id,
        orderNumber: plan.order.orderNumber,
        amountMinor: plan.giftCardAmountMinor.toString(),
        balanceAfterMinor: giftCardTransaction.balanceAfterMinor.toString(),
      },
    });
  }

  if (plan.customer && plan.loyaltyRedeemEventId && plan.loyaltyRedeemedPoints > 0) {
    loyaltyRedemption = await insertLoyaltyEvent(tx, {
      id: plan.loyaltyRedeemEventId,
      idempotencyKey: `loyalty-redeem:${plan.paymentEventId}`,
      customerId: plan.customer.id,
      eventType: "redeem",
      pointsDelta: -plan.loyaltyRedeemedPoints,
      orderId: plan.order.id,
      paymentEventId: plan.paymentEventId,
      actor: input.actor,
      reasonCode: "checkout",
      reason: `Redeemed on ${plan.order.orderNumber}`,
      metadata: {
        orderNumber: plan.order.orderNumber,
        valueMinor: plan.loyaltyRedemptionValueMinor.toString(),
      },
    });
  }

  if (plan.customer && plan.loyaltyEarnEventId && plan.loyaltyEarnedPoints > 0) {
    loyaltyEarning = await insertLoyaltyEvent(tx, {
      id: plan.loyaltyEarnEventId,
      idempotencyKey: `loyalty-earn:${plan.paymentEventId}`,
      customerId: plan.customer.id,
      eventType: "earn",
      pointsDelta: plan.loyaltyEarnedPoints,
      orderId: plan.order.id,
      paymentEventId: plan.paymentEventId,
      actor: input.actor,
      reasonCode: "successful_capture",
      reason: `Earned from ${plan.order.orderNumber}`,
      metadata: {
        orderNumber: plan.order.orderNumber,
        eligibleSpendMinor: (
          plan.order.subtotalMinor - plan.order.discountAmountMinor
        ).toString(),
        pointsPerCurrencyUnit: plan.policy.loyaltyPointsPerCurrencyUnit,
      },
    });
  }

  if (plan.customer) {
    const nextTotalSpent = plan.customer.totalSpentMinor + plan.captureAmountMinor;
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Customer"
      SET
        "totalSpent" = ${minorToNumber(nextTotalSpent)},
        "totalSpentMinor" = ${nextTotalSpent},
        "visits" = "visits" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${plan.customer.id}
    `);
    await writeAuditEvent(tx, {
      actor: input.actor,
      action: "loyalty.capture.apply",
      entityType: "Customer",
      entityId: plan.customer.id,
      context: input.context,
      metadata: {
        orderId: plan.order.id,
        orderNumber: plan.order.orderNumber,
        capturedAmountMinor: plan.captureAmountMinor.toString(),
        redeemedPoints: plan.loyaltyRedeemedPoints,
        redemptionValueMinor: plan.loyaltyRedemptionValueMinor.toString(),
        earnedPoints: plan.loyaltyEarnedPoints,
        loyaltyRedeemEventId: loyaltyRedemption?.id || null,
        loyaltyEarnEventId: loyaltyEarning?.id || null,
      },
    });
  }

  return {
    giftCardTransaction: giftCardTransaction
      ? giftCardTransactionDto(giftCardTransaction)
      : null,
    loyaltyRedemption: loyaltyRedemption
      ? loyaltyEventDto(loyaltyRedemption)
      : null,
    loyaltyEarning: loyaltyEarning ? loyaltyEventDto(loyaltyEarning) : null,
  };
}

export function parseStoredValueCaptureMetadata(
  metadata: Prisma.JsonValue | null | undefined
): StoredValueCaptureMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      version: 1,
      customerId: null,
      originalOrderTotalCents: 0,
      capturedAmountCents: 0,
      cashAmountCents: 0,
      giftCardAmountCents: 0,
      giftCardId: null,
      giftCardTransactionId: null,
      giftCardLast4: null,
      loyaltyRedeemedPoints: 0,
      loyaltyRedemptionValueCents: 0,
      loyaltyRedeemEventId: null,
      loyaltyEarnedPoints: 0,
      loyaltyEarnEventId: null,
      checkoutFingerprint: "",
    };
  }
  const value = metadata as Record<string, unknown>;
  const stored =
    value.storedValue &&
    typeof value.storedValue === "object" &&
    !Array.isArray(value.storedValue)
      ? (value.storedValue as Record<string, unknown>)
      : value;
  const number = (key: string) =>
    typeof stored[key] === "number" && Number.isFinite(stored[key])
      ? Math.trunc(stored[key] as number)
      : 0;
  const string = (key: string) =>
    typeof stored[key] === "string" ? (stored[key] as string) : null;
  return {
    version: 1,
    customerId: string("customerId"),
    originalOrderTotalCents: number("originalOrderTotalCents"),
    capturedAmountCents: number("capturedAmountCents"),
    cashAmountCents: number("cashAmountCents"),
    giftCardAmountCents: number("giftCardAmountCents"),
    giftCardId: string("giftCardId"),
    giftCardTransactionId: string("giftCardTransactionId"),
    giftCardLast4: string("giftCardLast4"),
    loyaltyRedeemedPoints: number("loyaltyRedeemedPoints"),
    loyaltyRedemptionValueCents: number("loyaltyRedemptionValueCents"),
    loyaltyRedeemEventId: string("loyaltyRedeemEventId"),
    loyaltyEarnedPoints: number("loyaltyEarnedPoints"),
    loyaltyEarnEventId: string("loyaltyEarnEventId"),
    checkoutFingerprint: string("checkoutFingerprint") || "",
  };
}

function cumulativeTarget(
  total: number,
  totalReversedCents: number,
  capturedCents: number
): number {
  if (total <= 0 || capturedCents <= 0) return 0;
  if (totalReversedCents >= capturedCents) return total;
  return Number(
    (BigInt(total) * BigInt(totalReversedCents)) / BigInt(capturedCents)
  );
}

export async function prepareReversalAllocation(
  tx: Prisma.TransactionClient,
  input: {
    captureId: string;
    captureAmountCents: number;
    captureMetadata: Prisma.JsonValue | null;
    reversalAmountCents: number;
    totalReversedCents: number;
  }
): Promise<ReversalAllocationPlan> {
  const metadata = parseStoredValueCaptureMetadata(input.captureMetadata);
  const capturedCents =
    metadata.capturedAmountCents > 0
      ? metadata.capturedAmountCents
      : input.captureAmountCents;

  let previousGiftCardRefundCents = 0;
  if (metadata.giftCardTransactionId) {
    const rows = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM("amountMinor"), 0)::bigint AS "total"
      FROM "GiftCardTransaction"
      WHERE "parentTransactionId" = ${metadata.giftCardTransactionId}
        AND "transactionType" = 'refund'
    `);
    previousGiftCardRefundCents = safeNumber(
      rows[0]?.total || BigInt(0),
      "Gift-card refund total"
    );
  }
  const targetGiftCardRefundCents = Math.min(
    metadata.giftCardAmountCents,
    input.totalReversedCents
  );
  const giftCardRefundCents = Math.max(
    0,
    targetGiftCardRefundCents - previousGiftCardRefundCents
  );

  let previousEarnReversalPoints = 0;
  if (metadata.loyaltyEarnEventId) {
    const rows = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM(ABS("pointsDelta")), 0)::bigint AS "total"
      FROM "LoyaltyPointEvent"
      WHERE "parentEventId" = ${metadata.loyaltyEarnEventId}
        AND "eventType" = 'earn_reversal'
    `);
    previousEarnReversalPoints = safeNumber(
      rows[0]?.total || BigInt(0),
      "Loyalty earning reversal total"
    );
  }
  const targetEarnReversal = cumulativeTarget(
    metadata.loyaltyEarnedPoints,
    input.totalReversedCents,
    capturedCents
  );

  let previousRedeemRestorePoints = 0;
  if (metadata.loyaltyRedeemEventId) {
    const rows = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM("pointsDelta"), 0)::bigint AS "total"
      FROM "LoyaltyPointEvent"
      WHERE "parentEventId" = ${metadata.loyaltyRedeemEventId}
        AND "eventType" = 'redeem_restore'
    `);
    previousRedeemRestorePoints = safeNumber(
      rows[0]?.total || BigInt(0),
      "Loyalty redemption restoration total"
    );
  }
  const targetRedeemRestore = cumulativeTarget(
    metadata.loyaltyRedeemedPoints,
    input.totalReversedCents,
    capturedCents
  );

  const cashRefundCents = input.reversalAmountCents - giftCardRefundCents;
  if (cashRefundCents < 0) {
    throw new LoyaltyLedgerError(
      "Stored-value reversal allocation is inconsistent",
      "STORED_VALUE_REVERSAL_INVALID",
      500
    );
  }

  return {
    metadata,
    giftCardRefundCents,
    cashRefundCents,
    loyaltyEarnReversalPoints: Math.max(
      0,
      targetEarnReversal - previousEarnReversalPoints
    ),
    loyaltyRedeemRestorePoints: Math.max(
      0,
      targetRedeemRestore - previousRedeemRestorePoints
    ),
  };
}

export async function appendReversalLedgers(
  tx: Prisma.TransactionClient,
  input: {
    allocation: ReversalAllocationPlan;
    orderId: string;
    orderNumber: string;
    customerId: string | null;
    captureId: string;
    reversalId: string;
    reversalAction: "refund" | "void";
    reversalAmountCents: number;
    actor: LedgerActor;
    context: AuditRequestContext;
  }
) {
  const { allocation } = input;
  let giftCardRefund: GiftCardTransactionRow | null = null;
  let earnReversal: LoyaltyEventRow | null = null;
  let redeemRestore: LoyaltyEventRow | null = null;

  if (
    allocation.giftCardRefundCents > 0 &&
    allocation.metadata.giftCardId &&
    allocation.metadata.giftCardTransactionId
  ) {
    await readGiftCardById(tx, allocation.metadata.giftCardId, true);
    giftCardRefund = await insertGiftCardTransaction(tx, {
      id: ledgerId("gift_card_tx"),
      idempotencyKey: `gift-card-refund:${input.reversalId}`,
      giftCardId: allocation.metadata.giftCardId,
      transactionType: "refund",
      amountMinor: BigInt(allocation.giftCardRefundCents),
      orderId: input.orderId,
      paymentEventId: input.reversalId,
      parentTransactionId: allocation.metadata.giftCardTransactionId,
      actor: input.actor,
      reasonCode: input.reversalAction,
      reason: `Returned from ${input.orderNumber}`,
      metadata: {
        originalPaymentEventId: input.captureId,
        reversalPaymentEventId: input.reversalId,
      },
    });
    await writeAuditEvent(tx, {
      actor: input.actor,
      action: "gift-card.refund",
      entityType: "GiftCardTransaction",
      entityId: giftCardRefund.id,
      context: input.context,
      metadata: {
        giftCardId: allocation.metadata.giftCardId,
        codeLast4: allocation.metadata.giftCardLast4,
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        amountCents: allocation.giftCardRefundCents,
        balanceAfterMinor: giftCardRefund.balanceAfterMinor.toString(),
      },
    });
  }

  if (input.customerId) {
    await lockCustomer(tx, input.customerId);
    if (
      allocation.loyaltyEarnReversalPoints > 0 &&
      allocation.metadata.loyaltyEarnEventId
    ) {
      earnReversal = await insertLoyaltyEvent(tx, {
        id: ledgerId("loyalty_event"),
        idempotencyKey: `loyalty-earn-reversal:${input.reversalId}`,
        customerId: input.customerId,
        eventType: "earn_reversal",
        pointsDelta: -allocation.loyaltyEarnReversalPoints,
        orderId: input.orderId,
        paymentEventId: input.reversalId,
        parentEventId: allocation.metadata.loyaltyEarnEventId,
        actor: input.actor,
        reasonCode: input.reversalAction,
        reason: `Reversed earning from ${input.orderNumber}`,
        metadata: { originalPaymentEventId: input.captureId },
      });
    }
    if (
      allocation.loyaltyRedeemRestorePoints > 0 &&
      allocation.metadata.loyaltyRedeemEventId
    ) {
      redeemRestore = await insertLoyaltyEvent(tx, {
        id: ledgerId("loyalty_event"),
        idempotencyKey: `loyalty-redeem-restore:${input.reversalId}`,
        customerId: input.customerId,
        eventType: "redeem_restore",
        pointsDelta: allocation.loyaltyRedeemRestorePoints,
        orderId: input.orderId,
        paymentEventId: input.reversalId,
        parentEventId: allocation.metadata.loyaltyRedeemEventId,
        actor: input.actor,
        reasonCode: input.reversalAction,
        reason: `Restored redemption from ${input.orderNumber}`,
        metadata: { originalPaymentEventId: input.captureId },
      });
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "Customer"
      SET
        "totalSpentMinor" = GREATEST(0, "totalSpentMinor" - ${BigInt(
          input.reversalAmountCents
        )}),
        "totalSpent" = GREATEST(0, "totalSpentMinor" - ${BigInt(
          input.reversalAmountCents
        )})::numeric / 100,
        "visits" = CASE
          WHEN ${input.reversalAction} = 'void' THEN GREATEST(0, "visits" - 1)
          ELSE "visits"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${input.customerId}
    `);

    await writeAuditEvent(tx, {
      actor: input.actor,
      action: "loyalty.payment-reversal.apply",
      entityType: "Customer",
      entityId: input.customerId,
      context: input.context,
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        reversalPaymentEventId: input.reversalId,
        reversalAmountCents: input.reversalAmountCents,
        earnReversalPoints: allocation.loyaltyEarnReversalPoints,
        redeemRestorePoints: allocation.loyaltyRedeemRestorePoints,
      },
    });
  }

  return {
    giftCardRefund: giftCardRefund
      ? giftCardTransactionDto(giftCardRefund)
      : null,
    loyaltyEarnReversal: earnReversal ? loyaltyEventDto(earnReversal) : null,
    loyaltyRedeemRestore: redeemRestore
      ? loyaltyEventDto(redeemRestore)
      : null,
    cashRefund: allocation.cashRefundCents / 100,
    giftCardRefundAmount: allocation.giftCardRefundCents / 100,
  };
}

export async function adjustLoyaltyPoints(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    pointsDelta: number;
    idempotencyKey: string;
    reasonCode: LoyaltyAdjustmentReasonCode;
    reason: string;
    actor: LedgerActor;
    context: AuditRequestContext;
  }
) {
  if (!Number.isInteger(input.pointsDelta) || input.pointsDelta === 0) {
    throw new LoyaltyLedgerError(
      "Point adjustment must be a non-zero whole number",
      "INVALID_LOYALTY_ADJUSTMENT",
      400
    );
  }
  const reason = normalizeReason(input.reason);
  const reasonCode = normalizeReasonCode(input.reasonCode);
  if (reason.length < 3 || !reasonCode) {
    throw new LoyaltyLedgerError(
      "A reason code and explanation are required",
      "LOYALTY_ADJUSTMENT_REASON_REQUIRED",
      400
    );
  }

  await advisoryLock(tx, "loyalty-adjustment", input.idempotencyKey);
  const existing = await tx.$queryRaw<LoyaltyEventRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "customerId", "eventType"::text AS "eventType",
      "pointsDelta", "balanceAfter", "orderId", "paymentEventId",
      "parentEventId", "actorId", "actorName", "actorRole", "reasonCode",
      "reason", "metadata", "occurredAt", "createdAt"
    FROM "LoyaltyPointEvent"
    WHERE "idempotencyKey" = ${input.idempotencyKey}
    LIMIT 1
  `);
  if (existing[0]) {
    const event = existing[0];
    if (
      event.customerId !== input.customerId ||
      event.eventType !== "adjustment" ||
      event.pointsDelta !== input.pointsDelta ||
      event.reasonCode !== reasonCode ||
      event.reason !== reason
    ) {
      throw new LoyaltyLedgerError(
        "That idempotency key was used for another loyalty adjustment",
        "LOYALTY_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return { event: loyaltyEventDto(event), replayed: true };
  }

  await lockCustomer(tx, input.customerId);
  const event = await insertLoyaltyEvent(tx, {
    id: ledgerId("loyalty_event"),
    idempotencyKey: input.idempotencyKey,
    customerId: input.customerId,
    eventType: "adjustment",
    pointsDelta: input.pointsDelta,
    actor: input.actor,
    reasonCode,
    reason,
  });
  await writeAuditEvent(tx, {
    actor: input.actor,
    action: "loyalty.adjust",
    entityType: "LoyaltyPointEvent",
    entityId: event.id,
    context: input.context,
    metadata: {
      customerId: input.customerId,
      pointsDelta: input.pointsDelta,
      balanceAfter: event.balanceAfter,
      reasonCode,
      reason,
    },
  });
  return { event: loyaltyEventDto(event), replayed: false };
}

export async function issueGiftCard(
  tx: Prisma.TransactionClient,
  input: {
    amount: number;
    purchaserName: string;
    recipientName: string;
    message?: string | null;
    template?: string;
    expiresAt?: Date | null;
    idempotencyKey: string;
    actor: LedgerActor;
    context: AuditRequestContext;
  }
) {
  const amountMinor = parseMoneyToMinor(input.amount);
  if (amountMinor <= BigInt(0)) {
    throw new LoyaltyLedgerError(
      "Gift-card amount must be greater than zero",
      "INVALID_GIFT_CARD_AMOUNT",
      400
    );
  }
  await advisoryLock(tx, "gift-card-issue", input.idempotencyKey);
  const existing = await tx.$queryRaw<
    Array<GiftCardTransactionRow & GiftCardRow>
  >(Prisma.sql`
    SELECT
      tx."id", tx."idempotencyKey", tx."giftCardId",
      tx."transactionType"::text AS "transactionType", tx."amountMinor",
      tx."balanceAfterMinor", tx."orderId", tx."paymentEventId",
      tx."parentTransactionId", tx."actorId", tx."actorName", tx."actorRole",
      tx."reasonCode", tx."reason", tx."metadata", tx."occurredAt", tx."createdAt",
      card."code", card."redemptionCodeHash", card."redemptionCodeLast4",
      card."amountMinor" AS "amountMinor", card."balanceMinor" AS "balanceMinor",
      card."purchaserName", card."recipientName", card."message", card."template",
      card."status"::text AS "status", card."currency", card."issuedAt",
      card."expiresAt", card."voidedAt", card."issuedById", card."issuedByName",
      card."createdAt", card."updatedAt"
    FROM "GiftCardTransaction" AS tx
    JOIN "GiftCard" AS card ON card."id" = tx."giftCardId"
    WHERE tx."idempotencyKey" = ${input.idempotencyKey}
    LIMIT 1
  `);
  if (existing[0]) {
    return {
      card: giftCardDto(existing[0], true),
      transaction: giftCardTransactionDto(existing[0]),
      redemptionCode: null,
      replayed: true,
    };
  }

  const policy = await readLoyaltyPolicy(tx);
  if (!policy.giftCardEnabled) {
    throw new LoyaltyLedgerError(
      "Gift-card issuance is disabled",
      "GIFT_CARD_DISABLED",
      409
    );
  }
  const cardId = ledgerId("gift_card");
  const reference = generateGiftCardReference();
  const redemptionCode = generateGiftCardSecret();
  const normalizedSecret = normalizeGiftCardCode(redemptionCode);
  const codeHash = hashText(normalizedSecret);
  const last4 = normalizedSecret.slice(-4);
  const expiresAt =
    input.expiresAt ||
    (policy.giftCardDefaultExpiryDays > 0
      ? new Date(
          Date.now() + policy.giftCardDefaultExpiryDays * 86_400_000
        )
      : null);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "GiftCard" (
      "id", "code", "amount", "amountMinor", "balance", "balanceMinor",
      "purchaserName", "recipientName", "message", "template",
      "isRedeemed", "redemptionCodeHash", "redemptionCodeLast4", "status",
      "currency", "issuedAt", "expiresAt", "issuedById", "issuedByName"
    ) VALUES (
      ${cardId}, ${reference}, ${minorToNumber(amountMinor)}, ${amountMinor},
      0, 0, ${input.purchaserName.trim().slice(0, 200)},
      ${input.recipientName.trim().slice(0, 200)},
      ${input.message?.trim().slice(0, 2_000) || null},
      ${(input.template || "classic").trim().slice(0, 80)}, false,
      ${codeHash}, ${last4}, 'active', ${policy.currency}, CURRENT_TIMESTAMP,
      ${expiresAt}, ${input.actor.id}, ${input.actor.name}
    )
  `);

  const transaction = await insertGiftCardTransaction(tx, {
    id: ledgerId("gift_card_tx"),
    idempotencyKey: input.idempotencyKey,
    giftCardId: cardId,
    transactionType: "issue",
    amountMinor,
    actor: input.actor,
    reasonCode: "issue",
    reason: "Gift card issued by an authorized manager",
    metadata: { reference, codeLast4: last4 },
  });
  const card = await readGiftCardById(tx, cardId);
  if (!card) {
    throw new LoyaltyLedgerError(
      "Unable to load issued gift card",
      "GIFT_CARD_ISSUE_FAILED",
      500
    );
  }

  await writeAuditEvent(tx, {
    actor: input.actor,
    action: "gift-card.issue",
    entityType: "GiftCard",
    entityId: cardId,
    context: input.context,
    metadata: {
      reference,
      codeLast4: last4,
      amountMinor: amountMinor.toString(),
      currency: policy.currency,
      expiresAt,
      recipientName: card.recipientName,
    },
  });

  return {
    card: giftCardDto(card, true),
    transaction: giftCardTransactionDto(transaction),
    redemptionCode,
    replayed: false,
  };
}

export async function mutateGiftCard(
  tx: Prisma.TransactionClient,
  input: {
    cardId: string;
    action: "adjust" | "void";
    amount?: number;
    idempotencyKey: string;
    reasonCode: GiftCardAdjustmentReasonCode;
    reason: string;
    actor: LedgerActor;
    context: AuditRequestContext;
  }
) {
  const reason = normalizeReason(input.reason);
  const reasonCode = normalizeReasonCode(input.reasonCode);
  if (reason.length < 3 || !reasonCode) {
    throw new LoyaltyLedgerError(
      "A reason code and explanation are required",
      "GIFT_CARD_REASON_REQUIRED",
      400
    );
  }
  await advisoryLock(tx, "gift-card-mutation", input.idempotencyKey);
  const existing = await tx.$queryRaw<GiftCardTransactionRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "giftCardId",
      "transactionType"::text AS "transactionType", "amountMinor",
      "balanceAfterMinor", "orderId", "paymentEventId", "parentTransactionId",
      "actorId", "actorName", "actorRole", "reasonCode", "reason",
      "metadata", "occurredAt", "createdAt"
    FROM "GiftCardTransaction"
    WHERE "idempotencyKey" = ${input.idempotencyKey}
    LIMIT 1
  `);
  if (existing[0]) {
    const event = existing[0];
    const expectedType = input.action === "void" ? "void" : "adjustment";
    if (
      event.giftCardId !== input.cardId ||
      event.transactionType !== expectedType ||
      event.reasonCode !== reasonCode ||
      event.reason !== reason
    ) {
      throw new LoyaltyLedgerError(
        "That idempotency key was used for another gift-card action",
        "GIFT_CARD_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return {
      transaction: giftCardTransactionDto(event),
      card: giftCardDto(
        (await readGiftCardById(tx, input.cardId)) as GiftCardRow,
        true
      ),
      replayed: true,
    };
  }

  const card = await readGiftCardById(tx, input.cardId, true);
  if (!card) {
    throw new LoyaltyLedgerError("Gift card not found", "GIFT_CARD_NOT_FOUND", 404);
  }
  if (input.action === "void" && card.balanceMinor <= BigInt(0)) {
    throw new LoyaltyLedgerError(
      "Gift card has no remaining balance to void",
      "GIFT_CARD_ALREADY_EMPTY",
      409
    );
  }
  const amountMinor =
    input.action === "void"
      ? -card.balanceMinor
      : parseSignedMoneyToMinor(input.amount ?? 0);
  if (amountMinor === BigInt(0)) {
    throw new LoyaltyLedgerError(
      "Gift-card adjustment must be non-zero",
      "INVALID_GIFT_CARD_ADJUSTMENT",
      400
    );
  }

  const transaction = await insertGiftCardTransaction(tx, {
    id: ledgerId("gift_card_tx"),
    idempotencyKey: input.idempotencyKey,
    giftCardId: card.id,
    transactionType: input.action === "void" ? "void" : "adjustment",
    amountMinor,
    actor: input.actor,
    reasonCode,
    reason,
  });
  const updated = await readGiftCardById(tx, card.id);
  if (!updated) {
    throw new LoyaltyLedgerError(
      "Unable to load updated gift card",
      "GIFT_CARD_UPDATE_FAILED",
      500
    );
  }
  await writeAuditEvent(tx, {
    actor: input.actor,
    action: input.action === "void" ? "gift-card.void" : "gift-card.adjust",
    entityType: "GiftCardTransaction",
    entityId: transaction.id,
    context: input.context,
    metadata: {
      giftCardId: card.id,
      reference: card.code,
      codeLast4: card.redemptionCodeLast4,
      amountMinor: amountMinor.toString(),
      balanceAfterMinor: transaction.balanceAfterMinor.toString(),
      reasonCode,
      reason,
    },
  });
  return {
    transaction: giftCardTransactionDto(transaction),
    card: giftCardDto(updated, true),
    replayed: false,
  };
}

export function loyaltyLedgerErrorResponse(error: unknown) {
  if (error instanceof LoyaltyLedgerError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(error.code)) {
      return {
        status: 409,
        body: {
          error: "The loyalty or gift-card ledger changed before the operation completed",
          code: "LOYALTY_LEDGER_CONFLICT",
          retryable: error.code === "P2034",
        },
      };
    }
  }
  return null;
}
