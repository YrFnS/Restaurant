-- P1 supplier, purchase-order, partial-receiving, and receipt-correction workflow.
-- Commercial quantities use micros. Purchase-unit and base-unit costs use
-- currency micros; posted totals use currency minor units.

CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'draft',
  'submitted',
  'partially_received',
  'received',
  'cancelled'
);
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('posted', 'reversed');

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "paymentTerms" TEXT NOT NULL DEFAULT '',
  "notes" TEXT,
  "status" "SupplierStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Supplier_shape" CHECK (
    char_length(btrim("code")) BETWEEN 1 AND 40 AND
    "code" = upper(btrim("code")) AND
    char_length(btrim("name")) BETWEEN 1 AND 240 AND
    char_length("contactName") <= 160 AND
    char_length("phone") <= 80 AND
    char_length("email") <= 254 AND
    char_length("address") <= 1000 AND
    char_length("paymentTerms") <= 500 AND
    char_length(COALESCE("notes", '')) <= 2000
  )
);

CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");
CREATE INDEX "Supplier_status_name_idx" ON "Supplier"("status", "name");

-- Adopt legacy free-text suppliers before adding the relationship.
INSERT INTO "Supplier" (
  "id", "code", "name", "notes", "status", "createdAt", "updatedAt"
)
SELECT
  'supplier_' || md5(lower(btrim(legacy."supplier"))),
  'LEGACY-' || upper(substr(md5(lower(btrim(legacy."supplier"))), 1, 10)),
  MIN(btrim(legacy."supplier")),
  'Created while adopting legacy purchase-order supplier text',
  'active'::"SupplierStatus",
  MIN(legacy."createdAt"),
  MAX(legacy."updatedAt")
FROM "PurchaseOrder" AS legacy
WHERE char_length(btrim(legacy."supplier")) > 0
GROUP BY lower(btrim(legacy."supplier"))
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "orderNumber" TEXT,
  ADD COLUMN "creationKey" TEXT,
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "supplierCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "expectedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "createdByName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "submittedByName" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelledByName" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "legacyImported" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PurchaseOrder" AS purchase_order
SET
  "orderNumber" = 'PO-LEGACY-' || upper(substr(md5(purchase_order."id"), 1, 12)),
  "creationKey" = 'migration-purchase-order:' || purchase_order."id",
  "supplierId" = supplier."id",
  "supplierCode" = supplier."code",
  "currency" = COALESCE(
    (SELECT NULLIF(btrim(settings."currency"), '') FROM "RestaurantSettings" AS settings WHERE settings."id" = '1'),
    'USD'
  ),
  "createdByName" = 'Migration',
  "submittedByName" = CASE
    WHEN lower(purchase_order."status") IN ('ordered', 'submitted', 'partially_received', 'received') THEN 'Migration'
    ELSE NULL
  END,
  "submittedAt" = CASE
    WHEN lower(purchase_order."status") IN ('ordered', 'submitted', 'partially_received', 'received') THEN purchase_order."createdAt"
    ELSE NULL
  END,
  "cancelledByName" = CASE WHEN lower(purchase_order."status") = 'cancelled' THEN 'Migration' ELSE NULL END,
  "cancelledAt" = CASE WHEN lower(purchase_order."status") = 'cancelled' THEN purchase_order."updatedAt" ELSE NULL END,
  "cancellationReason" = CASE WHEN lower(purchase_order."status") = 'cancelled' THEN 'Legacy cancellation' ELSE NULL END,
  "legacyImported" = true
FROM "Supplier" AS supplier
WHERE supplier."id" = 'supplier_' || md5(lower(btrim(purchase_order."supplier")));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PurchaseOrder"
    WHERE lower("status") NOT IN (
      'draft', 'ordered', 'submitted', 'partially_received', 'received', 'cancelled'
    )
  ) THEN
    RAISE EXCEPTION 'Cannot adopt purchase orders: unknown legacy status exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PurchaseOrder"
    WHERE "supplierId" IS NULL OR "orderNumber" IS NULL OR "creationKey" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot adopt purchase orders: supplier or reference backfill failed';
  END IF;
