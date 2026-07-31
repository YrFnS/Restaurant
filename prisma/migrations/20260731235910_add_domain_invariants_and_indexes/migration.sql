-- P1-A03/P1-A07: add reviewed non-financial and cross-field invariants.
-- Constraints are added NOT VALID and then validated so existing data is
-- checked explicitly while reducing the strongest table-lock duration.

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_operational_values_check" CHECK (
    "deliveryRadiusKm" >= 0
    AND "avgPrepTimeMin" BETWEEN 1 AND 600
    AND "statsOrdersServed" >= 0
    AND "statsHappyCustomers" >= 0
    AND "statsYearsService" BETWEEN 0 AND 1000
    AND "kdsGreenMin" BETWEEN 0 AND 1440
    AND "kdsYellowMin" BETWEEN 0 AND 1440
    AND "kdsRedMin" BETWEEN 0 AND 1440
    AND "kdsGreenMin" <= "kdsYellowMin"
    AND "kdsYellowMin" <= "kdsRedMin"
  ) NOT VALID;
ALTER TABLE "RestaurantSettings" VALIDATE CONSTRAINT "RestaurantSettings_operational_values_check";

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_operational_values_check" CHECK (
    "preparationTime" BETWEEN 0 AND 1440
    AND "calories" >= 0
  ) NOT VALID;
ALTER TABLE "MenuItem" VALIDATE CONSTRAINT "MenuItem_operational_values_check";

ALTER TABLE "ModifierGroup"
  ADD CONSTRAINT "ModifierGroup_selection_bounds_check" CHECK (
    "minSelect" >= 0
    AND "maxSelect" BETWEEN 1 AND 100
    AND "minSelect" <= "maxSelect"
  ) NOT VALID;
ALTER TABLE "ModifierGroup" VALIDATE CONSTRAINT "ModifierGroup_selection_bounds_check";

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_activity_values_check" CHECK (
    "loyaltyPoints" >= 0
    AND "visits" >= 0
  ) NOT VALID;
ALTER TABLE "Customer" VALIDATE CONSTRAINT "Customer_activity_values_check";

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_exact_total_equation_check" CHECK (
    "totalMinor" =
      "subtotalMinor"
      + "taxAmountMinor"
      + "deliveryFeeMinor"
      - "discountAmountMinor"
      + "tipAmountMinor"
  ) NOT VALID;
ALTER TABLE "Order" VALIDATE CONSTRAINT "Order_exact_total_equation_check";

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_course_check" CHECK (
    "quantity" BETWEEN 1 AND 1000
    AND "course" BETWEEN 1 AND 100
  ) NOT VALID;
ALTER TABLE "OrderItem" VALIDATE CONSTRAINT "OrderItem_quantity_course_check";

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_exact_total_equation_check" CHECK (
    "totalPriceMinor" = "unitPriceMinor" * "quantity"
  ) NOT VALID;
ALTER TABLE "OrderItem" VALIDATE CONSTRAINT "OrderItem_exact_total_equation_check";

ALTER TABLE "RestaurantTable"
  ADD CONSTRAINT "RestaurantTable_geometry_capacity_check" CHECK (
    "number" > 0
    AND "capacity" > 0
    AND "width" > 0
    AND "height" > 0
  ) NOT VALID;
ALTER TABLE "RestaurantTable" VALIDATE CONSTRAINT "RestaurantTable_geometry_capacity_check";

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_party_size_check" CHECK (
    "partySize" BETWEEN 1 AND 50
  ) NOT VALID;
ALTER TABLE "Reservation" VALIDATE CONSTRAINT "Reservation_party_size_check";

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_party_wait_check" CHECK (
    "partySize" BETWEEN 1 AND 50
    AND "estimatedWait" BETWEEN 0 AND 1440
  ) NOT VALID;
ALTER TABLE "WaitlistEntry" VALIDATE CONSTRAINT "WaitlistEntry_party_wait_check";

ALTER TABLE "SpecialOffer"
  ADD CONSTRAINT "SpecialOffer_discount_range_check" CHECK (
    "discountBasisPoints" BETWEEN 0 AND 10000
  ) NOT VALID;
ALTER TABLE "SpecialOffer" VALIDATE CONSTRAINT "SpecialOffer_discount_range_check";

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_discount_range_check" CHECK (
    "discountBasisPoints" BETWEEN 0 AND 10000
  ) NOT VALID;
ALTER TABLE "PromoCode" VALIDATE CONSTRAINT "PromoCode_discount_range_check";

ALTER TABLE "RewardTier"
  ADD CONSTRAINT "RewardTier_points_check" CHECK ("points" >= 0) NOT VALID;
ALTER TABLE "RewardTier" VALIDATE CONSTRAINT "RewardTier_points_check";

ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "Feedback" VALIDATE CONSTRAINT "Feedback_rating_check";

