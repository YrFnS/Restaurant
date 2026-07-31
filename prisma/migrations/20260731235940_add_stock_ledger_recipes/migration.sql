-- P1 recipes and immutable stock ledger.
-- Quantities use ingredient-base-unit micros: 1 base unit = 1,000,000.

CREATE TYPE "StockMovementType" AS ENUM (
  'opening_balance',
  'receipt',
  'waste',
  'adjustment_in',
  'adjustment_out',
  'production_consumption',
  'reversal'
);

ALTER TABLE "Ingredient"
  ADD COLUMN "quantityMicros" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Ingredient"
SET "quantityMicros" = ROUND("quantity"::numeric * 1000000)::bigint;

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_quantity_exact_bounds" CHECK (
    "quantityMicros" BETWEEN -9007199254740991 AND 9007199254740991 AND
    ("allowNegativeStock" OR "quantityMicros" >= 0) AND
    ABS(
      "quantity"::numeric -
      ("quantityMicros"::numeric / 1000000)
    ) <= 0.0000005
  );

CREATE TABLE "IngredientUnitConversion" (
  "id" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "toBaseMicros" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IngredientUnitConversion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IngredientUnitConversion_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IngredientUnitConversion_shape" CHECK (
    char_length(btrim("unit")) BETWEEN 1 AND 40 AND
    "unit" = lower(btrim("unit")) AND
    "toBaseMicros" BETWEEN 1 AND 9007199254740991
  )
);

CREATE UNIQUE INDEX "IngredientUnitConversion_ingredient_unit_key"
  ON "IngredientUnitConversion"("ingredientId", "unit");
CREATE INDEX "IngredientUnitConversion_ingredient_idx"
  ON "IngredientUnitConversion"("ingredientId", "createdAt");