END
$$;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "status" TYPE "PurchaseOrderStatus"
  USING (
    CASE lower("status")
      WHEN 'draft' THEN 'draft'
      WHEN 'ordered' THEN 'submitted'
      WHEN 'submitted' THEN 'submitted'
      WHEN 'partially_received' THEN 'partially_received'
      WHEN 'received' THEN 'received'
      WHEN 'cancelled' THEN 'cancelled'
    END
  )::"PurchaseOrderStatus";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "orderNumber" SET NOT NULL,
  ALTER COLUMN "creationKey" SET NOT NULL,
  ALTER COLUMN "supplierId" SET NOT NULL,
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PurchaseOrder_reference_shape" CHECK (
    char_length(btrim("orderNumber")) BETWEEN 1 AND 80 AND
    char_length(btrim("creationKey")) BETWEEN 16 AND 191 AND
    char_length(btrim("supplier")) BETWEEN 1 AND 240 AND
    char_length(btrim("supplierCode")) BETWEEN 1 AND 40 AND
    char_length(btrim("currency")) BETWEEN 3 AND 8 AND
    char_length(COALESCE("notes", '')) <= 4000 AND
    char_length(COALESCE("cancellationReason", '')) <= 2000
  ),
  ADD CONSTRAINT "PurchaseOrder_state_shape" CHECK (
    (
      "status" = 'draft' AND
      "submittedAt" IS NULL AND
      "cancelledAt" IS NULL
    ) OR
    (
      "status" IN ('submitted', 'partially_received', 'received') AND
      "submittedAt" IS NOT NULL AND
      "cancelledAt" IS NULL
    ) OR
    (
      "status" = 'cancelled' AND
      "cancelledAt" IS NOT NULL AND
      char_length(btrim(COALESCE("cancellationReason", ''))) > 0
    )
  );

CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");
CREATE UNIQUE INDEX "PurchaseOrder_creationKey_key" ON "PurchaseOrder"("creationKey");
CREATE INDEX "PurchaseOrder_supplier_status_createdAt_idx"
  ON "PurchaseOrder"("supplierId", "status", "createdAt" DESC);
CREATE INDEX "PurchaseOrder_status_expectedAt_idx"
  ON "PurchaseOrder"("status", "expectedAt");

CREATE TABLE "PurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "ingredientName" TEXT NOT NULL,
  "baseUnit" TEXT NOT NULL,
  "purchaseUnit" TEXT NOT NULL,
  "conversionToBaseMicros" BIGINT NOT NULL,
  "orderedPurchaseQuantityMicros" BIGINT NOT NULL,
  "orderedBaseQuantityMicros" BIGINT NOT NULL,
  "receivedBaseQuantityMicros" BIGINT NOT NULL DEFAULT 0,
  "purchaseUnitCostMicros" BIGINT NOT NULL,
  "baseUnitCostMicros" BIGINT NOT NULL,
  "lineTotalMinor" BIGINT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderLine_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderLine_shape" CHECK (
    "lineNumber" BETWEEN 1 AND 10000 AND
    char_length(btrim("ingredientName")) BETWEEN 1 AND 240 AND
    char_length(btrim("baseUnit")) BETWEEN 1 AND 40 AND
    char_length(btrim("purchaseUnit")) BETWEEN 1 AND 40 AND
    "conversionToBaseMicros" BETWEEN 1 AND 9007199254740991 AND
    "orderedPurchaseQuantityMicros" BETWEEN 1 AND 9007199254740991 AND
    "orderedBaseQuantityMicros" BETWEEN 1 AND 9007199254740991 AND
    "receivedBaseQuantityMicros" BETWEEN 0 AND "orderedBaseQuantityMicros" AND
    "purchaseUnitCostMicros" BETWEEN 1 AND 9007199254740991 AND
    "baseUnitCostMicros" BETWEEN 1 AND 9007199254740991 AND
    "lineTotalMinor" BETWEEN 0 AND 9007199254740991 AND
    "orderedBaseQuantityMicros" = ROUND(
      "orderedPurchaseQuantityMicros"::numeric *
      "conversionToBaseMicros"::numeric / 1000000
    )::bigint AND
    "baseUnitCostMicros" = ROUND(
      "purchaseUnitCostMicros"::numeric * 1000000 /
      "conversionToBaseMicros"::numeric
    )::bigint AND
    "lineTotalMinor" = ROUND(
      "orderedPurchaseQuantityMicros"::numeric *
      "purchaseUnitCostMicros"::numeric / 10000000000
    )::bigint AND
    char_length(COALESCE("notes", '')) <= 2000
  )
);

