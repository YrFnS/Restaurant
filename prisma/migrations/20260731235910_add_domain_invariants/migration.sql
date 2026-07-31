-- P1 domain invariants. Constraints are added NOT VALID first so new writes
-- are protected immediately, then validated against all adopted legacy rows.

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_operational_bounds" CHECK (
    "avgPrepTimeMin" BETWEEN 1 AND 600 AND
    "kdsGreenMin" >= 0 AND
    "kdsYellowMin" >= "kdsGreenMin" AND
    "kdsRedMin" >= "kdsYellowMin"
  ) NOT VALID;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_operational_bounds" CHECK (
    "preparationTime" BETWEEN 0 AND 1440 AND
    "calories" BETWEEN 0 AND 100000
  ) NOT VALID;

ALTER TABLE "ModifierGroup"
  ADD CONSTRAINT "ModifierGroup_selection_bounds" CHECK (
    "minSelect" >= 0 AND
    "maxSelect" >= 1 AND
    "minSelect" <= "maxSelect" AND
    (NOT "isRequired" OR "minSelect" >= 1)
  ) NOT VALID;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_loyalty_bounds" CHECK (
    "loyaltyPoints" >= 0 AND
    "visits" >= 0
  ) NOT VALID;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_discount_bounds" CHECK (
    "discountAmount" <= "subtotal"
  ) NOT VALID;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_operational_bounds" CHECK (
    "quantity" > 0 AND
    "quantity" <= 10000 AND
    "course" >= 1 AND
    "course" <= 100 AND
    ("seatNumber" IS NULL OR "seatNumber" > 0)
  ) NOT VALID;

ALTER TABLE "RestaurantTable"
  ADD CONSTRAINT "RestaurantTable_geometry_bounds" CHECK (
    "capacity" > 0 AND
    "capacity" <= 1000 AND
    "x" BETWEEN -1000000 AND 1000000 AND
    "y" BETWEEN -1000000 AND 1000000 AND
    "width" > 0 AND
    "width" <= 100000 AND
    "height" > 0 AND
    "height" <= 100000
  ) NOT VALID;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_party_size_bounds" CHECK (
    "partySize" > 0 AND "partySize" <= 1000
  ) NOT VALID;

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_operational_bounds" CHECK (
    "partySize" > 0 AND
    "partySize" <= 1000 AND
    "estimatedWait" >= 0 AND
    "estimatedWait" <= 1440
  ) NOT VALID;

ALTER TABLE "RewardTier"
  ADD CONSTRAINT "RewardTier_points_bounds" CHECK (
    "points" >= 0
  ) NOT VALID;

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_rating_bounds" CHECK (
    "rating" BETWEEN 1 AND 5
  ) NOT VALID;

ALTER TABLE "Testimonial"
  ADD CONSTRAINT "Testimonial_stars_bounds" CHECK (
    "stars" BETWEEN 1 AND 5
  ) NOT VALID;

ALTER TABLE "Schedule"
  ADD CONSTRAINT "Schedule_day_bounds" CHECK (
    "dayOfWeek" BETWEEN 0 AND 6
  ) NOT VALID;

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_stock_bounds" CHECK (
    "quantity" >= 0 AND
    "quantity" <= 1000000000000000 AND
    "lowThreshold" >= 0 AND
    "lowThreshold" <= 1000000000000000
  ) NOT VALID;

ALTER TABLE "WasteLog"
  ADD CONSTRAINT "WasteLog_quantity_bounds" CHECK (
    "quantity" > 0 AND "quantity" <= 1000000000000000
  ) NOT VALID;

ALTER TABLE "KitchenStation"
  ADD CONSTRAINT "KitchenStation_prep_bounds" CHECK (
    "targetPrepMin" BETWEEN 1 AND 1440
  ) NOT VALID;

ALTER TABLE "KitchenScreen"
  ADD CONSTRAINT "KitchenScreen_operational_bounds" CHECK (
    "autoRefreshSec" BETWEEN 1 AND 3600 AND
    "maxOrders" BETWEEN 0 AND 10000
  ) NOT VALID;

