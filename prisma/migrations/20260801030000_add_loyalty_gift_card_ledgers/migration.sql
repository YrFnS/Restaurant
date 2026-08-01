-- P1 loyalty and gift-card ledgers.
--
-- Loyalty points and gift-card balances become append-only, idempotent ledgers.
-- Compatibility summary columns remain available, but database triggers maintain
-- them from immutable transaction history.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'gift_card';

CREATE TYPE "LoyaltyPointEventType" AS ENUM (
  'opening_balance',
  'earn',
  'redeem',
  'earn_reversal',
  'redeem_restore',
  'adjustment'
);

CREATE TYPE "GiftCardStatus" AS ENUM (
  'active',
  'exhausted',
  'voided',
  'expired'
);

CREATE TYPE "GiftCardTransactionType" AS ENUM (
  'opening_balance',
  'issue',
  'redeem',
  'refund',
  'adjustment',
  'void',
  'expiration'
);

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "loyaltyPointsPerCurrencyUnit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "loyaltyRedemptionPointsPerCurrencyUnit" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "loyaltyRedemptionIncrementPoints" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "loyaltyMaxRedemptionPercent" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "giftCardEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "giftCardDefaultExpiryDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_loyalty_policy_bounds" CHECK (
    "loyaltyPointsPerCurrencyUnit" BETWEEN 0 AND 1000000 AND
    "loyaltyRedemptionPointsPerCurrencyUnit" BETWEEN 1 AND 1000000000 AND
    "loyaltyRedemptionIncrementPoints" BETWEEN 1 AND 1000000000 AND
    "loyaltyMaxRedemptionPercent" BETWEEN 1 AND 100 AND
    "giftCardDefaultExpiryDays" BETWEEN 0 AND 36500
  );

ALTER TABLE "Customer"
  DROP CONSTRAINT IF EXISTS "Customer_loyalty_bounds";

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_loyalty_operational_bounds" CHECK (
    "loyaltyPoints" BETWEEN -1000000000 AND 1000000000 AND
    "visits" BETWEEN 0 AND 2147483647
  );

ALTER TABLE "GiftCard"
  ADD COLUMN "redemptionCodeHash" TEXT,
  ADD COLUMN "redemptionCodeLast4" TEXT,
  ADD COLUMN "status" "GiftCardStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "issuedAt" TIMESTAMPTZ(3),
  ADD COLUMN "expiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "voidedAt" TIMESTAMPTZ(3),
  ADD COLUMN "issuedById" TEXT,
  ADD COLUMN "issuedByName" TEXT NOT NULL DEFAULT '';

UPDATE "GiftCard" AS card
SET
  "redemptionCodeHash" = encode(digest(card."code", 'sha256'), 'hex'),
  "redemptionCodeLast4" = right(card."code", 4),
  "status" = CASE
    WHEN card."balanceMinor" <= 0 OR card."isRedeemed" THEN 'exhausted'::"GiftCardStatus"
    ELSE 'active'::"GiftCardStatus"
  END,
  "currency" = COALESCE(NULLIF(settings."currency", ''), 'USD'),
  "issuedAt" = card."createdAt" AT TIME ZONE 'UTC'
FROM "RestaurantSettings" AS settings
WHERE settings."id" = '1';

ALTER TABLE "GiftCard"
  ALTER COLUMN "redemptionCodeHash" SET NOT NULL,
  ALTER COLUMN "redemptionCodeLast4" SET NOT NULL,
  ALTER COLUMN "issuedAt" SET NOT NULL;

CREATE UNIQUE INDEX "GiftCard_redemptionCodeHash_key"
  ON "GiftCard" ("redemptionCodeHash");
CREATE INDEX "GiftCard_status_createdAt_idx"
  ON "GiftCard" ("status", "createdAt" DESC);
CREATE INDEX "GiftCard_last4_createdAt_idx"
  ON "GiftCard" ("redemptionCodeLast4", "createdAt" DESC);