CREATE UNIQUE INDEX "PurchaseOrderLine_order_lineNumber_key"
  ON "PurchaseOrderLine"("purchaseOrderId", "lineNumber");
CREATE INDEX "PurchaseOrderLine_ingredient_createdAt_idx"
  ON "PurchaseOrderLine"("ingredientId", "createdAt" DESC);
CREATE INDEX "PurchaseOrderLine_order_received_idx"
  ON "PurchaseOrderLine"("purchaseOrderId", "receivedBaseQuantityMicros");

CREATE TABLE "PurchaseReceipt" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reversalKey" TEXT,
  "purchaseOrderId" TEXT NOT NULL,
  "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'posted',
  "totalCostMinor" BIGINT NOT NULL DEFAULT 0,
  "notes" TEXT,
  "receivedById" TEXT NOT NULL,
  "receivedByName" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedById" TEXT,
  "reversedByName" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceipt_shape" CHECK (
    char_length(btrim("receiptNumber")) BETWEEN 1 AND 80 AND
    char_length(btrim("idempotencyKey")) BETWEEN 16 AND 191 AND
    ("reversalKey" IS NULL OR char_length(btrim("reversalKey")) BETWEEN 16 AND 191) AND
    "totalCostMinor" BETWEEN 0 AND 9007199254740991 AND
    char_length(btrim("receivedById")) BETWEEN 1 AND 191 AND
    char_length(btrim("receivedByName")) BETWEEN 1 AND 160 AND
    char_length(COALESCE("notes", '')) <= 4000 AND
    char_length(COALESCE("reversalReason", '')) <= 2000
  ),
  CONSTRAINT "PurchaseReceipt_state_shape" CHECK (
    (
      "status" = 'posted' AND
      "reversalKey" IS NULL AND
      "reversedAt" IS NULL AND
      "reversedById" IS NULL AND
      "reversalReason" IS NULL
    ) OR
    (
      "status" = 'reversed' AND
      "reversalKey" IS NOT NULL AND
      "reversedAt" IS NOT NULL AND
      "reversedById" IS NOT NULL AND
      char_length(btrim(COALESCE("reversalReason", ''))) > 0
    )
  )
);

CREATE UNIQUE INDEX "PurchaseReceipt_receiptNumber_key" ON "PurchaseReceipt"("receiptNumber");
CREATE UNIQUE INDEX "PurchaseReceipt_idempotencyKey_key" ON "PurchaseReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "PurchaseReceipt_reversalKey_key"
  ON "PurchaseReceipt"("reversalKey") WHERE "reversalKey" IS NOT NULL;
CREATE INDEX "PurchaseReceipt_order_createdAt_idx"
  ON "PurchaseReceipt"("purchaseOrderId", "createdAt" DESC);
CREATE INDEX "PurchaseReceipt_status_createdAt_idx"
  ON "PurchaseReceipt"("status", "createdAt" DESC);

