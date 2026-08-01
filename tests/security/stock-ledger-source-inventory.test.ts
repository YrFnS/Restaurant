import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260731235940_add_stock_ledger_recipes/migration.sql"
);
const negativePolicyMigration = source(
  "prisma/migrations/20260731235941_allow_negative_stock_policy/migration.sql"
);
const snapshotMigration = source(
  "prisma/migrations/20260731235950_add_inventory_consumption_snapshot/migration.sql"
);
const schema = source("prisma/schema.prisma");
const dbClient = source("src/lib/db.ts");
const service = source("src/lib/inventory/stock-ledger-impl.ts");
const adapter = source("src/lib/inventory/stock-ledger.ts");
const inventoryRoute = source("src/app/api/inventory/route.ts");
const movementsRoute = source("src/app/api/inventory/movements/route.ts");
const conversionsRoute = source("src/app/api/inventory/conversions/route.ts");
const recipesRoute = source("src/app/api/inventory/recipes/route.ts");
const itemRoute = source("src/app/api/orders/items/[id]/route.ts");
const orderRoute = source("src/app/api/orders/[id]/route.ts");
const kitchenRoute = source("src/app/api/kitchen/route.ts");
const inventoryUi = source("src/components/admin/tabs/InventoryTab.tsx");
const packageJson = source("package.json");
const roadmap = source("docs/REMEDIATION_PLAN.md");
const design = source("docs/P1_STOCK_LEDGER_RECIPES.md");