CREATE INDEX "GiftCard_expiresAt_idx"
  ON "GiftCard" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL AND "status" = 'active';

ALTER TABLE "GiftCard"
  DROP CONSTRAINT IF EXISTS "GiftCard_money_bounds";

ALTER TABLE "GiftCard"
  ADD CONSTRAINT "GiftCard_money_bounds" CHECK (
    "amount" >= 0 AND "amount" <= 1000000000000 AND
    "balance" >= 0 AND "balance" <= "amount"
  ),
  ADD CONSTRAINT "GiftCard_status_shape" CHECK (
    ("status" = 'active') OR
    ("status" = 'exhausted' AND "balanceMinor" = 0) OR
    ("status" = 'voided' AND "balanceMinor" = 0 AND "voidedAt" IS NOT NULL) OR
    ("status" = 'expired' AND "balanceMinor" = 0 AND "expiresAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "GiftCard_credential_shape" CHECK (
    char_length("redemptionCodeHash") = 64 AND
    char_length("redemptionCodeLast4") BETWEEN 1 AND 8
  );

CREATE TABLE "LoyaltyPointEvent" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "eventType" "LoyaltyPointEventType" NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL DEFAULT 0,
  "orderId" TEXT,
  "paymentEventId" TEXT,
  "parentEventId" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT '',
  "actorRole" TEXT NOT NULL DEFAULT '',
  "reasonCode" TEXT NOT NULL DEFAULT '',
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyPointEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyPointEvent_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "LoyaltyPointEvent_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyPointEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyPointEvent_paymentEventId_fkey"
    FOREIGN KEY ("paymentEventId") REFERENCES "PaymentEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyPointEvent_parentEventId_fkey"
    FOREIGN KEY ("parentEventId") REFERENCES "LoyaltyPointEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyPointEvent_parent_not_self" CHECK (
    "parentEventId" IS NULL OR "parentEventId" <> "id"
  ),
  CONSTRAINT "LoyaltyPointEvent_delta_bounds" CHECK (
    "pointsDelta" <> 0 AND
    "pointsDelta" BETWEEN -1000000000 AND 1000000000 AND
    "balanceAfter" BETWEEN -1000000000 AND 1000000000
  ),
  CONSTRAINT "LoyaltyPointEvent_shape" CHECK (
    (
      "eventType" = 'opening_balance' AND
      "pointsDelta" > 0 AND
      "orderId" IS NULL AND "paymentEventId" IS NULL AND "parentEventId" IS NULL
    ) OR
    (
      "eventType" = 'earn' AND
      "pointsDelta" > 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentEventId" IS NULL
    ) OR
    (
      "eventType" = 'redeem' AND
      "pointsDelta" < 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentEventId" IS NULL
    ) OR
    (
      "eventType" = 'earn_reversal' AND
      "pointsDelta" < 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentEventId" IS NOT NULL
    ) OR
    (
      "eventType" = 'redeem_restore' AND
      "pointsDelta" > 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentEventId" IS NOT NULL
    ) OR
    (
      "eventType" = 'adjustment' AND
      "orderId" IS NULL AND "paymentEventId" IS NULL AND "parentEventId" IS NULL AND
      char_length(btrim("reasonCode")) BETWEEN 1 AND 80 AND
      char_length(btrim(COALESCE("reason", ''))) BETWEEN 3 AND 2000
    )
  )
);

CREATE INDEX "LoyaltyPointEvent_customer_createdAt_idx"
  ON "LoyaltyPointEvent" ("customerId", "createdAt" DESC);
CREATE INDEX "LoyaltyPointEvent_order_createdAt_idx"
  ON "LoyaltyPointEvent" ("orderId", "createdAt" DESC);
CREATE INDEX "LoyaltyPointEvent_payment_type_idx"
  ON "LoyaltyPointEvent" ("paymentEventId", "eventType", "createdAt" DESC);
CREATE INDEX "LoyaltyPointEvent_parent_createdAt_idx"
  ON "LoyaltyPointEvent" ("parentEventId", "createdAt" DESC);