CREATE TABLE "PurchaseReceiptLine" (
  "id" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "ingredientName" TEXT NOT NULL,
  "submittedUnit" TEXT NOT NULL,
  "submittedQuantityMicros" BIGINT NOT NULL,
  "conversionToBaseMicros" BIGINT NOT NULL,
  "baseQuantityMicros" BIGINT NOT NULL,
  "purchaseUnitCostMicros" BIGINT NOT NULL,
  "baseUnitCostMicros" BIGINT NOT NULL,
  "totalCostMinor" BIGINT NOT NULL,
  "stockMovementId" TEXT NOT NULL,
  "reversalMovementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceiptLine_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceiptLine_purchaseOrderLineId_fkey"
    FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceiptLine_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceiptLine_stockMovementId_fkey"
    FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceiptLine_reversalMovementId_fkey"
    FOREIGN KEY ("reversalMovementId") REFERENCES "StockMovement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseReceiptLine_shape" CHECK (
    char_length(btrim("ingredientName")) BETWEEN 1 AND 240 AND
    char_length(btrim("submittedUnit")) BETWEEN 1 AND 40 AND
    "submittedQuantityMicros" BETWEEN 1 AND 9007199254740991 AND
    "conversionToBaseMicros" BETWEEN 1 AND 9007199254740991 AND
    "baseQuantityMicros" BETWEEN 1 AND 9007199254740991 AND
    "purchaseUnitCostMicros" BETWEEN 1 AND 9007199254740991 AND
    "baseUnitCostMicros" BETWEEN 1 AND 9007199254740991 AND
    "totalCostMinor" BETWEEN 0 AND 9007199254740991 AND
    "baseQuantityMicros" = ROUND(
      "submittedQuantityMicros"::numeric *
      "conversionToBaseMicros"::numeric / 1000000
    )::bigint AND
    "baseUnitCostMicros" = ROUND(
      "purchaseUnitCostMicros"::numeric * 1000000 /
      "conversionToBaseMicros"::numeric
    )::bigint AND
    "totalCostMinor" = ROUND(
      "baseQuantityMicros"::numeric *
      "baseUnitCostMicros"::numeric / 10000000000
    )::bigint
  )
);

CREATE UNIQUE INDEX "PurchaseReceiptLine_receipt_orderLine_key"
  ON "PurchaseReceiptLine"("receiptId", "purchaseOrderLineId");
CREATE UNIQUE INDEX "PurchaseReceiptLine_stockMovement_key"
  ON "PurchaseReceiptLine"("stockMovementId");
CREATE UNIQUE INDEX "PurchaseReceiptLine_reversalMovement_key"
  ON "PurchaseReceiptLine"("reversalMovementId")
  WHERE "reversalMovementId" IS NOT NULL;
CREATE INDEX "PurchaseReceiptLine_orderLine_createdAt_idx"
  ON "PurchaseReceiptLine"("purchaseOrderLineId", "createdAt" DESC);
CREATE INDEX "PurchaseReceiptLine_ingredient_createdAt_idx"
  ON "PurchaseReceiptLine"("ingredientId", "createdAt" DESC);

CREATE FUNCTION "recalculate_purchase_order_total"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id TEXT;
  next_total BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD."purchaseOrderId";
  ELSE
    target_order_id := NEW."purchaseOrderId";
  END IF;

  SELECT COALESCE(SUM("lineTotalMinor"), 0)::bigint
    INTO next_total
  FROM "PurchaseOrderLine"
  WHERE "purchaseOrderId" = target_order_id;

  PERFORM set_config('app.purchase_order_internal', 'on', true);
  UPDATE "PurchaseOrder"
  SET
    "totalCostMinor" = next_total,
    "totalCost" = (next_total::numeric / 100)::double precision,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = target_order_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "PurchaseOrderLine_recalculate_total_insert"
AFTER INSERT ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "recalculate_purchase_order_total"();
CREATE TRIGGER "PurchaseOrderLine_recalculate_total_update"
AFTER UPDATE OF "lineTotalMinor" ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "recalculate_purchase_order_total"();
CREATE TRIGGER "PurchaseOrderLine_recalculate_total_delete"
AFTER DELETE ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "recalculate_purchase_order_total"();

CREATE FUNCTION "protect_purchase_order_header"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  internal_total BOOLEAN;
  internal_receipt BOOLEAN;
  posted_receipts INTEGER;
