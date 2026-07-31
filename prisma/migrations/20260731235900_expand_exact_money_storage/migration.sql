-- P1 expand migration: add exact scaled-integer representations while legacy
-- floating-point columns remain available for zero-downtime application rollout.
-- Currency amounts use minor units (scale 100). Rates and unit costs use the
-- explicitly documented scale encoded in each column name.

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "taxRateMicros" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFeeMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "minDeliveryOrderMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "MenuItem"
  ADD COLUMN "priceMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "ModifierOption"
  ADD COLUMN "priceMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Customer"
  ADD COLUMN "totalSpentMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmountMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFeeMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmountMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "tipAmountMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "totalMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem"
  ADD COLUMN "unitPriceMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "totalPriceMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "SpecialOffer"
  ADD COLUMN "discountBasisPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PromoCode"
  ADD COLUMN "discountBasisPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GiftCard"
  ADD COLUMN "amountMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "balanceMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Employee"
  ADD COLUMN "hourlyWageMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "Ingredient"
  ADD COLUMN "costPerUnitMicros" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "totalCostMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "CashDrawerEntry"
  ADD COLUMN "amountMinor" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "DynamicPricing"
  ADD COLUMN "multiplierMicros" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "ComboMeal"
  ADD COLUMN "priceMinor" BIGINT NOT NULL DEFAULT 0;

-- Deterministic backfill from the legacy columns.
UPDATE "RestaurantSettings" SET
  "taxRateMicros" = ROUND(("taxRate"::numeric) * 1000000)::bigint,
  "deliveryFeeMinor" = ROUND(("deliveryFee"::numeric) * 100)::bigint,
  "minDeliveryOrderMinor" = ROUND(("minDeliveryOrder"::numeric) * 100)::bigint;

UPDATE "MenuItem" SET
  "priceMinor" = ROUND(("price"::numeric) * 100)::bigint;

UPDATE "ModifierOption" SET
  "priceMinor" = ROUND(("price"::numeric) * 100)::bigint;

UPDATE "Customer" SET
  "totalSpentMinor" = ROUND(("totalSpent"::numeric) * 100)::bigint;

UPDATE "Order" SET
  "subtotalMinor" = ROUND(("subtotal"::numeric) * 100)::bigint,
  "taxAmountMinor" = ROUND(("taxAmount"::numeric) * 100)::bigint,
  "deliveryFeeMinor" = ROUND(("deliveryFee"::numeric) * 100)::bigint,
  "discountAmountMinor" = ROUND(("discountAmount"::numeric) * 100)::bigint,
  "tipAmountMinor" = ROUND(("tipAmount"::numeric) * 100)::bigint,
  "totalMinor" = ROUND(("total"::numeric) * 100)::bigint;

UPDATE "OrderItem" SET
  "unitPriceMinor" = ROUND(("unitPrice"::numeric) * 100)::bigint,
  "totalPriceMinor" = ROUND(("totalPrice"::numeric) * 100)::bigint;

UPDATE "SpecialOffer" SET
  "discountBasisPoints" = ROUND(("discountPercent"::numeric) * 100)::integer;

UPDATE "PromoCode" SET
  "discountBasisPoints" = ROUND(("discountPercent"::numeric) * 100)::integer;

UPDATE "GiftCard" SET
  "amountMinor" = ROUND(("amount"::numeric) * 100)::bigint,
  "balanceMinor" = ROUND(("balance"::numeric) * 100)::bigint;

UPDATE "Employee" SET
  "hourlyWageMinor" = ROUND(("hourlyWage"::numeric) * 100)::bigint;

UPDATE "Ingredient" SET
  "costPerUnitMicros" = ROUND(("costPerUnit"::numeric) * 1000000)::bigint;

UPDATE "PurchaseOrder" SET
  "totalCostMinor" = ROUND(("totalCost"::numeric) * 100)::bigint;

UPDATE "CashDrawerEntry" SET
  "amountMinor" = ROUND(("amount"::numeric) * 100)::bigint;

UPDATE "DynamicPricing" SET
  "multiplierMicros" = ROUND(("multiplier"::numeric) * 1000000)::bigint;

UPDATE "ComboMeal" SET
  "priceMinor" = ROUND(("price"::numeric) * 100)::bigint;

