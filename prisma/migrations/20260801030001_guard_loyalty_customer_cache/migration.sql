-- Keep the legacy Customer.loyaltyPoints summary as a read-compatible cache,
-- but make immutable LoyaltyPointEvent rows the only supported writer.

CREATE OR REPLACE FUNCTION "apply_loyalty_point_event_insert"()
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

    IF parent_customer_id <> NEW."customerId" OR
       parent_order_id IS DISTINCT FROM NEW."orderId" THEN
      RAISE EXCEPTION 'Loyalty reversal must match the original customer and order'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."eventType" = 'earn_reversal' AND parent_type <> 'earn' THEN
      RAISE EXCEPTION 'Earn reversal must reference an earn event'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."eventType" = 'redeem_restore' AND parent_type <> 'redeem' THEN
      RAISE EXCEPTION 'Redemption restoration must reference a redeem event'
        USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM(ABS("pointsDelta")), 0)
    INTO already_applied
    FROM "LoyaltyPointEvent"
    WHERE "parentEventId" = NEW."parentEventId"
      AND "eventType" = NEW."eventType";

    IF already_applied + ABS(NEW."pointsDelta") > ABS(parent_delta) THEN
      RAISE EXCEPTION 'Loyalty reversal exceeds the original point event'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  next_balance := current_balance::bigint + NEW."pointsDelta"::bigint;
  IF next_balance < 0 AND NEW."eventType" <> 'earn_reversal' THEN
    RAISE EXCEPTION 'Loyalty point event would overdraw the customer balance'
      USING ERRCODE = '23514';
  END IF;
  IF next_balance < -1000000000 OR next_balance > 1000000000 THEN
    RAISE EXCEPTION 'Loyalty point balance is outside supported bounds'
      USING ERRCODE = '23514';
  END IF;

  NEW."balanceAfter" := next_balance::integer;

  PERFORM set_config('app.loyalty_ledger_write', 'on', true);
  UPDATE "Customer"
  SET "loyaltyPoints" = NEW."balanceAfter"
  WHERE "id" = NEW."customerId";
  PERFORM set_config('app.loyalty_ledger_write', 'off', true);

  RETURN NEW;
END
$$;

CREATE FUNCTION "guard_customer_loyalty_cache"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.loyalty_ledger_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW."loyaltyPoints" IS DISTINCT FROM OLD."loyaltyPoints" THEN
    RAISE EXCEPTION 'Customer loyalty balance is ledger-controlled'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "Customer_loyalty_cache_guard"
BEFORE UPDATE OF "loyaltyPoints" ON "Customer"
FOR EACH ROW EXECUTE FUNCTION "guard_customer_loyalty_cache"();