BEGIN
  internal_total := current_setting('app.purchase_order_internal', true) = 'on';
  internal_receipt := current_setting('app.purchase_receipt_write', true) = 'on';

  IF (
    NEW."totalCost" IS DISTINCT FROM OLD."totalCost" OR
    NEW."totalCostMinor" IS DISTINCT FROM OLD."totalCostMinor"
  ) AND NOT internal_total THEN
    RAISE EXCEPTION 'Purchase-order totals are line-controlled'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."status" <> 'draft' AND (
    NEW."supplierId" IS DISTINCT FROM OLD."supplierId" OR
    NEW."supplier" IS DISTINCT FROM OLD."supplier" OR
    NEW."supplierCode" IS DISTINCT FROM OLD."supplierCode" OR
    NEW."currency" IS DISTINCT FROM OLD."currency" OR
    NEW."expectedAt" IS DISTINCT FROM OLD."expectedAt" OR
    NEW."notes" IS DISTINCT FROM OLD."notes"
  ) THEN
    RAISE EXCEPTION 'Submitted purchase-order commercial terms are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF internal_receipt THEN
      IF OLD."status" NOT IN ('submitted', 'partially_received', 'received') OR
         NEW."status" NOT IN ('submitted', 'partially_received', 'received') THEN
        RAISE EXCEPTION 'Invalid receipt-driven purchase-order transition'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NOT (
        (OLD."status" = 'draft' AND NEW."status" IN ('submitted', 'cancelled')) OR
        (OLD."status" = 'submitted' AND NEW."status" = 'cancelled')
      ) THEN
        RAISE EXCEPTION 'Invalid purchase-order status transition'
          USING ERRCODE = '23514';
      END IF;

      IF NEW."status" = 'cancelled' THEN
        SELECT COUNT(*)::integer INTO posted_receipts
        FROM "PurchaseReceipt"
        WHERE "purchaseOrderId" = OLD."id" AND "status" = 'posted';
        IF posted_receipts > 0 THEN
          RAISE EXCEPTION 'A received purchase order cannot be cancelled'
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;

  IF OLD."status" = 'cancelled' AND (
    NEW."status" IS DISTINCT FROM OLD."status" OR
    NEW."cancelledAt" IS DISTINCT FROM OLD."cancelledAt" OR
    NEW."cancellationReason" IS DISTINCT FROM OLD."cancellationReason"
  ) THEN
    RAISE EXCEPTION 'Cancelled purchase orders are immutable'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "PurchaseOrder_protect_header"
BEFORE UPDATE ON "PurchaseOrder"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_order_header"();

CREATE FUNCTION "protect_purchase_order_line"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status "PurchaseOrderStatus";
  internal_receipt BOOLEAN;
  target_order_id TEXT;
BEGIN
  internal_receipt := current_setting('app.purchase_receipt_write', true) = 'on';
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD."purchaseOrderId";
  ELSE
    target_order_id := NEW."purchaseOrderId";
  END IF;

  SELECT "status" INTO parent_status
  FROM "PurchaseOrder"
  WHERE "id" = target_order_id
  FOR UPDATE;

  IF parent_status IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found'
      USING ERRCODE = '23503';
  END IF;

  IF TG_OP = 'UPDATE' AND internal_receipt THEN
    IF
      NEW."purchaseOrderId" IS NOT DISTINCT FROM OLD."purchaseOrderId" AND
      NEW."lineNumber" IS NOT DISTINCT FROM OLD."lineNumber" AND
      NEW."ingredientId" IS NOT DISTINCT FROM OLD."ingredientId" AND
      NEW."ingredientName" IS NOT DISTINCT FROM OLD."ingredientName" AND
      NEW."baseUnit" IS NOT DISTINCT FROM OLD."baseUnit" AND
      NEW."purchaseUnit" IS NOT DISTINCT FROM OLD."purchaseUnit" AND
      NEW."conversionToBaseMicros" IS NOT DISTINCT FROM OLD."conversionToBaseMicros" AND
      NEW."orderedPurchaseQuantityMicros" IS NOT DISTINCT FROM OLD."orderedPurchaseQuantityMicros" AND
      NEW."orderedBaseQuantityMicros" IS NOT DISTINCT FROM OLD."orderedBaseQuantityMicros" AND
      NEW."purchaseUnitCostMicros" IS NOT DISTINCT FROM OLD."purchaseUnitCostMicros" AND
      NEW."baseUnitCostMicros" IS NOT DISTINCT FROM OLD."baseUnitCostMicros" AND
      NEW."lineTotalMinor" IS NOT DISTINCT FROM OLD."lineTotalMinor" AND
      NEW."notes" IS NOT DISTINCT FROM OLD."notes"
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF parent_status <> 'draft' THEN
    RAISE EXCEPTION 'Submitted purchase-order lines are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW."receivedBaseQuantityMicros" IS DISTINCT FROM OLD."receivedBaseQuantityMicros" THEN
    RAISE EXCEPTION 'Received purchase quantity is receipt-controlled'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "PurchaseOrderLine_protect_insert"