CREATE UNIQUE INDEX "LoyaltyPointEvent_capture_type_key"
  ON "LoyaltyPointEvent" ("paymentEventId", "eventType")
  WHERE "eventType" IN ('earn', 'redeem');
CREATE UNIQUE INDEX "LoyaltyPointEvent_reversal_parent_payment_type_key"
  ON "LoyaltyPointEvent" ("parentEventId", "paymentEventId", "eventType")
  WHERE "eventType" IN ('earn_reversal', 'redeem_restore');

INSERT INTO "LoyaltyPointEvent" (
  "id", "idempotencyKey", "customerId", "eventType", "pointsDelta",
  "balanceAfter", "actorName", "actorRole", "reasonCode", "reason",
  "metadata", "occurredAt", "createdAt"
)
SELECT
  'loyalty_opening_' || md5(customer."id"),
  'migration-loyalty-opening:' || customer."id",
  customer."id",
  'opening_balance'::"LoyaltyPointEventType",
  customer."loyaltyPoints",
  customer."loyaltyPoints",
  'Migration',
  'system',
  'legacy_opening_balance',
  'Adopted the existing loyalty point balance without inventing earning history',
  jsonb_build_object('legacyImported', true),
  customer."createdAt" AT TIME ZONE 'UTC',
  customer."createdAt" AT TIME ZONE 'UTC'
FROM "Customer" AS customer
WHERE customer."loyaltyPoints" > 0;

CREATE TABLE "GiftCardTransaction" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "giftCardId" TEXT NOT NULL,
  "transactionType" "GiftCardTransactionType" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "balanceAfterMinor" BIGINT NOT NULL DEFAULT 0,
  "orderId" TEXT,
  "paymentEventId" TEXT,
  "parentTransactionId" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT '',
  "actorRole" TEXT NOT NULL DEFAULT '',
  "reasonCode" TEXT NOT NULL DEFAULT '',
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GiftCardTransaction_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "GiftCardTransaction_giftCardId_fkey"
    FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftCardTransaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftCardTransaction_paymentEventId_fkey"
    FOREIGN KEY ("paymentEventId") REFERENCES "PaymentEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftCardTransaction_parentTransactionId_fkey"
    FOREIGN KEY ("parentTransactionId") REFERENCES "GiftCardTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GiftCardTransaction_parent_not_self" CHECK (
    "parentTransactionId" IS NULL OR "parentTransactionId" <> "id"
  ),
  CONSTRAINT "GiftCardTransaction_amount_bounds" CHECK (
    "amountMinor" <> 0 AND
    "amountMinor" BETWEEN -100000000000000 AND 100000000000000 AND
    "balanceAfterMinor" BETWEEN 0 AND 100000000000000
  ),
  CONSTRAINT "GiftCardTransaction_shape" CHECK (
    (
      "transactionType" IN ('opening_balance', 'issue') AND
      "amountMinor" > 0 AND
      "orderId" IS NULL AND "paymentEventId" IS NULL AND "parentTransactionId" IS NULL
    ) OR
    (
      "transactionType" = 'redeem' AND
      "amountMinor" < 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentTransactionId" IS NULL
    ) OR
    (
      "transactionType" = 'refund' AND
      "amountMinor" > 0 AND
      "orderId" IS NOT NULL AND "paymentEventId" IS NOT NULL AND "parentTransactionId" IS NOT NULL
    ) OR
    (
      "transactionType" = 'adjustment' AND
      "orderId" IS NULL AND "paymentEventId" IS NULL AND "parentTransactionId" IS NULL AND
      char_length(btrim("reasonCode")) BETWEEN 1 AND 80 AND
      char_length(btrim(COALESCE("reason", ''))) BETWEEN 3 AND 2000
    ) OR
    (
      "transactionType" IN ('void', 'expiration') AND
      "amountMinor" < 0 AND
      "orderId" IS NULL AND "paymentEventId" IS NULL AND "parentTransactionId" IS NULL AND
      char_length(btrim("reasonCode")) BETWEEN 1 AND 80 AND
      char_length(btrim(COALESCE("reason", ''))) BETWEEN 3 AND 2000
    )
  )
);