ALTER TABLE "RateLimitCounter"
  ADD CONSTRAINT "RateLimitCounter_count_bounds" CHECK (
    "count" >= 0
  ) NOT VALID;

ALTER TABLE "KdsOutboxEvent"
  ADD CONSTRAINT "KdsOutboxEvent_attempt_bounds" CHECK (
    "attempts" >= 0
  ) NOT VALID;

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_financial_consistency" CHECK (
    "amountCents" > 0 AND
    ("tenderedCents" IS NULL OR "tenderedCents" >= "amountCents") AND
    ("changeCents" IS NULL OR "changeCents" >= 0) AND
    (
      "method" <> 'cash' OR
      "eventType" <> 'capture' OR
      "status" <> 'succeeded' OR
      (
        "tenderedCents" IS NOT NULL AND
        "changeCents" IS NOT NULL AND
        "changeCents" = "tenderedCents" - "amountCents"
      )
    )
  ) NOT VALID;

ALTER TABLE "RestaurantSettings" VALIDATE CONSTRAINT "RestaurantSettings_operational_bounds";
ALTER TABLE "MenuItem" VALIDATE CONSTRAINT "MenuItem_operational_bounds";
ALTER TABLE "ModifierGroup" VALIDATE CONSTRAINT "ModifierGroup_selection_bounds";
ALTER TABLE "Customer" VALIDATE CONSTRAINT "Customer_loyalty_bounds";
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_discount_bounds";
ALTER TABLE "OrderItem" VALIDATE CONSTRAINT "OrderItem_operational_bounds";
ALTER TABLE "RestaurantTable" VALIDATE CONSTRAINT "RestaurantTable_geometry_bounds";
ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_party_size_bounds";
ALTER TABLE "WaitlistEntry" VALIDATE CONSTRAINT "WaitlistEntry_operational_bounds";
ALTER TABLE "RewardTier" VALIDATE CONSTRAINT "RewardTier_points_bounds";
ALTER TABLE "Feedback" VALIDATE CONSTRAINT "Feedback_rating_bounds";
ALTER TABLE "Testimonial" VALIDATE CONSTRAINT "Testimonial_stars_bounds";
ALTER TABLE "Schedule" VALIDATE CONSTRAINT "Schedule_day_bounds";
ALTER TABLE "Ingredient" VALIDATE CONSTRAINT "Ingredient_stock_bounds";
ALTER TABLE "WasteLog" VALIDATE CONSTRAINT "WasteLog_quantity_bounds";
ALTER TABLE "KitchenStation" VALIDATE CONSTRAINT "KitchenStation_prep_bounds";
ALTER TABLE "KitchenScreen" VALIDATE CONSTRAINT "KitchenScreen_operational_bounds";
ALTER TABLE "RateLimitCounter" VALIDATE CONSTRAINT "RateLimitCounter_count_bounds";
ALTER TABLE "KdsOutboxEvent" VALIDATE CONSTRAINT "KdsOutboxEvent_attempt_bounds";
ALTER TABLE "PaymentEvent" VALIDATE CONSTRAINT "PaymentEvent_financial_consistency";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "WaitlistEntry"
    WHERE "status" IN ('waiting', 'notified')
    GROUP BY "customerPhone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce active waitlist uniqueness: duplicate active customer phone values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PaymentEvent"
    WHERE "eventType" = 'capture' AND "status" = 'succeeded'
    GROUP BY "orderId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one successful capture per order: duplicate captures exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "WaitlistEntry_one_active_phone_idx"
ON "WaitlistEntry" ("customerPhone")
WHERE "status" IN ('waiting', 'notified');

CREATE UNIQUE INDEX "PaymentEvent_one_succeeded_capture_per_order_idx"
ON "PaymentEvent" ("orderId")
WHERE "eventType" = 'capture' AND "status" = 'succeeded';

CREATE INDEX "Reservation_active_datetime_idx"
ON "Reservation" ("dateTime")
WHERE "status" IN ('confirmed', 'seated');

CREATE INDEX "Order_active_createdAt_idx"
ON "Order" ("createdAt")
WHERE "status" IN ('pending', 'confirmed', 'preparing', 'ready');