BEFORE INSERT ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_order_line"();
CREATE TRIGGER "PurchaseOrderLine_protect_update"
BEFORE UPDATE ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_order_line"();
CREATE TRIGGER "PurchaseOrderLine_protect_delete"
BEFORE DELETE ON "PurchaseOrderLine"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_order_line"();

CREATE FUNCTION "protect_purchase_receipt"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Purchase receipts are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF current_setting('app.purchase_receipt_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Purchase receipts are immutable; use the reviewed correction workflow'
      USING ERRCODE = '55000';
  END IF;

  IF NOT (
    OLD."status" = 'posted' AND
    NEW."status" = 'reversed' AND
    NEW."receiptNumber" IS NOT DISTINCT FROM OLD."receiptNumber" AND
    NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey" AND
    NEW."purchaseOrderId" IS NOT DISTINCT FROM OLD."purchaseOrderId" AND
    NEW."totalCostMinor" IS NOT DISTINCT FROM OLD."totalCostMinor" AND
    NEW."notes" IS NOT DISTINCT FROM OLD."notes" AND
    NEW."receivedById" IS NOT DISTINCT FROM OLD."receivedById" AND
    NEW."receivedByName" IS NOT DISTINCT FROM OLD."receivedByName" AND
    NEW."occurredAt" IS NOT DISTINCT FROM OLD."occurredAt" AND
    NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'Invalid purchase-receipt correction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "PurchaseReceipt_immutable_update"
BEFORE UPDATE ON "PurchaseReceipt"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_receipt"();
CREATE TRIGGER "PurchaseReceipt_immutable_delete"
BEFORE DELETE ON "PurchaseReceipt"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_receipt"();

CREATE FUNCTION "protect_purchase_receipt_line"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Purchase receipt lines are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF current_setting('app.purchase_receipt_write', true) = 'on' AND
     OLD."reversalMovementId" IS NULL AND
     NEW."reversalMovementId" IS NOT NULL AND
     NEW."receiptId" IS NOT DISTINCT FROM OLD."receiptId" AND
     NEW."purchaseOrderLineId" IS NOT DISTINCT FROM OLD."purchaseOrderLineId" AND
     NEW."ingredientId" IS NOT DISTINCT FROM OLD."ingredientId" AND
     NEW."ingredientName" IS NOT DISTINCT FROM OLD."ingredientName" AND
     NEW."submittedUnit" IS NOT DISTINCT FROM OLD."submittedUnit" AND
     NEW."submittedQuantityMicros" IS NOT DISTINCT FROM OLD."submittedQuantityMicros" AND
     NEW."conversionToBaseMicros" IS NOT DISTINCT FROM OLD."conversionToBaseMicros" AND
     NEW."baseQuantityMicros" IS NOT DISTINCT FROM OLD."baseQuantityMicros" AND
     NEW."purchaseUnitCostMicros" IS NOT DISTINCT FROM OLD."purchaseUnitCostMicros" AND
     NEW."baseUnitCostMicros" IS NOT DISTINCT FROM OLD."baseUnitCostMicros" AND
     NEW."totalCostMinor" IS NOT DISTINCT FROM OLD."totalCostMinor" AND
     NEW."stockMovementId" IS NOT DISTINCT FROM OLD."stockMovementId" AND
     NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Purchase receipt lines are immutable'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "PurchaseReceiptLine_immutable_update"
BEFORE UPDATE ON "PurchaseReceiptLine"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_receipt_line"();
CREATE TRIGGER "PurchaseReceiptLine_immutable_delete"
BEFORE DELETE ON "PurchaseReceiptLine"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_receipt_line"();

CREATE FUNCTION "protect_purchase_receipt_stock_reversal"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  original_source_type TEXT;
BEGIN
  IF NEW."movementType" = 'reversal' AND NEW."reversalOfId" IS NOT NULL THEN
    SELECT "sourceType" INTO original_source_type
    FROM "StockMovement"
    WHERE "id" = NEW."reversalOfId";

    IF original_source_type = 'PurchaseReceipt' AND NEW."sourceType" <> 'PurchaseReceiptReversal' THEN
      RAISE EXCEPTION 'Purchase-receipt movements require the purchasing correction workflow'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "StockMovement_purchase_receipt_reversal_guard"
BEFORE INSERT ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "protect_purchase_receipt_stock_reversal"();