CREATE INDEX "GiftCardTransaction_card_createdAt_idx"
  ON "GiftCardTransaction" ("giftCardId", "createdAt" DESC);
CREATE INDEX "GiftCardTransaction_order_createdAt_idx"
  ON "GiftCardTransaction" ("orderId", "createdAt" DESC);
CREATE INDEX "GiftCardTransaction_payment_type_idx"
  ON "GiftCardTransaction" ("paymentEventId", "transactionType", "createdAt" DESC);
CREATE INDEX "GiftCardTransaction_parent_createdAt_idx"
  ON "GiftCardTransaction" ("parentTransactionId", "createdAt" DESC);
CREATE UNIQUE INDEX "GiftCardTransaction_redeem_payment_key"
  ON "GiftCardTransaction" ("paymentEventId", "giftCardId", "transactionType")
  WHERE "transactionType" = 'redeem';
CREATE UNIQUE INDEX "GiftCardTransaction_refund_parent_payment_key"
  ON "GiftCardTransaction" ("parentTransactionId", "paymentEventId", "transactionType")
  WHERE "transactionType" = 'refund';

INSERT INTO "GiftCardTransaction" (
  "id", "idempotencyKey", "giftCardId", "transactionType", "amountMinor",
  "balanceAfterMinor", "actorName", "actorRole", "reasonCode", "reason",
  "metadata", "occurredAt", "createdAt"
)
SELECT
  'gift_card_opening_' || md5(card."id"),
  'migration-gift-card-opening:' || card."id",
  card."id",
  'opening_balance'::"GiftCardTransactionType",
  card."balanceMinor",
  card."balanceMinor",
  'Migration',
  'system',
  'legacy_opening_balance',
  'Adopted the existing gift-card balance without inventing transaction history',
  jsonb_build_object('legacyImported', true, 'initialAmountMinor', card."amountMinor"::text),
  card."createdAt" AT TIME ZONE 'UTC',
  card."createdAt" AT TIME ZONE 'UTC'
FROM "GiftCard" AS card
WHERE card."balanceMinor" > 0;

CREATE FUNCTION "apply_loyalty_point_event_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance INTEGER;
  next_balance BIGINT;
  parent_type "LoyaltyPointEventType";
  parent_customer_id TEXT;
  parent_order_id TEXT;
  parent_delta INTEGER;
  already_applied BIGINT;
BEGIN
  SELECT "loyaltyPoints"
  INTO current_balance
  FROM "Customer"
  WHERE "id" = NEW."customerId"
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Loyalty customer does not exist' USING ERRCODE = '23503';
  END IF;

  IF NEW."eventType" IN ('earn_reversal', 'redeem_restore') THEN
    SELECT "eventType", "customerId", "orderId", "pointsDelta"
    INTO parent_type, parent_customer_id, parent_order_id, parent_delta
    FROM "LoyaltyPointEvent"
    WHERE "id" = NEW."parentEventId"
    FOR UPDATE;

    IF parent_customer_id IS NULL THEN
      RAISE EXCEPTION 'The parent loyalty event does not exist' USING ERRCODE = '23503';
    END IF;

    IF parent_customer_id <> NEW."customerId" OR parent_order_id IS DISTINCT FROM NEW."orderId" THEN
      RAISE EXCEPTION 'Loyalty reversal must match the original customer and order' USING ERRCODE = '23514';
    END IF;

    IF NEW."eventType" = 'earn_reversal' AND parent_type <> 'earn' THEN
      RAISE EXCEPTION 'Earn reversal must reference an earn event' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventType" = 'redeem_restore' AND parent_type <> 'redeem' THEN
      RAISE EXCEPTION 'Redemption restoration must reference a redeem event' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM(ABS("pointsDelta")), 0)
    INTO already_applied
    FROM "LoyaltyPointEvent"
    WHERE "parentEventId" = NEW."parentEventId"
      AND "eventType" = NEW."eventType";

    IF already_applied + ABS(NEW."pointsDelta") > ABS(parent_delta) THEN
      RAISE EXCEPTION 'Loyalty reversal exceeds the original point event' USING ERRCODE = '23514';
    END IF;
  END IF;

  next_balance := current_balance::bigint + NEW."pointsDelta"::bigint;
  IF next_balance < 0 AND NEW."eventType" <> 'earn_reversal' THEN
    RAISE EXCEPTION 'Loyalty point event would overdraw the customer balance' USING ERRCODE = '23514';
  END IF;
  IF next_balance < -1000000000 OR next_balance > 1000000000 THEN
    RAISE EXCEPTION 'Loyalty point balance is outside supported bounds' USING ERRCODE = '23514';
  END IF;

  NEW."balanceAfter" := next_balance::integer;

  UPDATE "Customer"
  SET "loyaltyPoints" = NEW."balanceAfter"
  WHERE "id" = NEW."customerId";

  RETURN NEW;