ALTER TABLE "Testimonial"
  ADD CONSTRAINT "Testimonial_stars_check" CHECK ("stars" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "Testimonial" VALIDATE CONSTRAINT "Testimonial_stars_check";

ALTER TABLE "Schedule"
  ADD CONSTRAINT "Schedule_day_of_week_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6) NOT VALID;
ALTER TABLE "Schedule" VALIDATE CONSTRAINT "Schedule_day_of_week_check";

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_stock_levels_check" CHECK (
    "quantity" >= 0
    AND "lowThreshold" >= 0
  ) NOT VALID;
ALTER TABLE "Ingredient" VALIDATE CONSTRAINT "Ingredient_stock_levels_check";

ALTER TABLE "WasteLog"
  ADD CONSTRAINT "WasteLog_quantity_check" CHECK ("quantity" > 0) NOT VALID;
ALTER TABLE "WasteLog" VALIDATE CONSTRAINT "WasteLog_quantity_check";

ALTER TABLE "KitchenStation"
  ADD CONSTRAINT "KitchenStation_prep_target_check" CHECK (
    "targetPrepMin" BETWEEN 1 AND 1440
  ) NOT VALID;
ALTER TABLE "KitchenStation" VALIDATE CONSTRAINT "KitchenStation_prep_target_check";

ALTER TABLE "KitchenScreen"
  ADD CONSTRAINT "KitchenScreen_refresh_limit_check" CHECK (
    "autoRefreshSec" BETWEEN 1 AND 3600
    AND "maxOrders" >= 0
  ) NOT VALID;
ALTER TABLE "KitchenScreen" VALIDATE CONSTRAINT "KitchenScreen_refresh_limit_check";

ALTER TABLE "DynamicPricing"
  ADD CONSTRAINT "DynamicPricing_multiplier_range_check" CHECK (
    "multiplierMicros" BETWEEN 1 AND 10000000
  ) NOT VALID;
ALTER TABLE "DynamicPricing" VALIDATE CONSTRAINT "DynamicPricing_multiplier_range_check";

ALTER TABLE "StaffSession"
  ADD CONSTRAINT "StaffSession_expiry_check" CHECK (
    "expiresAt" > "createdAt"
    AND "lastSeenAt" >= "createdAt"
  ) NOT VALID;
ALTER TABLE "StaffSession" VALIDATE CONSTRAINT "StaffSession_expiry_check";

ALTER TABLE "RateLimitCounter"
  ADD CONSTRAINT "RateLimitCounter_window_check" CHECK (
    "count" >= 0
    AND "expiresAt" > "createdAt"
  ) NOT VALID;
ALTER TABLE "RateLimitCounter" VALIDATE CONSTRAINT "RateLimitCounter_window_check";

ALTER TABLE "KdsOutboxEvent"
  ADD CONSTRAINT "KdsOutboxEvent_attempts_check" CHECK ("attempts" >= 0) NOT VALID;
ALTER TABLE "KdsOutboxEvent" VALIDATE CONSTRAINT "KdsOutboxEvent_attempts_check";

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_amount_shape_check" CHECK (
    "amountCents" >= 0
    AND ("tenderedCents" IS NULL OR "tenderedCents" >= 0)
    AND ("changeCents" IS NULL OR "changeCents" >= 0)
    AND (
      "method" <> 'cash'::"PaymentMethod"
      OR "eventType" <> 'capture'::"PaymentEventType"
      OR "status" <> 'succeeded'::"PaymentEventStatus"
      OR (
        "tenderedCents" IS NOT NULL
        AND "changeCents" IS NOT NULL
        AND "tenderedCents" = "amountCents" + "changeCents"
      )
    )
  ) NOT VALID;
ALTER TABLE "PaymentEvent" VALIDATE CONSTRAINT "PaymentEvent_amount_shape_check";

-- Race-safe operational indexes.
CREATE UNIQUE INDEX "WaitlistEntry_active_phone_key"
  ON "WaitlistEntry"("customerPhone")
  WHERE "status" IN ('waiting'::"WaitlistStatus", 'notified'::"WaitlistStatus");

CREATE INDEX "Order_status_createdAt_idx"
  ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentStatus_createdAt_idx"
  ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_customerId_createdAt_idx"
  ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_tableId_status_idx"
  ON "Order"("tableId", "status");

CREATE INDEX "OrderItem_orderId_status_idx"
  ON "OrderItem"("orderId", "status");
CREATE INDEX "OrderItem_stationSlug_status_createdAt_idx"
  ON "OrderItem"("stationSlug", "status", "createdAt");

CREATE INDEX "Reservation_dateTime_status_idx"
  ON "Reservation"("dateTime", "status");
CREATE INDEX "Reservation_tableId_dateTime_status_idx"
  ON "Reservation"("tableId", "dateTime", "status");
CREATE INDEX "Reservation_customerPhone_dateTime_idx"
  ON "Reservation"("customerPhone", "dateTime");

CREATE INDEX "WaitlistEntry_status_createdAt_idx"
  ON "WaitlistEntry"("status", "createdAt");
CREATE INDEX "CashDrawerEntry_type_createdAt_idx"
  ON "CashDrawerEntry"("type", "createdAt");
CREATE INDEX "Employee_role_isActive_idx"
  ON "Employee"("role", "isActive");