-- Synchronization triggers keep the expand phase compatible with application
-- versions that still write the legacy fields.
CREATE FUNCTION "sync_RestaurantSettings_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."taxRateMicros" := ROUND((NEW."taxRate"::numeric) * 1000000)::bigint;
  NEW."deliveryFeeMinor" := ROUND((NEW."deliveryFee"::numeric) * 100)::bigint;
  NEW."minDeliveryOrderMinor" := ROUND((NEW."minDeliveryOrder"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RestaurantSettings_exact_values_sync"
BEFORE INSERT OR UPDATE OF "taxRate", "deliveryFee", "minDeliveryOrder"
ON "RestaurantSettings"
FOR EACH ROW EXECUTE FUNCTION "sync_RestaurantSettings_exact_values"();

CREATE FUNCTION "sync_MenuItem_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."priceMinor" := ROUND((NEW."price"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MenuItem_exact_values_sync"
BEFORE INSERT OR UPDATE OF "price" ON "MenuItem"
FOR EACH ROW EXECUTE FUNCTION "sync_MenuItem_exact_values"();

CREATE FUNCTION "sync_ModifierOption_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."priceMinor" := ROUND((NEW."price"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ModifierOption_exact_values_sync"
BEFORE INSERT OR UPDATE OF "price" ON "ModifierOption"
FOR EACH ROW EXECUTE FUNCTION "sync_ModifierOption_exact_values"();

CREATE FUNCTION "sync_Customer_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."totalSpentMinor" := ROUND((NEW."totalSpent"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Customer_exact_values_sync"
BEFORE INSERT OR UPDATE OF "totalSpent" ON "Customer"
FOR EACH ROW EXECUTE FUNCTION "sync_Customer_exact_values"();

CREATE FUNCTION "sync_Order_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."subtotalMinor" := ROUND((NEW."subtotal"::numeric) * 100)::bigint;
  NEW."taxAmountMinor" := ROUND((NEW."taxAmount"::numeric) * 100)::bigint;
  NEW."deliveryFeeMinor" := ROUND((NEW."deliveryFee"::numeric) * 100)::bigint;
  NEW."discountAmountMinor" := ROUND((NEW."discountAmount"::numeric) * 100)::bigint;
  NEW."tipAmountMinor" := ROUND((NEW."tipAmount"::numeric) * 100)::bigint;
  NEW."totalMinor" := ROUND((NEW."total"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_exact_values_sync"
BEFORE INSERT OR UPDATE OF "subtotal", "taxAmount", "deliveryFee", "discountAmount", "tipAmount", "total"
ON "Order"
FOR EACH ROW EXECUTE FUNCTION "sync_Order_exact_values"();

CREATE FUNCTION "sync_OrderItem_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."unitPriceMinor" := ROUND((NEW."unitPrice"::numeric) * 100)::bigint;
  NEW."totalPriceMinor" := ROUND((NEW."totalPrice"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderItem_exact_values_sync"
BEFORE INSERT OR UPDATE OF "unitPrice", "totalPrice" ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "sync_OrderItem_exact_values"();

CREATE FUNCTION "sync_SpecialOffer_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."discountBasisPoints" := ROUND((NEW."discountPercent"::numeric) * 100)::integer;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SpecialOffer_exact_values_sync"
BEFORE INSERT OR UPDATE OF "discountPercent" ON "SpecialOffer"
FOR EACH ROW EXECUTE FUNCTION "sync_SpecialOffer_exact_values"();

CREATE FUNCTION "sync_PromoCode_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."discountBasisPoints" := ROUND((NEW."discountPercent"::numeric) * 100)::integer;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PromoCode_exact_values_sync"
BEFORE INSERT OR UPDATE OF "discountPercent" ON "PromoCode"
FOR EACH ROW EXECUTE FUNCTION "sync_PromoCode_exact_values"();

CREATE FUNCTION "sync_GiftCard_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."amountMinor" := ROUND((NEW."amount"::numeric) * 100)::bigint;
  NEW."balanceMinor" := ROUND((NEW."balance"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GiftCard_exact_values_sync"
BEFORE INSERT OR UPDATE OF "amount", "balance" ON "GiftCard"
FOR EACH ROW EXECUTE FUNCTION "sync_GiftCard_exact_values"();

CREATE FUNCTION "sync_Employee_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."hourlyWageMinor" := ROUND((NEW."hourlyWage"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Employee_exact_values_sync"
BEFORE INSERT OR UPDATE OF "hourlyWage" ON "Employee"
FOR EACH ROW EXECUTE FUNCTION "sync_Employee_exact_values"();

CREATE FUNCTION "sync_Ingredient_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."costPerUnitMicros" := ROUND((NEW."costPerUnit"::numeric) * 1000000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Ingredient_exact_values_sync"
BEFORE INSERT OR UPDATE OF "costPerUnit" ON "Ingredient"
FOR EACH ROW EXECUTE FUNCTION "sync_Ingredient_exact_values"();

CREATE FUNCTION "sync_PurchaseOrder_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."totalCostMinor" := ROUND((NEW."totalCost"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PurchaseOrder_exact_values_sync"
BEFORE INSERT OR UPDATE OF "totalCost" ON "PurchaseOrder"
FOR EACH ROW EXECUTE FUNCTION "sync_PurchaseOrder_exact_values"();

CREATE FUNCTION "sync_CashDrawerEntry_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."amountMinor" := ROUND((NEW."amount"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CashDrawerEntry_exact_values_sync"
BEFORE INSERT OR UPDATE OF "amount" ON "CashDrawerEntry"
FOR EACH ROW EXECUTE FUNCTION "sync_CashDrawerEntry_exact_values"();

CREATE FUNCTION "sync_DynamicPricing_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."multiplierMicros" := ROUND((NEW."multiplier"::numeric) * 1000000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "DynamicPricing_exact_values_sync"
BEFORE INSERT OR UPDATE OF "multiplier" ON "DynamicPricing"
FOR EACH ROW EXECUTE FUNCTION "sync_DynamicPricing_exact_values"();

CREATE FUNCTION "sync_ComboMeal_exact_values"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."priceMinor" := ROUND((NEW."price"::numeric) * 100)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ComboMeal_exact_values_sync"
BEFORE INSERT OR UPDATE OF "price" ON "ComboMeal"
FOR EACH ROW EXECUTE FUNCTION "sync_ComboMeal_exact_values"();

-- Bounds reject negative, non-finite (NaN/Infinity fail the upper/lower range),
-- and implausibly large values before the contract phase.
ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_taxRate_bounds" CHECK ("taxRate" >= 0 AND "taxRate" <= 1),
  ADD CONSTRAINT "RestaurantSettings_deliveryFee_bounds" CHECK ("deliveryFee" >= 0 AND "deliveryFee" <= 1000000000000),
  ADD CONSTRAINT "RestaurantSettings_minDelivery_bounds" CHECK ("minDeliveryOrder" >= 0 AND "minDeliveryOrder" <= 1000000000000),
  ADD CONSTRAINT "RestaurantSettings_exact_values_match" CHECK (
    "taxRateMicros" = ROUND(("taxRate"::numeric) * 1000000)::bigint AND
    "deliveryFeeMinor" = ROUND(("deliveryFee"::numeric) * 100)::bigint AND
    "minDeliveryOrderMinor" = ROUND(("minDeliveryOrder"::numeric) * 100)::bigint
  );

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_price_bounds" CHECK ("price" >= 0 AND "price" <= 1000000000000),
  ADD CONSTRAINT "MenuItem_exact_value_match" CHECK ("priceMinor" = ROUND(("price"::numeric) * 100)::bigint);

ALTER TABLE "ModifierOption"
  ADD CONSTRAINT "ModifierOption_price_bounds" CHECK ("price" >= 0 AND "price" <= 1000000000000),
  ADD CONSTRAINT "ModifierOption_exact_value_match" CHECK ("priceMinor" = ROUND(("price"::numeric) * 100)::bigint);

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_totalSpent_bounds" CHECK ("totalSpent" >= 0 AND "totalSpent" <= 1000000000000),
  ADD CONSTRAINT "Customer_exact_value_match" CHECK ("totalSpentMinor" = ROUND(("totalSpent"::numeric) * 100)::bigint);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_money_bounds" CHECK (
    "subtotal" >= 0 AND "subtotal" <= 1000000000000 AND
    "taxAmount" >= 0 AND "taxAmount" <= 1000000000000 AND
    "deliveryFee" >= 0 AND "deliveryFee" <= 1000000000000 AND
    "discountAmount" >= 0 AND "discountAmount" <= 1000000000000 AND
    "tipAmount" >= 0 AND "tipAmount" <= 1000000000000 AND
    "total" >= 0 AND "total" <= 1000000000000
  ),
  ADD CONSTRAINT "Order_exact_values_match" CHECK (
    "subtotalMinor" = ROUND(("subtotal"::numeric) * 100)::bigint AND
    "taxAmountMinor" = ROUND(("taxAmount"::numeric) * 100)::bigint AND
    "deliveryFeeMinor" = ROUND(("deliveryFee"::numeric) * 100)::bigint AND
    "discountAmountMinor" = ROUND(("discountAmount"::numeric) * 100)::bigint AND
    "tipAmountMinor" = ROUND(("tipAmount"::numeric) * 100)::bigint AND
    "totalMinor" = ROUND(("total"::numeric) * 100)::bigint
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_money_bounds" CHECK (
    "unitPrice" >= 0 AND "unitPrice" <= 1000000000000 AND
    "totalPrice" >= 0 AND "totalPrice" <= 1000000000000
  ),
  ADD CONSTRAINT "OrderItem_exact_values_match" CHECK (
    "unitPriceMinor" = ROUND(("unitPrice"::numeric) * 100)::bigint AND
    "totalPriceMinor" = ROUND(("totalPrice"::numeric) * 100)::bigint
  );

ALTER TABLE "SpecialOffer"
  ADD CONSTRAINT "SpecialOffer_discount_bounds" CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100),
  ADD CONSTRAINT "SpecialOffer_exact_value_match" CHECK ("discountBasisPoints" = ROUND(("discountPercent"::numeric) * 100)::integer);

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_discount_bounds" CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100),
  ADD CONSTRAINT "PromoCode_exact_value_match" CHECK ("discountBasisPoints" = ROUND(("discountPercent"::numeric) * 100)::integer);

ALTER TABLE "GiftCard"
  ADD CONSTRAINT "GiftCard_money_bounds" CHECK (
    "amount" >= 0 AND "amount" <= 1000000000000 AND
    "balance" >= 0 AND "balance" <= "amount"
  ),
  ADD CONSTRAINT "GiftCard_exact_values_match" CHECK (
    "amountMinor" = ROUND(("amount"::numeric) * 100)::bigint AND
    "balanceMinor" = ROUND(("balance"::numeric) * 100)::bigint
  );

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_hourlyWage_bounds" CHECK ("hourlyWage" >= 0 AND "hourlyWage" <= 1000000),
  ADD CONSTRAINT "Employee_exact_value_match" CHECK ("hourlyWageMinor" = ROUND(("hourlyWage"::numeric) * 100)::bigint);

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_cost_bounds" CHECK ("costPerUnit" >= 0 AND "costPerUnit" <= 1000000000000),
  ADD CONSTRAINT "Ingredient_exact_value_match" CHECK ("costPerUnitMicros" = ROUND(("costPerUnit"::numeric) * 1000000)::bigint);

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_cost_bounds" CHECK ("totalCost" >= 0 AND "totalCost" <= 1000000000000),
  ADD CONSTRAINT "PurchaseOrder_exact_value_match" CHECK ("totalCostMinor" = ROUND(("totalCost"::numeric) * 100)::bigint);

ALTER TABLE "CashDrawerEntry"
  ADD CONSTRAINT "CashDrawerEntry_amount_bounds" CHECK ("amount" >= 0 AND "amount" <= 1000000000000),
  ADD CONSTRAINT "CashDrawerEntry_exact_value_match" CHECK ("amountMinor" = ROUND(("amount"::numeric) * 100)::bigint);

ALTER TABLE "DynamicPricing"
  ADD CONSTRAINT "DynamicPricing_multiplier_bounds" CHECK ("multiplier" > 0 AND "multiplier" <= 10),
  ADD CONSTRAINT "DynamicPricing_exact_value_match" CHECK ("multiplierMicros" = ROUND(("multiplier"::numeric) * 1000000)::bigint);

ALTER TABLE "ComboMeal"
  ADD CONSTRAINT "ComboMeal_price_bounds" CHECK ("price" >= 0 AND "price" <= 1000000000000),
  ADD CONSTRAINT "ComboMeal_exact_value_match" CHECK ("priceMinor" = ROUND(("price"::numeric) * 100)::bigint);