describe("stock ledger and recipe source inventory", () => {
  test("commits exact quantity, conversion, recipe, and movement tables", () => {
    for (const marker of [
      'CREATE TYPE "StockMovementType"',
      'ADD COLUMN "quantityMicros" BIGINT',
      'ADD COLUMN "allowNegativeStock" BOOLEAN',
      'CREATE TABLE "IngredientUnitConversion"',
      'CREATE TABLE "Recipe"',
      'CREATE TABLE "RecipeComponent"',
      'CREATE TABLE "StockMovement"',
      'Recipe_one_active_per_menu_item_idx',
      'StockMovement_idempotencyKey_key',
      'StockMovement_one_reversal_per_movement_idx',
      'StockMovement_ingredient_createdAt_idx',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("reconciles the legacy stock bound with explicit negative-stock policy", () => {
    for (const marker of [
      'DROP CONSTRAINT "Ingredient_stock_bounds"',
      'ADD CONSTRAINT "Ingredient_stock_bounds"',
      '"allowNegativeStock" OR "quantity" >= 0',
      '"quantity" BETWEEN -1000000000000000 AND 1000000000000000',
      'VALIDATE CONSTRAINT "Ingredient_stock_bounds"',
    ]) {
      expect(negativePolicyMigration).toContain(marker);
    }
  });

  test("maps exact stock models and one-way consumption snapshots in Prisma", () => {
    for (const marker of [
      "enum StockMovementType",
      "enum InventoryConsumptionState",
      "model IngredientUnitConversion",
      "model Recipe {",
      "model RecipeComponent",
      "model StockMovement",
      "quantityMicros",
      "inventoryConsumptionState",
      "inventoryRecipeId",
      "inventoryRecipeVersion",
      "inventoryConsumedAt",
      'map: "StockMovement_idempotencyKey_key"',
      'map: "OrderItem_inventory_state_idx"',
    ]) {
      expect(schema).toContain(marker);
    }
    for (const marker of [
      "ingredientUnitConversion",
      "recipeComponent",
      "stockMovement",
      "quantityDeltaMicros",
      "balanceAfterMicros",
    ]) {
      expect(dbClient).toContain(marker);
    }
  });

  test("persists exactly one recipe or untracked decision per order item", () => {
    for (const marker of [
      'CREATE TYPE "InventoryConsumptionState"',
      'ADD COLUMN "inventoryConsumptionState"',
      'ADD COLUMN "inventoryRecipeId"',
      'ADD COLUMN "inventoryRecipeVersion"',
      'ADD COLUMN "inventoryConsumedAt"',
      'OrderItem_inventory_consumption_shape',
      'OrderItem_inventory_snapshot_validate_update',
      'Order-item inventory consumption snapshots are immutable',
      "WHERE \"status\" IN ('preparing', 'ready', 'served')",
    ]) {
      expect(snapshotMigration).toContain(marker);
    }
    for (const marker of [
      'inventoryConsumptionState === "consumed"',
      'inventoryConsumptionState === "untracked"',
      '"inventoryConsumptionState" = \'untracked\'',
      '"inventoryConsumptionState" = \'consumed\'',
      'sourceLineId: item.id',
      "INVENTORY_SNAPSHOT_WRITE_FAILED",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("makes balances, movements, and recipe versions database-governed", () => {
    for (const marker of [
      'Ingredient_ledger_quantity_guard',
      'Ingredient quantity is ledger-controlled; append a stock movement instead',
      'RecipeComponent_validate_ownership',
      'Recipe modifier component belongs to another menu item',
      'Recipe_immutable_version',
      'RecipeComponent_immutable',
      'StockMovement_validate_insert',
      'StockMovement_apply_balance',
      'StockMovement_immutable',
      'Stock movements are immutable; append a reversal instead',
      'Stock movement would make ingredient balance negative',
      'Stock reversal must exactly negate the original quantity',
      'Ingredient_create_opening_movement',
      'migration-opening:',
    ]) {
      expect(migration).toContain(marker);
    }
  });

  test("serializes concurrent writes and makes every production deduction idempotent", () => {
    for (const marker of [
      "INVENTORY_QUANTITY_SCALE",
      "pg_advisory_xact_lock",
      "resolveQuantityToBaseMicros",
      "createStockMovement",
      "reverseStockMovement",
      "publishRecipeVersion",
      "consumeOrderItemInventory",
      "consumeOrderInventory",
      "production:${item.id}:${component.id}",
      "FOR UPDATE OF item",
      "FOR UPDATE",
    ]) {
      expect(service).toContain(marker);
    }
    expect(adapter).toContain("prismaSafeInventoryClient");
    expect(adapter).toContain('SELECT 1::integer AS "locked"');
    expect(adapter).toContain("FROM inventory_lock");
  });

  test("replaces direct quantity mutation with reviewed ledger APIs", () => {
    expect(inventoryRoute).toContain("DIRECT_QUANTITY_EDIT_DISABLED");
    expect(inventoryRoute).toContain('movementType: "opening_balance"');
    expect(inventoryRoute).toContain('movementType: "waste"');
    expect(inventoryRoute).not.toContain("quantity: { decrement:");
    expect(inventoryRoute).not.toContain("quantity: { increment:");

    for (const route of [movementsRoute, conversionsRoute, recipesRoute]) {
      expect(route).toContain("requireStaffSession(INVENTORY_MANAGEMENT_ROLES)");
    }
    expect(movementsRoute).toContain("Idempotency-Key");
    expect(movementsRoute).toContain("readStockMovement");
    expect(movementsRoute).toContain("STOCK_IDEMPOTENCY_CONFLICT");
    expect(recipesRoute).toContain("publishRecipeVersion");
    expect(conversionsRoute).toContain("upsertUnitConversion");
  });

  test("consumes configured recipes before production state commits", () => {
    expect(itemRoute).toContain("consumeOrderItemInventory");
    expect(orderRoute).toContain("consumeOrderInventory");
    expect(kitchenRoute).toContain("consumeOrderItemInventory");
    expect(kitchenRoute).toContain("consumeOrderInventory");

    expect(itemRoute.indexOf("consumeOrderItemInventory")).toBeLessThan(
      itemRoute.indexOf("tx.orderItem.update")
    );
    expect(orderRoute.indexOf("consumeOrderInventory")).toBeLessThan(
      orderRoute.indexOf("tx.order.update")
    );
    expect(kitchenRoute.indexOf("consumeOrderItemInventory")).toBeLessThan(
      kitchenRoute.indexOf("tx.orderItem.update")
    );
  });

  test("ships a ledger-aware bilingual operator workflow", () => {
    for (const marker of [
      'apiFetch("/api/inventory/movements"',
      'apiFetch("/api/inventory/recipes"',
      'apiFetch("/api/inventory/conversions"',
      '"Idempotency-Key"',
      "Opening balance",
      "Stock ledger",
      "Publish recipe",
      "Allow negative stock",
      "DIRECT_QUANTITY_EDIT_DISABLED",
    ]) {
      if (marker === "DIRECT_QUANTITY_EDIT_DISABLED") {
        expect(inventoryRoute).toContain(marker);
      } else {
        expect(inventoryUi).toContain(marker);
      }
    }
  });

  test("keeps the implementation policy and permanent database suite visible", () => {
    expect(roadmap).toContain("P1-B03 Recipes and immutable stock ledger");
    expect(roadmap).toContain("Stock consumption occurs on first production entry");
    expect(design).toContain("base-unit micros");
    expect(design).toContain("Movement rows cannot be updated or deleted");
    expect(packageJson).toContain(
      "bun tests/integration/p1-stock-ledger-recipes.ts"
    );
  });
});