END
$$;

CREATE TRIGGER "LoyaltyPointEvent_apply_balance"
BEFORE INSERT ON "LoyaltyPointEvent"
FOR EACH ROW EXECUTE FUNCTION "apply_loyalty_point_event_insert"();

CREATE FUNCTION "protect_loyalty_point_event"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty point events are immutable; append a correction instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "LoyaltyPointEvent_immutable"
BEFORE UPDATE OR DELETE ON "LoyaltyPointEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_loyalty_point_event"();

CREATE FUNCTION "apply_gift_card_transaction_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  card_balance BIGINT;
  card_amount BIGINT;
  card_status "GiftCardStatus";
  card_expires_at TIMESTAMPTZ(3);
  next_balance BIGINT;
  next_amount BIGINT;
  parent_type "GiftCardTransactionType";
  parent_card_id TEXT;
  parent_order_id TEXT;
  parent_amount BIGINT;
  already_refunded BIGINT;
  next_status "GiftCardStatus";
BEGIN
  SELECT "balanceMinor", "amountMinor", "status", "expiresAt"
  INTO card_balance, card_amount, card_status, card_expires_at
  FROM "GiftCard"
  WHERE "id" = NEW."giftCardId"
  FOR UPDATE;

  IF card_balance IS NULL THEN
    RAISE EXCEPTION 'Gift card does not exist' USING ERRCODE = '23503';
  END IF;

  IF NEW."transactionType" = 'redeem' THEN
    IF card_status <> 'active' THEN
      RAISE EXCEPTION 'Gift card is not active' USING ERRCODE = '23514';
    END IF;
    IF card_expires_at IS NOT NULL AND card_expires_at <= NEW."occurredAt" THEN
      RAISE EXCEPTION 'Gift card has expired' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."transactionType" = 'refund' THEN
    SELECT "transactionType", "giftCardId", "orderId", "amountMinor"
    INTO parent_type, parent_card_id, parent_order_id, parent_amount
    FROM "GiftCardTransaction"
    WHERE "id" = NEW."parentTransactionId"
    FOR UPDATE;

    IF parent_card_id IS NULL THEN
      RAISE EXCEPTION 'The original gift-card redemption does not exist' USING ERRCODE = '23503';
    END IF;
    IF parent_type <> 'redeem' OR parent_card_id <> NEW."giftCardId" OR parent_order_id IS DISTINCT FROM NEW."orderId" THEN
      RAISE EXCEPTION 'Gift-card refund must match the original redemption' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM("amountMinor"), 0)
    INTO already_refunded
    FROM "GiftCardTransaction"
    WHERE "parentTransactionId" = NEW."parentTransactionId"
      AND "transactionType" = 'refund';

    IF already_refunded + NEW."amountMinor" > ABS(parent_amount) THEN
      RAISE EXCEPTION 'Gift-card refund exceeds the original redemption' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."transactionType" IN ('void', 'expiration') AND NEW."amountMinor" <> -card_balance THEN
    RAISE EXCEPTION 'Gift-card closure must remove the complete remaining balance' USING ERRCODE = '23514';
  END IF;

  next_balance := card_balance + NEW."amountMinor";
  IF next_balance < 0 OR next_balance > 100000000000000 THEN
    RAISE EXCEPTION 'Gift-card transaction would create an invalid balance' USING ERRCODE = '23514';
  END IF;

  next_amount := card_amount;
  IF NEW."transactionType" = 'adjustment' AND NEW."amountMinor" > 0 THEN
    next_amount := card_amount + NEW."amountMinor";
  END IF;
  IF next_balance > next_amount THEN
    RAISE EXCEPTION 'Gift-card balance cannot exceed cumulative loaded value' USING ERRCODE = '23514';
  END IF;

  NEW."balanceAfterMinor" := next_balance;

  next_status := CASE
    WHEN NEW."transactionType" = 'void' THEN 'voided'::"GiftCardStatus"
    WHEN NEW."transactionType" = 'expiration' THEN 'expired'::"GiftCardStatus"
    WHEN next_balance = 0 THEN 'exhausted'::"GiftCardStatus"
    ELSE 'active'::"GiftCardStatus"
  END;

  PERFORM set_config('app.gift_card_ledger_write', 'on', true);
  UPDATE "GiftCard"
  SET
    "amountMinor" = next_amount,
    "amount" = next_amount::numeric / 100,
    "balanceMinor" = next_balance,
    "balance" = next_balance::numeric / 100,
    "status" = next_status,
    "isRedeemed" = (next_balance = 0),
    "redeemedAt" = CASE
      WHEN next_balance = 0 AND NEW."transactionType" = 'redeem' THEN NEW."occurredAt"
      WHEN next_balance > 0 THEN NULL
      ELSE "redeemedAt"
    END,
    "voidedAt" = CASE
      WHEN NEW."transactionType" = 'void' THEN NEW."occurredAt"
      WHEN next_status = 'active' THEN NULL
      ELSE "voidedAt"
    END,
    "expiresAt" = CASE
      WHEN NEW."transactionType" = 'refund' AND card_expires_at IS NOT NULL AND card_expires_at <= NEW."occurredAt" THEN NULL
      ELSE "expiresAt"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."giftCardId";

  RETURN NEW;
