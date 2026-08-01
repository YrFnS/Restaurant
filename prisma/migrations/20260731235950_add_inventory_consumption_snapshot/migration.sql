-- P1 per-order-item inventory consumption snapshots.
-- Production consumption becomes a one-way decision so a later recipe
-- publication cannot charge the same item against a different recipe.

CREATE TYPE "InventoryConsumptionState" AS ENUM (
  'pending',
  'consumed',
  'untracked'
);

ALTER TABLE "OrderItem"
  ADD COLUMN "inventoryConsumptionState" "InventoryConsumptionState" NOT NULL DEFAULT 'pending',
  ADD COLUMN "inventoryRecipeId" TEXT,
  ADD COLUMN "inventoryRecipeVersion" INTEGER,
  ADD COLUMN "inventoryConsumedAt" TIMESTAMP(3);

-- Items already in or beyond production predate this ledger rollout. Mark them
-- explicitly untracked so a later status edit cannot retroactively consume stock.
UPDATE "OrderItem"
SET
  "inventoryConsumptionState" = 'untracked',
  "inventoryConsumedAt" = COALESCE("readyAt", "firedAt", "updatedAt", CURRENT_TIMESTAMP)
WHERE "status" IN ('preparing', 'ready', 'served');

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_inventoryRecipeId_fkey"
  FOREIGN KEY ("inventoryRecipeId") REFERENCES "Recipe"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_inventory_consumption_shape" CHECK (
    (
      "inventoryConsumptionState" = 'pending' AND
      "inventoryRecipeId" IS NULL AND
      "inventoryRecipeVersion" IS NULL AND
      "inventoryConsumedAt" IS NULL
    ) OR
    (
      "inventoryConsumptionState" = 'untracked' AND
      "inventoryRecipeId" IS NULL AND
      "inventoryRecipeVersion" IS NULL AND
      "inventoryConsumedAt" IS NOT NULL
    ) OR
    (
      "inventoryConsumptionState" = 'consumed' AND
      "inventoryRecipeId" IS NOT NULL AND
      "inventoryRecipeVersion" BETWEEN 1 AND 1000000 AND
      "inventoryConsumedAt" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "OrderItem"
  VALIDATE CONSTRAINT "OrderItem_inventory_consumption_shape";

CREATE INDEX "OrderItem_inventory_state_idx"
  ON "OrderItem"("inventoryConsumptionState", "createdAt");
CREATE INDEX "OrderItem_inventory_recipe_idx"
  ON "OrderItem"("inventoryRecipeId", "createdAt")
  WHERE "inventoryRecipeId" IS NOT NULL;

CREATE FUNCTION "validate_order_item_inventory_snapshot"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stored_recipe_version INTEGER;
  stored_recipe_menu_item_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."inventoryConsumptionState" IN ('consumed', 'untracked') AND (
      NEW."inventoryConsumptionState" IS DISTINCT FROM OLD."inventoryConsumptionState" OR
      NEW."inventoryRecipeId" IS DISTINCT FROM OLD."inventoryRecipeId" OR
      NEW."inventoryRecipeVersion" IS DISTINCT FROM OLD."inventoryRecipeVersion" OR
      NEW."inventoryConsumedAt" IS DISTINCT FROM OLD."inventoryConsumedAt"
    ) THEN
      RAISE EXCEPTION 'Order-item inventory consumption snapshots are immutable'
        USING ERRCODE = '55000';
    END IF;

    IF OLD."inventoryConsumptionState" = 'pending' AND
       NEW."inventoryConsumptionState" NOT IN ('pending', 'consumed', 'untracked') THEN
      RAISE EXCEPTION 'Invalid order-item inventory consumption transition'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."inventoryConsumptionState" = 'consumed' THEN
    SELECT "version", "menuItemId"
      INTO stored_recipe_version, stored_recipe_menu_item_id
    FROM "Recipe"
    WHERE "id" = NEW."inventoryRecipeId";

    IF stored_recipe_version IS NULL OR
       stored_recipe_version IS DISTINCT FROM NEW."inventoryRecipeVersion" OR
       stored_recipe_menu_item_id IS DISTINCT FROM NEW."menuItemId" THEN
      RAISE EXCEPTION 'Order-item inventory recipe snapshot does not match the stored recipe'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "OrderItem_inventory_snapshot_validate_insert"
BEFORE INSERT ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "validate_order_item_inventory_snapshot"();

CREATE TRIGGER "OrderItem_inventory_snapshot_validate_update"
BEFORE UPDATE OF
  "inventoryConsumptionState",
  "inventoryRecipeId",
  "inventoryRecipeVersion",
  "inventoryConsumedAt"
ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "validate_order_item_inventory_snapshot"();
