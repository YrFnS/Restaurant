-- P1 payment reversals: immutable parent-linked refund and void events,
-- concurrency-safe over-refund protection, and reviewed reversal reasons.

ALTER TABLE "PaymentEvent"
  ADD COLUMN "parentEventId" TEXT,
  ADD COLUMN "reasonCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "reason" TEXT;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_parentEventId_fkey"
  FOREIGN KEY ("parentEventId") REFERENCES "PaymentEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_parent_not_self" CHECK (
    "parentEventId" IS NULL OR "parentEventId" <> "id"
  ),
  ADD CONSTRAINT "PaymentEvent_reversal_shape" CHECK (
    (
      "eventType"::text IN ('capture', 'adjustment') AND
      "parentEventId" IS NULL AND
      "reasonCode" = '' AND
      "reason" IS NULL
    ) OR
    (
      "eventType"::text IN ('refund', 'void') AND
      "parentEventId" IS NOT NULL AND
      "amountCents" > 0 AND
      "tenderedCents" IS NULL AND
      "changeCents" IS NULL AND
      "reasonCode" IN (
        'customer_request',
        'item_unavailable',
        'quality_issue',
        'duplicate_charge',
        'operator_error',
        'order_cancelled',
        'fraud_suspected',
        'other'
      ) AND
      char_length(btrim(COALESCE("reason", ''))) BETWEEN 3 AND 1000
    )
  );

CREATE INDEX "PaymentEvent_parent_createdAt_idx"
  ON "PaymentEvent"("parentEventId", "createdAt" DESC);
CREATE INDEX "PaymentEvent_order_status_createdAt_idx"
  ON "PaymentEvent"("orderId", "status", "createdAt" DESC);
CREATE UNIQUE INDEX "PaymentEvent_one_successful_void_per_capture_idx"
  ON "PaymentEvent"("parentEventId")
  WHERE "eventType" = 'void' AND "status" = 'succeeded';

CREATE FUNCTION "validate_payment_reversal_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_order_id TEXT;
  parent_event_type "PaymentEventType";
  parent_status "PaymentEventStatus";
  parent_method "PaymentMethod";
  parent_amount_cents INTEGER;
  parent_currency TEXT;
  reversed_amount_cents BIGINT;
BEGIN
  IF NEW."eventType"::text NOT IN ('refund', 'void') THEN
    RETURN NEW;
  END IF;

  SELECT
    "orderId", "eventType", "status", "method", "amountCents", "currency"
  INTO
    parent_order_id, parent_event_type, parent_status, parent_method,
    parent_amount_cents, parent_currency
  FROM "PaymentEvent"
  WHERE "id" = NEW."parentEventId"
  FOR UPDATE;

  IF parent_order_id IS NULL THEN
    RAISE EXCEPTION 'The original payment event does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF parent_event_type <> 'capture' OR parent_status <> 'succeeded' THEN
    RAISE EXCEPTION 'Refunds and voids must reverse a successful capture'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."orderId" <> parent_order_id OR
     NEW."method" <> parent_method OR
     NEW."currency" <> parent_currency THEN
    RAISE EXCEPTION 'Payment reversal must match the original capture'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("amountCents"), 0)
  INTO reversed_amount_cents
  FROM "PaymentEvent"
  WHERE "parentEventId" = NEW."parentEventId"
    AND "status" = 'succeeded'
    AND "eventType"::text IN ('refund', 'void');

  IF NEW."eventType" = 'void' AND
     (reversed_amount_cents <> 0 OR NEW."amountCents" <> parent_amount_cents) THEN
    RAISE EXCEPTION 'A void must reverse the untouched capture in full'
      USING ERRCODE = '23514';
  END IF;

  IF reversed_amount_cents + NEW."amountCents" > parent_amount_cents THEN
    RAISE EXCEPTION 'Payment reversal exceeds the remaining captured amount'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "PaymentEvent_validate_reversal"
BEFORE INSERT ON "PaymentEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_reversal_insert"();

CREATE FUNCTION "protect_payment_event_ledger"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Payment events are immutable; append a new event instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "PaymentEvent_immutable"
BEFORE UPDATE OR DELETE ON "PaymentEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_event_ledger"();