END
$$;

CREATE TRIGGER "GiftCardTransaction_apply_balance"
BEFORE INSERT ON "GiftCardTransaction"
FOR EACH ROW EXECUTE FUNCTION "apply_gift_card_transaction_insert"();

CREATE FUNCTION "protect_gift_card_transaction"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Gift-card transactions are immutable; append a correction instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "GiftCardTransaction_immutable"
BEFORE UPDATE OR DELETE ON "GiftCardTransaction"
FOR EACH ROW EXECUTE FUNCTION "protect_gift_card_transaction"();

CREATE FUNCTION "protect_gift_card_financial_fields"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.gift_card_ledger_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW."amount" IS DISTINCT FROM OLD."amount" OR
     NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor" OR
     NEW."balance" IS DISTINCT FROM OLD."balance" OR
     NEW."balanceMinor" IS DISTINCT FROM OLD."balanceMinor" OR
     NEW."status" IS DISTINCT FROM OLD."status" OR
     NEW."isRedeemed" IS DISTINCT FROM OLD."isRedeemed" OR
     NEW."redeemedAt" IS DISTINCT FROM OLD."redeemedAt" OR
     NEW."voidedAt" IS DISTINCT FROM OLD."voidedAt" OR
     NEW."redemptionCodeHash" IS DISTINCT FROM OLD."redemptionCodeHash" THEN
    RAISE EXCEPTION 'Gift-card financial state is ledger-controlled'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "GiftCard_financial_fields_guard"
BEFORE UPDATE ON "GiftCard"
FOR EACH ROW EXECUTE FUNCTION "protect_gift_card_financial_fields"();