CREATE TABLE "Recipe" (
  "id" TEXT NOT NULL,
  "creationKey" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "yieldMicros" BIGINT NOT NULL DEFAULT 1000000,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdByName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),

  CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Recipe_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Recipe_version_bounds" CHECK (
    "version" BETWEEN 1 AND 1000000 AND
    "yieldMicros" BETWEEN 1 AND 9007199254740991
  ),
  CONSTRAINT "Recipe_state_shape" CHECK (
    ("isActive" AND "supersededAt" IS NULL) OR
    (NOT "isActive" AND "supersededAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "Recipe_creationKey_key" ON "Recipe"("creationKey");
CREATE UNIQUE INDEX "Recipe_menuItem_version_key"
  ON "Recipe"("menuItemId", "version");
CREATE UNIQUE INDEX "Recipe_one_active_per_menu_item_idx"
  ON "Recipe"("menuItemId") WHERE "isActive";
CREATE INDEX "Recipe_menuItem_createdAt_idx"
  ON "Recipe"("menuItemId", "createdAt" DESC);

CREATE TABLE "RecipeComponent" (
  "id" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "modifierOptionId" TEXT,
  "quantityMicros" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecipeComponent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeComponent_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecipeComponent_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecipeComponent_modifierOptionId_fkey"
    FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecipeComponent_quantity_bounds" CHECK (
    "quantityMicros" BETWEEN 1 AND 9007199254740991
  )
);

CREATE UNIQUE INDEX "RecipeComponent_unique_component_idx"
  ON "RecipeComponent"(
    "recipeId",
    "ingredientId",
    COALESCE("modifierOptionId", '')
  );
CREATE INDEX "RecipeComponent_recipe_idx"
  ON "RecipeComponent"("recipeId", "createdAt");
CREATE INDEX "RecipeComponent_ingredient_idx"
  ON "RecipeComponent"("ingredientId", "createdAt");
CREATE INDEX "RecipeComponent_modifier_idx"
  ON "RecipeComponent"("modifierOptionId")
  WHERE "modifierOptionId" IS NOT NULL;

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "movementType" "StockMovementType" NOT NULL,
  "quantityDeltaMicros" BIGINT NOT NULL,
  "unitCostMicros" BIGINT NOT NULL DEFAULT 0,
  "totalCostMinor" BIGINT NOT NULL DEFAULT 0,
  "balanceAfterMicros" BIGINT NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL DEFAULT '',
  "sourceId" TEXT,
  "sourceLineId" TEXT,
  "reversalOfId" TEXT,
  "reasonCode" TEXT NOT NULL DEFAULT '',
  "reason" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_reversalOfId_fkey"
    FOREIGN KEY ("reversalOfId") REFERENCES "StockMovement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_quantity_bounds" CHECK (
    "quantityDeltaMicros" BETWEEN -9007199254740991 AND 9007199254740991 AND
    "quantityDeltaMicros" <> 0 AND
    "balanceAfterMicros" BETWEEN -9007199254740991 AND 9007199254740991
  ),
  CONSTRAINT "StockMovement_cost_bounds" CHECK (
    "unitCostMicros" BETWEEN 0 AND 9007199254740991 AND
    "totalCostMinor" BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT "StockMovement_reference_bounds" CHECK (
    char_length("idempotencyKey") BETWEEN 1 AND 191 AND
    char_length("sourceType") <= 80 AND
    char_length("reasonCode") <= 80 AND
    char_length(COALESCE("reason", '')) <= 2000
  ),
  CONSTRAINT "StockMovement_direction_shape" CHECK (
    ("movementType" IN ('opening_balance', 'receipt', 'adjustment_in') AND "quantityDeltaMicros" > 0) OR
    ("movementType" IN ('waste', 'adjustment_out', 'production_consumption') AND "quantityDeltaMicros" < 0) OR
    ("movementType" = 'reversal')
  ),
  CONSTRAINT "StockMovement_reversal_shape" CHECK (
    ("movementType" = 'reversal' AND "reversalOfId" IS NOT NULL) OR
    ("movementType" <> 'reversal' AND "reversalOfId" IS NULL)
  )
);

CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key"
  ON "StockMovement"("idempotencyKey");
CREATE UNIQUE INDEX "StockMovement_one_reversal_per_movement_idx"
  ON "StockMovement"("reversalOfId")
  WHERE "reversalOfId" IS NOT NULL;
CREATE INDEX "StockMovement_ingredient_createdAt_idx"
  ON "StockMovement"("ingredientId", "createdAt" DESC);
CREATE INDEX "StockMovement_source_idx"
  ON "StockMovement"("sourceType", "sourceId", "sourceLineId");
CREATE INDEX "StockMovement_type_createdAt_idx"
  ON "StockMovement"("movementType", "createdAt" DESC);
CREATE INDEX "StockMovement_actor_createdAt_idx"
  ON "StockMovement"("actorId", "createdAt" DESC);

-- Existing quantities become opening-balance movements without changing the
-- already-backfilled ingredient balance.
INSERT INTO "StockMovement" (
  "id", "idempotencyKey", "ingredientId", "movementType",
  "quantityDeltaMicros", "unitCostMicros", "totalCostMinor",
  "balanceAfterMicros", "sourceType", "sourceId",
  "reasonCode", "reason", "actorName", "metadata"
)
SELECT
  'stock_opening_' || md5(ingredient."id"),
  'migration-opening:' || ingredient."id",
  ingredient."id",
  'opening_balance'::"StockMovementType",
  ingredient."quantityMicros",
  ingredient."costPerUnitMicros",
  ROUND(
    ABS(ingredient."quantityMicros")::numeric *
    ingredient."costPerUnitMicros"::numeric /
    10000000000
  )::bigint,
  ingredient."quantityMicros",
  'legacy_migration',
  ingredient."id",
  'legacy_balance',
  'Opening balance migrated from the legacy ingredient quantity',
  'Migration',
  jsonb_build_object('legacyQuantity', ingredient."quantity")
FROM "Ingredient" AS ingredient
WHERE ingredient."quantityMicros" <> 0;

CREATE FUNCTION "normalize_ingredient_quantity_write"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  calculated_micros BIGINT;
BEGIN
  calculated_micros := ROUND(NEW."quantity"::numeric * 1000000)::bigint;

  IF TG_OP = 'INSERT' THEN
    IF NEW."quantityMicros" = 0 AND calculated_micros <> 0 THEN
      NEW."quantityMicros" := calculated_micros;
    ELSIF NEW."quantityMicros" <> calculated_micros THEN
      RAISE EXCEPTION 'Ingredient quantity and exact quantity must match'
        USING ERRCODE = '23514';
    END IF;

    IF NOT NEW."allowNegativeStock" AND NEW."quantityMicros" < 0 THEN
      RAISE EXCEPTION 'Negative ingredient stock is disabled'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."quantity" IS DISTINCT FROM OLD."quantity" OR
     NEW."quantityMicros" IS DISTINCT FROM OLD."quantityMicros" THEN
    IF current_setting('app.stock_ledger_write', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Ingredient quantity is ledger-controlled; append a stock movement instead'
        USING ERRCODE = '55000';
    END IF;

    IF NEW."quantityMicros" <> calculated_micros THEN
      RAISE EXCEPTION 'Ingredient quantity and exact quantity must match'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT NEW."allowNegativeStock" AND NEW."quantityMicros" < 0 THEN
    RAISE EXCEPTION 'Negative ingredient stock is disabled'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "Ingredient_ledger_quantity_guard"
BEFORE INSERT OR UPDATE OF "quantity", "quantityMicros", "allowNegativeStock"
ON "Ingredient"
FOR EACH ROW EXECUTE FUNCTION "normalize_ingredient_quantity_write"();

CREATE FUNCTION "validate_recipe_component_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  recipe_menu_item_id TEXT;
  modifier_menu_item_id TEXT;
BEGIN
  SELECT "menuItemId"
    INTO recipe_menu_item_id
  FROM "Recipe"
  WHERE "id" = NEW."recipeId";

  IF recipe_menu_item_id IS NULL THEN
    RAISE EXCEPTION 'Recipe not found'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."modifierOptionId" IS NOT NULL THEN
    SELECT modifier_group."menuItemId"
      INTO modifier_menu_item_id
    FROM "ModifierOption" AS modifier_option
    JOIN "ModifierGroup" AS modifier_group
      ON modifier_group."id" = modifier_option."groupId"
    WHERE modifier_option."id" = NEW."modifierOptionId";

    IF modifier_menu_item_id IS DISTINCT FROM recipe_menu_item_id THEN
      RAISE EXCEPTION 'Recipe modifier component belongs to another menu item'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "RecipeComponent_validate_ownership"
BEFORE INSERT ON "RecipeComponent"
FOR EACH ROW EXECUTE FUNCTION "validate_recipe_component_insert"();

CREATE FUNCTION "protect_recipe_version"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Recipe versions are immutable; supersede the active version instead'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."isActive" AND NOT NEW."isActive" AND
     OLD."supersededAt" IS NULL AND NEW."supersededAt" IS NOT NULL AND
     NEW."id" IS NOT DISTINCT FROM OLD."id" AND
     NEW."creationKey" IS NOT DISTINCT FROM OLD."creationKey" AND
     NEW."menuItemId" IS NOT DISTINCT FROM OLD."menuItemId" AND
     NEW."version" IS NOT DISTINCT FROM OLD."version" AND
     NEW."yieldMicros" IS NOT DISTINCT FROM OLD."yieldMicros" AND
     NEW."createdById" IS NOT DISTINCT FROM OLD."createdById" AND
     NEW."createdByName" IS NOT DISTINCT FROM OLD."createdByName" AND
     NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Recipe versions are immutable; publish a new version instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "Recipe_immutable_version"
BEFORE UPDATE OR DELETE ON "Recipe"
FOR EACH ROW EXECUTE FUNCTION "protect_recipe_version"();

CREATE FUNCTION "protect_recipe_component"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Recipe components are immutable; publish a new recipe version instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "RecipeComponent_immutable"
BEFORE UPDATE OR DELETE ON "RecipeComponent"
FOR EACH ROW EXECUTE FUNCTION "protect_recipe_component"();

CREATE FUNCTION "validate_stock_movement_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ingredient_cost BIGINT;
  original "StockMovement"%ROWTYPE;
BEGIN
  SELECT "costPerUnitMicros"
    INTO ingredient_cost
  FROM "Ingredient"
  WHERE "id" = NEW."ingredientId";

  IF ingredient_cost IS NULL THEN
    RAISE EXCEPTION 'Ingredient not found for stock movement'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."unitCostMicros" = 0 THEN
    NEW."unitCostMicros" := ingredient_cost;
  END IF;

  IF NEW."movementType" = 'reversal' THEN
    SELECT *
      INTO original
    FROM "StockMovement"
    WHERE "id" = NEW."reversalOfId"
    FOR UPDATE;

    IF original."id" IS NULL THEN
      RAISE EXCEPTION 'Stock movement to reverse was not found'
        USING ERRCODE = '23503';
    END IF;
    IF original."movementType" = 'reversal' THEN
      RAISE EXCEPTION 'A stock reversal cannot reverse another reversal'
        USING ERRCODE = '23514';
    END IF;
    IF original."ingredientId" IS DISTINCT FROM NEW."ingredientId" THEN
      RAISE EXCEPTION 'Stock reversal ingredient must match the original movement'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."quantityDeltaMicros" <> -original."quantityDeltaMicros" THEN
      RAISE EXCEPTION 'Stock reversal must exactly negate the original quantity'
        USING ERRCODE = '23514';
    END IF;
    IF char_length(btrim(NEW."reasonCode")) = 0 OR
       char_length(btrim(COALESCE(NEW."reason", ''))) = 0 THEN
      RAISE EXCEPTION 'Stock reversals require a reason code and explanation'
        USING ERRCODE = '23514';
    END IF;

    NEW."unitCostMicros" := original."unitCostMicros";
  ELSE
    IF NEW."reversalOfId" IS NOT NULL THEN
      RAISE EXCEPTION 'Only reversal movements may reference another movement'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."movementType" IN ('receipt', 'waste', 'adjustment_in', 'adjustment_out') AND
     (
       char_length(btrim(NEW."reasonCode")) = 0 OR
       char_length(btrim(COALESCE(NEW."reason", ''))) = 0
     ) THEN
    RAISE EXCEPTION 'Manual stock movements require a reason code and explanation'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."movementType" = 'production_consumption' AND
     (
       NEW."sourceType" <> 'OrderItem' OR
       NEW."sourceId" IS NULL OR
       NEW."sourceLineId" IS NULL
     ) THEN
    RAISE EXCEPTION 'Production consumption requires order and order-item references'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "StockMovement_validate_insert"
BEFORE INSERT ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "validate_stock_movement_insert"();

CREATE FUNCTION "apply_stock_movement_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance BIGINT;
  negative_allowed BOOLEAN;
  next_balance BIGINT;
  movement_cost BIGINT;
  other_movement_count INTEGER;
BEGIN
  SELECT "quantityMicros", "allowNegativeStock"
    INTO current_balance, negative_allowed
  FROM "Ingredient"
  WHERE "id" = NEW."ingredientId"
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'Ingredient not found for stock movement'
      USING ERRCODE = '23503';
  END IF;

  IF NEW."movementType" = 'opening_balance' AND
     NEW."sourceType" = 'ingredient_insert' THEN
    SELECT COUNT(*)::integer
      INTO other_movement_count
    FROM "StockMovement"
    WHERE "ingredientId" = NEW."ingredientId" AND "id" <> NEW."id";

    IF other_movement_count = 0 AND current_balance = NEW."quantityDeltaMicros" THEN
      next_balance := current_balance;
    ELSE
      next_balance := current_balance + NEW."quantityDeltaMicros";
    END IF;
  ELSE
    next_balance := current_balance + NEW."quantityDeltaMicros";
  END IF;

  IF next_balance < 0 AND NOT negative_allowed THEN
    RAISE EXCEPTION 'Stock movement would make ingredient balance negative'
      USING ERRCODE = '23514',
            DETAIL = json_build_object(
              'ingredientId', NEW."ingredientId",
              'currentBalanceMicros', current_balance,
              'deltaMicros', NEW."quantityDeltaMicros"
            )::text;
  END IF;

  movement_cost := ROUND(
    ABS(NEW."quantityDeltaMicros")::numeric *
    NEW."unitCostMicros"::numeric /
    10000000000
  )::bigint;

  PERFORM set_config('app.stock_ledger_write', 'on', true);
  UPDATE "Ingredient"
  SET
    "quantityMicros" = next_balance,
    "quantity" = (next_balance::numeric / 1000000)::double precision,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."ingredientId";
  PERFORM set_config('app.stock_ledger_write', 'off', true);

  PERFORM set_config('app.stock_movement_internal', 'on', true);
  UPDATE "StockMovement"
  SET
    "balanceAfterMicros" = next_balance,
    "totalCostMinor" = movement_cost
  WHERE "id" = NEW."id";
  PERFORM set_config('app.stock_movement_internal', 'off', true);

  RETURN NULL;
END
$$;

CREATE TRIGGER "StockMovement_apply_balance"
AFTER INSERT ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "apply_stock_movement_insert"();

CREATE FUNCTION "protect_stock_movement"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     current_setting('app.stock_movement_internal', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Stock movements are immutable; append a reversal instead'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "StockMovement_immutable"
BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "protect_stock_movement"();

CREATE FUNCTION "create_inserted_ingredient_opening_movement"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."quantityMicros" <> 0 THEN
    INSERT INTO "StockMovement" (
      "id", "idempotencyKey", "ingredientId", "movementType",
      "quantityDeltaMicros", "unitCostMicros", "sourceType", "sourceId",
      "reasonCode", "reason", "actorName", "metadata"
    ) VALUES (
      'stock_opening_' || md5(NEW."id"),
      'ingredient-opening:' || NEW."id",
      NEW."id",
      'opening_balance',
      NEW."quantityMicros",
      NEW."costPerUnitMicros",
      'ingredient_insert',
      NEW."id",
      'opening_balance',
      'Opening balance recorded from ingredient creation',
      'System',
      jsonb_build_object('baseUnit', NEW."unit")
    )
    ON CONFLICT ("idempotencyKey") DO NOTHING;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER "Ingredient_create_opening_movement"
AFTER INSERT ON "Ingredient"
FOR EACH ROW EXECUTE FUNCTION "create_inserted_ingredient_opening_movement"();
