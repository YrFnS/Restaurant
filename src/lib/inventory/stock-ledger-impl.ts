import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  divideAndRoundHalfUp,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

export const INVENTORY_QUANTITY_DIGITS = 6;
export const INVENTORY_QUANTITY_SCALE = BigInt(1_000_000);
const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);

export const STOCK_MOVEMENT_TYPES = [
  "opening_balance",
  "receipt",
  "waste",
  "adjustment_in",
  "adjustment_out",
  "production_consumption",
  "reversal",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type StockSqlClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

export type InventoryActor = {
  id: string;
  name: string;
  role: string;
};

export type IngredientStockRow = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  quantityMicros: bigint;
  allowNegativeStock: boolean;
  costPerUnit: number;
  costPerUnitMicros: bigint;
  lowThreshold: number;
  supplier: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UnitConversionRow = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  unit: string;
  toBaseMicros: bigint;
  createdAt: Date;
  updatedAt: Date;
};

export type StockMovementRow = {
  id: string;
  idempotencyKey: string;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  movementType: StockMovementType;
  quantityDeltaMicros: bigint;
  unitCostMicros: bigint;
  totalCostMinor: bigint;
  balanceAfterMicros: bigint;
  sourceType: string;
  sourceId: string | null;
  sourceLineId: string | null;
  reversalOfId: string | null;
  reasonCode: string;
  reason: string | null;
  actorId: string | null;
  actorName: string;
  metadata: unknown;
  occurredAt: Date;
  createdAt: Date;
};

export type RecipeRow = {
  id: string;
  creationKey: string;
  menuItemId: string;
  menuItemNameEn: string;
  menuItemNameAr: string;
  version: number;
  yieldMicros: bigint;
  isActive: boolean;
  createdById: string | null;
  createdByName: string;
  createdAt: Date;
  supersededAt: Date | null;
};

export type RecipeComponentRow = {
  id: string;
  recipeId: string;
  ingredientId: string;
  ingredientName: string;
  ingredientUnit: string;
  modifierOptionId: string | null;
  modifierNameEn: string | null;
  modifierNameAr: string | null;
  quantityMicros: bigint;
  createdAt: Date;
};

export type RecipeWithComponents = RecipeRow & {
  components: RecipeComponentRow[];
};

export class InventoryLedgerError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "InventoryLedgerError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function boundedText(value: string | null | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

export function normalizeInventoryUnit(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 40) {
    throw new InventoryLedgerError(
      "A valid inventory unit is required",
      "INVALID_INVENTORY_UNIT",
      400
    );
  }
  return normalized;
}

export function parseQuantityInputToMicros(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InventoryLedgerError(
      "Inventory quantity must be greater than zero",
      "INVALID_INVENTORY_QUANTITY",
      400
    );
  }
  try {
    const micros = parseNonNegativeDecimalToScaledInteger(
      String(value),
      INVENTORY_QUANTITY_DIGITS,
      MAX_SAFE_SCALED
    );
    if (micros <= 0) throw new Error("zero");
    return micros;
  } catch {
    throw new InventoryLedgerError(
      "Inventory quantity is outside the supported range",
      "INVALID_INVENTORY_QUANTITY",
      400
    );
  }
}

export function quantityMicrosToNumber(value: bigint): number {
  if (value < -MAX_SAFE_SCALED || value > MAX_SAFE_SCALED) {
    throw new InventoryLedgerError(
      "Stored inventory quantity cannot be represented safely",
      "UNSAFE_INVENTORY_QUANTITY",
      500
    );
  }
  return Number(value) / 1_000_000;
}

export function unitCostMicrosToNumber(value: bigint): number {
  if (value < 0 || value > MAX_SAFE_SCALED) {
    throw new InventoryLedgerError(
      "Stored inventory cost cannot be represented safely",
      "UNSAFE_INVENTORY_COST",
      500
    );
  }
  return Number(value) / 1_000_000;
}

export function serializeIngredientStock(row: IngredientStockRow) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: quantityMicrosToNumber(row.quantityMicros),
    allowNegativeStock: row.allowNegativeStock,
    costPerUnit: unitCostMicrosToNumber(row.costPerUnitMicros),
    lowThreshold: row.lowThreshold,
    supplier: row.supplier,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeUnitConversion(row: UnitConversionRow) {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    baseUnit: row.baseUnit,
    unit: row.unit,
    toBaseQuantity: quantityMicrosToNumber(row.toBaseMicros),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeStockMovement(row: StockMovementRow) {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    baseUnit: row.baseUnit,
    movementType: row.movementType,
    quantityDelta: quantityMicrosToNumber(row.quantityDeltaMicros),
    unitCost: unitCostMicrosToNumber(row.unitCostMicros),
    totalCost: Number(row.totalCostMinor) / 100,
    balanceAfter: quantityMicrosToNumber(row.balanceAfterMicros),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceLineId: row.sourceLineId,
    reversalOfId: row.reversalOfId,
    reasonCode: row.reasonCode,
    reason: row.reason,
    actorId: row.actorId,
    actorName: row.actorName,
    metadata: row.metadata,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

export function serializeRecipe(recipe: RecipeWithComponents) {
  return {
    id: recipe.id,
    menuItemId: recipe.menuItemId,
    menuItemNameEn: recipe.menuItemNameEn,
    menuItemNameAr: recipe.menuItemNameAr,
    version: recipe.version,
    yieldQuantity: quantityMicrosToNumber(recipe.yieldMicros),
    isActive: recipe.isActive,
    createdById: recipe.createdById,
    createdByName: recipe.createdByName,
    createdAt: recipe.createdAt,
    supersededAt: recipe.supersededAt,
    components: recipe.components.map((component) => ({
      id: component.id,
      ingredientId: component.ingredientId,
      ingredientName: component.ingredientName,
      ingredientUnit: component.ingredientUnit,
      modifierOptionId: component.modifierOptionId,
      modifierNameEn: component.modifierNameEn,
      modifierNameAr: component.modifierNameAr,
      quantity: quantityMicrosToNumber(component.quantityMicros),
    })),
  };
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

async function lockIdempotencyKey(
  client: StockSqlClient,
  namespace: string,
  key: string
): Promise<void> {
  await client.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${namespace}:${key}`}, 0)
    )
  `);
}

export async function readIngredientStock(
  client: StockSqlClient,
  ingredientId: string,
  lock = false
): Promise<IngredientStockRow | null> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw<IngredientStockRow[]>(Prisma.sql`
    SELECT
      "id", "name", "unit", "quantity", "quantityMicros",
      "allowNegativeStock", "costPerUnit", "costPerUnitMicros",
      "lowThreshold", "supplier", "category", "createdAt", "updatedAt"
    FROM "Ingredient"
    WHERE "id" = ${ingredientId}
    LIMIT 1
    ${lockSql}
  `);
  return rows[0] ?? null;
}

export async function readIngredientsWithStock(
  client: StockSqlClient
): Promise<IngredientStockRow[]> {
  return client.$queryRaw<IngredientStockRow[]>(Prisma.sql`
    SELECT
      "id", "name", "unit", "quantity", "quantityMicros",
      "allowNegativeStock", "costPerUnit", "costPerUnitMicros",
      "lowThreshold", "supplier", "category", "createdAt", "updatedAt"
    FROM "Ingredient"
    ORDER BY "name" ASC, "id" ASC
  `);
}

export async function resolveQuantityToBaseMicros(
  client: StockSqlClient,
  ingredientId: string,
  quantity: number,
  submittedUnit: string
): Promise<{
  ingredient: IngredientStockRow;
  submittedQuantityMicros: bigint;
  baseQuantityMicros: bigint;
  submittedUnit: string;
}> {
  const ingredient = await readIngredientStock(client, ingredientId);
  if (!ingredient) {
    throw new InventoryLedgerError(
      "Ingredient not found",
      "INGREDIENT_NOT_FOUND",
      404
    );
  }

  const unit = normalizeInventoryUnit(submittedUnit);
  const baseUnit = normalizeInventoryUnit(ingredient.unit);
  const submittedQuantityMicros = parseQuantityInputToMicros(quantity);

  if (unit === baseUnit) {
    return {
      ingredient,
      submittedQuantityMicros,
      baseQuantityMicros: submittedQuantityMicros,
      submittedUnit: unit,
    };
  }

  const conversions = await client.$queryRaw<Array<{ toBaseMicros: bigint }>>(
    Prisma.sql`
      SELECT "toBaseMicros"
      FROM "IngredientUnitConversion"
      WHERE "ingredientId" = ${ingredientId} AND "unit" = ${unit}
      LIMIT 1
    `
  );
  const conversion = conversions[0];
  if (!conversion) {
    throw new InventoryLedgerError(
      `No ${unit} conversion is configured for ${ingredient.name}`,
      "UNIT_CONVERSION_NOT_FOUND",
      409,
      { ingredientId, unit, baseUnit }
    );
  }

  const baseQuantityMicros = divideAndRoundHalfUp(
    submittedQuantityMicros * conversion.toBaseMicros,
    INVENTORY_QUANTITY_SCALE
  );
  if (baseQuantityMicros <= 0) {
    throw new InventoryLedgerError(
      "Converted inventory quantity is too small",
      "INVENTORY_QUANTITY_TOO_SMALL",
      400
    );
  }

  return {
    ingredient,
    submittedQuantityMicros,
    baseQuantityMicros,
    submittedUnit: unit,
  };
}

export async function readUnitConversions(
  client: StockSqlClient,
  ingredientId?: string
): Promise<UnitConversionRow[]> {
  const filter = ingredientId
    ? Prisma.sql`WHERE conversion."ingredientId" = ${ingredientId}`
    : Prisma.empty;
  return client.$queryRaw<UnitConversionRow[]>(Prisma.sql`
    SELECT
      conversion."id",
      conversion."ingredientId",
      ingredient."name" AS "ingredientName",
      ingredient."unit" AS "baseUnit",
      conversion."unit",
      conversion."toBaseMicros",
      conversion."createdAt",
      conversion."updatedAt"
    FROM "IngredientUnitConversion" AS conversion
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = conversion."ingredientId"
    ${filter}
    ORDER BY ingredient."name" ASC, conversion."unit" ASC
  `);
}

export async function upsertUnitConversion(
  client: StockSqlClient,
  input: {
    ingredientId: string;
    unit: string;
    toBaseQuantity: number;
  }
): Promise<UnitConversionRow> {
  const ingredient = await readIngredientStock(client, input.ingredientId, true);
  if (!ingredient) {
    throw new InventoryLedgerError(
      "Ingredient not found",
      "INGREDIENT_NOT_FOUND",
      404
    );
  }

  const unit = normalizeInventoryUnit(input.unit);
  const baseUnit = normalizeInventoryUnit(ingredient.unit);
  if (unit === baseUnit) {
    throw new InventoryLedgerError(
      "The ingredient base unit already has a one-to-one conversion",
      "BASE_UNIT_CONVERSION_NOT_REQUIRED",
      409
    );
  }

  const toBaseMicros = parseQuantityInputToMicros(input.toBaseQuantity);
  const id = newId("unit_conversion");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "IngredientUnitConversion" (
      "id", "ingredientId", "unit", "toBaseMicros"
    ) VALUES (
      ${id}, ${ingredient.id}, ${unit}, ${toBaseMicros}
    )
    ON CONFLICT ("ingredientId", "unit") DO UPDATE SET
      "toBaseMicros" = EXCLUDED."toBaseMicros",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  const rows = await readUnitConversions(client, ingredient.id);
  const result = rows.find((row) => row.unit === unit);
  if (!result) {
    throw new InventoryLedgerError(
      "Unable to load saved unit conversion",
      "UNIT_CONVERSION_RESULT_MISSING",
      500
    );
  }
  return result;
}

async function readMovementByIdempotencyKey(
  client: StockSqlClient,
  key: string
): Promise<StockMovementRow | null> {
  const rows = await client.$queryRaw<StockMovementRow[]>(Prisma.sql`
    SELECT
      movement."id",
      movement."idempotencyKey",
      movement."ingredientId",
      ingredient."name" AS "ingredientName",
      ingredient."unit" AS "baseUnit",
      movement."movementType"::text AS "movementType",
      movement."quantityDeltaMicros",
      movement."unitCostMicros",
      movement."totalCostMinor",
      movement."balanceAfterMicros",
      movement."sourceType",
      movement."sourceId",
      movement."sourceLineId",
      movement."reversalOfId",
      movement."reasonCode",
      movement."reason",
      movement."actorId",
      movement."actorName",
      movement."metadata",
      movement."occurredAt",
      movement."createdAt"
    FROM "StockMovement" AS movement
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = movement."ingredientId"
    WHERE movement."idempotencyKey" = ${key}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function readStockMovement(
  client: StockSqlClient,
  movementId: string,
  lock = false
): Promise<StockMovementRow | null> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE OF movement` : Prisma.empty;
  const rows = await client.$queryRaw<StockMovementRow[]>(Prisma.sql`
    SELECT
      movement."id",
      movement."idempotencyKey",
      movement."ingredientId",
      ingredient."name" AS "ingredientName",
      ingredient."unit" AS "baseUnit",
      movement."movementType"::text AS "movementType",
      movement."quantityDeltaMicros",
      movement."unitCostMicros",
      movement."totalCostMinor",
      movement."balanceAfterMicros",
      movement."sourceType",
      movement."sourceId",
      movement."sourceLineId",
      movement."reversalOfId",
      movement."reasonCode",
      movement."reason",
      movement."actorId",
      movement."actorName",
      movement."metadata",
      movement."occurredAt",
      movement."createdAt"
    FROM "StockMovement" AS movement
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = movement."ingredientId"
    WHERE movement."id" = ${movementId}
    LIMIT 1
    ${lockSql}
  `);
  return rows[0] ?? null;
}

export async function readStockMovements(
  client: StockSqlClient,
  options: {
    ingredientId?: string;
    sourceType?: string;
    sourceId?: string;
    sourceLineId?: string;
    limit?: number;
  } = {}
): Promise<StockMovementRow[]> {
  const limit = Math.max(1, Math.min(options.limit || 100, 500));
  const filters: Prisma.Sql[] = [];
  if (options.ingredientId) {
    filters.push(Prisma.sql`movement."ingredientId" = ${options.ingredientId}`);
  }
  if (options.sourceType) {
    filters.push(Prisma.sql`movement."sourceType" = ${options.sourceType}`);
  }
  if (options.sourceId) {
    filters.push(Prisma.sql`movement."sourceId" = ${options.sourceId}`);
  }
  if (options.sourceLineId) {
    filters.push(
      Prisma.sql`movement."sourceLineId" = ${options.sourceLineId}`
    );
  }
  const where =
    filters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

  return client.$queryRaw<StockMovementRow[]>(Prisma.sql`
    SELECT
      movement."id",
      movement."idempotencyKey",
      movement."ingredientId",
      ingredient."name" AS "ingredientName",
      ingredient."unit" AS "baseUnit",
      movement."movementType"::text AS "movementType",
      movement."quantityDeltaMicros",
      movement."unitCostMicros",
      movement."totalCostMinor",
      movement."balanceAfterMicros",
      movement."sourceType",
      movement."sourceId",
      movement."sourceLineId",
      movement."reversalOfId",
      movement."reasonCode",
      movement."reason",
      movement."actorId",
      movement."actorName",
      movement."metadata",
      movement."occurredAt",
      movement."createdAt"
    FROM "StockMovement" AS movement
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = movement."ingredientId"
    ${where}
    ORDER BY movement."createdAt" DESC, movement."id" DESC
    LIMIT ${limit}
  `);
}

export async function createStockMovement(
  client: StockSqlClient,
  input: {
    idempotencyKey: string;
    ingredientId: string;
    movementType: StockMovementType;
    quantityDeltaMicros: bigint;
    unitCostMicros?: bigint;
    sourceType?: string;
    sourceId?: string | null;
    sourceLineId?: string | null;
    reversalOfId?: string | null;
    reasonCode?: string;
    reason?: string | null;
    actor?: InventoryActor | null;
    metadata?: unknown;
    occurredAt?: Date;
  }
): Promise<{ movement: StockMovementRow; replayed: boolean }> {
  const key = boundedText(input.idempotencyKey, 191);
  if (!key || input.quantityDeltaMicros === 0n) {
    throw new InventoryLedgerError(
      "A valid stock movement key and non-zero quantity are required",
      "INVALID_STOCK_MOVEMENT",
      400
    );
  }
  if (!STOCK_MOVEMENT_TYPES.includes(input.movementType)) {
    throw new InventoryLedgerError(
      "Unknown stock movement type",
      "INVALID_STOCK_MOVEMENT_TYPE",
      400
    );
  }

  await lockIdempotencyKey(client, "stock-movement", key);
  const existing = await readMovementByIdempotencyKey(client, key);
  if (existing) {
    if (
      existing.ingredientId !== input.ingredientId ||
      existing.movementType !== input.movementType ||
      existing.quantityDeltaMicros !== input.quantityDeltaMicros ||
      existing.reversalOfId !== (input.reversalOfId || null)
    ) {
      throw new InventoryLedgerError(
        "The stock idempotency key was already used for another movement",
        "STOCK_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return { movement: existing, replayed: true };
  }

  const movementId = newId("stock_movement");
  const metadataJson =
    input.metadata === undefined ? null : JSON.stringify(input.metadata);
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "StockMovement" (
      "id", "idempotencyKey", "ingredientId", "movementType",
      "quantityDeltaMicros", "unitCostMicros", "sourceType", "sourceId",
      "sourceLineId", "reversalOfId", "reasonCode", "reason",
      "actorId", "actorName", "metadata", "occurredAt"
    ) VALUES (
      ${movementId},
      ${key},
      ${input.ingredientId},
      CAST(${input.movementType} AS "StockMovementType"),
      ${input.quantityDeltaMicros},
      ${input.unitCostMicros || 0n},
      ${boundedText(input.sourceType, 80)},
      ${input.sourceId || null},
      ${input.sourceLineId || null},
      ${input.reversalOfId || null},
      ${boundedText(input.reasonCode, 80)},
      ${input.reason ? boundedText(input.reason, 2000) : null},
      ${input.actor?.id || null},
      ${boundedText(input.actor?.name, 160)},
      CAST(${metadataJson} AS jsonb),
      ${input.occurredAt || new Date()}
    )
  `);

  const created = await readStockMovement(client, movementId);
  if (!created) {
    throw new InventoryLedgerError(
      "Unable to load the created stock movement",
      "STOCK_MOVEMENT_RESULT_MISSING",
      500
    );
  }
  return { movement: created, replayed: false };
}

export async function reverseStockMovement(
  client: StockSqlClient,
  input: {
    idempotencyKey: string;
    movementId: string;
    reasonCode: string;
    reason: string;
    actor: InventoryActor;
  }
): Promise<{ movement: StockMovementRow; replayed: boolean }> {
  const original = await readStockMovement(client, input.movementId, true);
  if (!original) {
    throw new InventoryLedgerError(
      "Stock movement not found",
      "STOCK_MOVEMENT_NOT_FOUND",
      404
    );
  }
  if (original.movementType === "reversal") {
    throw new InventoryLedgerError(
      "A reversal cannot reverse another reversal",
      "STOCK_REVERSAL_CHAIN_DISABLED",
      409
    );
  }
  if (original.sourceType === "PurchaseReceipt") {
    throw new InventoryLedgerError(
      "Purchase receipt movements must be corrected from Purchasing",
      "PURCHASE_RECEIPT_REVERSAL_REQUIRED",
      409
    );
  }

  return createStockMovement(client, {
    idempotencyKey: input.idempotencyKey,
    ingredientId: original.ingredientId,
    movementType: "reversal",
    quantityDeltaMicros: -original.quantityDeltaMicros,
    unitCostMicros: original.unitCostMicros,
    sourceType: "StockMovement",
    sourceId: original.sourceId,
    sourceLineId: original.id,
    reversalOfId: original.id,
    reasonCode: input.reasonCode,
    reason: input.reason,
    actor: input.actor,
    metadata: {
      originalMovementId: original.id,
      originalMovementType: original.movementType,
      originalSourceType: original.sourceType,
      originalSourceId: original.sourceId,
    },
  });
}

async function readRecipeComponents(
  client: StockSqlClient,
  recipeIds: string[]
): Promise<RecipeComponentRow[]> {
  if (recipeIds.length === 0) return [];
  return client.$queryRaw<RecipeComponentRow[]>(Prisma.sql`
    SELECT
      component."id",
      component."recipeId",
      component."ingredientId",
      ingredient."name" AS "ingredientName",
      ingredient."unit" AS "ingredientUnit",
      component."modifierOptionId",
      modifier_option."nameEn" AS "modifierNameEn",
      modifier_option."nameAr" AS "modifierNameAr",
      component."quantityMicros",
      component."createdAt"
    FROM "RecipeComponent" AS component
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = component."ingredientId"
    LEFT JOIN "ModifierOption" AS modifier_option
      ON modifier_option."id" = component."modifierOptionId"
    WHERE component."recipeId" IN (${Prisma.join(recipeIds)})
    ORDER BY component."recipeId" ASC, ingredient."name" ASC, component."id" ASC
  `);
}

export async function readRecipes(
  client: StockSqlClient,
  options: { menuItemId?: string; includeSuperseded?: boolean } = {}
): Promise<RecipeWithComponents[]> {
  const filters: Prisma.Sql[] = [];
  if (options.menuItemId) {
    filters.push(Prisma.sql`recipe."menuItemId" = ${options.menuItemId}`);
  }
  if (!options.includeSuperseded) {
    filters.push(Prisma.sql`recipe."isActive" = true`);
  }
  const where =
    filters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

  const recipes = await client.$queryRaw<RecipeRow[]>(Prisma.sql`
    SELECT
      recipe."id",
      recipe."creationKey",
      recipe."menuItemId",
      menu_item."nameEn" AS "menuItemNameEn",
      menu_item."nameAr" AS "menuItemNameAr",
      recipe."version",
      recipe."yieldMicros",
      recipe."isActive",
      recipe."createdById",
      recipe."createdByName",
      recipe."createdAt",
      recipe."supersededAt"
    FROM "Recipe" AS recipe
    JOIN "MenuItem" AS menu_item
      ON menu_item."id" = recipe."menuItemId"
    ${where}
    ORDER BY menu_item."nameEn" ASC, recipe."version" DESC
  `);
  const components = await readRecipeComponents(
    client,
    recipes.map((recipe) => recipe.id)
  );
  const byRecipe = new Map<string, RecipeComponentRow[]>();
  for (const component of components) {
    const bucket = byRecipe.get(component.recipeId) || [];
    bucket.push(component);
    byRecipe.set(component.recipeId, bucket);
  }
  return recipes.map((recipe) => ({
    ...recipe,
    components: byRecipe.get(recipe.id) || [],
  }));
}

export async function publishRecipeVersion(
  client: StockSqlClient,
  input: {
    creationKey: string;
    menuItemId: string;
    yieldQuantity: number;
    components: Array<{
      ingredientId: string;
      quantity: number;
      unit: string;
      modifierOptionId?: string | null;
    }>;
    actor: InventoryActor;
  }
): Promise<{ recipe: RecipeWithComponents; replayed: boolean }> {
  const creationKey = boundedText(input.creationKey, 191);
  if (!creationKey || input.components.length === 0) {
    throw new InventoryLedgerError(
      "A recipe key and at least one component are required",
      "INVALID_RECIPE",
      400
    );
  }

  await lockIdempotencyKey(client, "recipe", creationKey);
  const replay = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Recipe" WHERE "creationKey" = ${creationKey} LIMIT 1
  `);
  if (replay[0]) {
    const recipes = await readRecipes(client, {
      menuItemId: input.menuItemId,
      includeSuperseded: true,
    });
    const recipe = recipes.find((entry) => entry.id === replay[0].id);
    if (!recipe) {
      throw new InventoryLedgerError(
        "Recipe replay could not be loaded",
        "RECIPE_REPLAY_MISSING",
        500
      );
    }
    return { recipe, replayed: true };
  }

  const menuRows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "MenuItem" WHERE "id" = ${input.menuItemId} FOR UPDATE
  `);
  if (!menuRows[0]) {
    throw new InventoryLedgerError(
      "Menu item not found",
      "MENU_ITEM_NOT_FOUND",
      404
    );
  }

  const yieldMicros = parseQuantityInputToMicros(input.yieldQuantity);
  const componentRows: Array<{
    id: string;
    ingredientId: string;
    quantityMicros: bigint;
    modifierOptionId: string | null;
  }> = [];
  for (const component of input.components) {
    const resolved = await resolveQuantityToBaseMicros(
      client,
      component.ingredientId,
      component.quantity,
      component.unit
    );
    componentRows.push({
      id: newId("recipe_component"),
      ingredientId: component.ingredientId,
      quantityMicros: resolved.baseQuantityMicros,
      modifierOptionId: component.modifierOptionId || null,
    });
  }

  const duplicateKeys = new Set<string>();
  for (const component of componentRows) {
    const key = `${component.ingredientId}:${component.modifierOptionId || "base"}`;
    if (duplicateKeys.has(key)) {
      throw new InventoryLedgerError(
        "A recipe cannot contain the same ingredient/modifier component twice",
        "DUPLICATE_RECIPE_COMPONENT",
        400
      );
    }
    duplicateKeys.add(key);
  }

  const versions = await client.$queryRaw<Array<{ version: number }>>(Prisma.sql`
    SELECT COALESCE(MAX("version"), 0)::integer AS "version"
    FROM "Recipe"
    WHERE "menuItemId" = ${input.menuItemId}
  `);
  const version = (versions[0]?.version || 0) + 1;

  await client.$executeRaw(Prisma.sql`
    UPDATE "Recipe"
    SET "isActive" = false, "supersededAt" = CURRENT_TIMESTAMP
    WHERE "menuItemId" = ${input.menuItemId} AND "isActive" = true
  `);

  const recipeId = newId("recipe");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "Recipe" (
      "id", "creationKey", "menuItemId", "version", "yieldMicros",
      "createdById", "createdByName"
    ) VALUES (
      ${recipeId}, ${creationKey}, ${input.menuItemId}, ${version},
      ${yieldMicros}, ${input.actor.id}, ${boundedText(input.actor.name, 160)}
    )
  `);

  for (const component of componentRows) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "RecipeComponent" (
        "id", "recipeId", "ingredientId", "modifierOptionId",
        "quantityMicros"
      ) VALUES (
        ${component.id}, ${recipeId}, ${component.ingredientId},
        ${component.modifierOptionId}, ${component.quantityMicros}
      )
    `);
  }

  const recipes = await readRecipes(client, {
    menuItemId: input.menuItemId,
    includeSuperseded: true,
  });
  const recipe = recipes.find((entry) => entry.id === recipeId);
  if (!recipe) {
    throw new InventoryLedgerError(
      "Unable to load the published recipe",
      "RECIPE_RESULT_MISSING",
      500
    );
  }
  return { recipe, replayed: false };
}

type InventoryConsumptionState = "pending" | "consumed" | "untracked";

type OrderItemInventoryRow = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  modifiers: string;
  inventoryConsumptionState: InventoryConsumptionState;
  inventoryRecipeId: string | null;
  inventoryRecipeVersion: number | null;
  inventoryConsumedAt: Date | null;
};

type ActiveRecipeRow = {
  id: string;
  version: number;
  yieldMicros: bigint;
};

type ConsumptionComponentRow = {
  id: string;
  recipeId: string;
  ingredientId: string;
  modifierOptionId: string | null;
  quantityMicros: bigint;
  unitCostMicros: bigint;
};

function selectedModifierIds(snapshot: string): Set<string> {
  try {
    const parsed = JSON.parse(snapshot || "[]");
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((entry) =>
entry && typeof entry === "object" && typeof entry.id === "string"
  ? entry.id
  : null
        )
        .filter((id): id is string => Boolean(id))
    );
  } catch {
    return new Set();
  }
}

export async function consumeOrderItemInventory(
  client: StockSqlClient,
  input: {
    orderItemId: string;
    actor: InventoryActor;
  }
): Promise<{
  tracked: boolean;
  recipeId: string | null;
  recipeVersion: number | null;
  movements: StockMovementRow[];
  replayedMovementCount: number;
}> {
  const itemRows = await client.$queryRaw<OrderItemInventoryRow[]>(Prisma.sql`
    SELECT
      item."id",
      item."orderId",
      item."menuItemId",
      item."quantity",
      item."modifiers",
      item."inventoryConsumptionState"::text AS "inventoryConsumptionState",
      item."inventoryRecipeId",
      item."inventoryRecipeVersion",
      item."inventoryConsumedAt"
    FROM "OrderItem" AS item
    WHERE item."id" = ${input.orderItemId}
    FOR UPDATE OF item
  `);
  const item = itemRows[0];
  if (!item) {
    throw new InventoryLedgerError(
      "Order item not found",
      "ORDER_ITEM_NOT_FOUND",
      404
    );
  }

  if (item.inventoryConsumptionState === "consumed") {
    const movements = await readStockMovements(client, {
      sourceType: "OrderItem",
      sourceId: item.orderId,
      sourceLineId: item.id,
      limit: 500,
    });
    return {
      tracked: true,
      recipeId: item.inventoryRecipeId,
      recipeVersion: item.inventoryRecipeVersion,
      movements,
      replayedMovementCount: movements.length,
    };
  }

  if (item.inventoryConsumptionState === "untracked") {
    return {
      tracked: false,
      recipeId: null,
      recipeVersion: null,
      movements: [],
      replayedMovementCount: 0,
    };
  }

  const recipeRows = await client.$queryRaw<ActiveRecipeRow[]>(Prisma.sql`
    SELECT "id", "version", "yieldMicros"
    FROM "Recipe"
    WHERE "menuItemId" = ${item.menuItemId} AND "isActive" = true
    ORDER BY "version" DESC
    LIMIT 1
  `);
  const recipe = recipeRows[0];
  if (!recipe) {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE "OrderItem"
      SET
        "inventoryConsumptionState" = 'untracked',
        "inventoryConsumedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${item.id} AND "inventoryConsumptionState" = 'pending'
    `);
    if (changed !== 1) {
      throw new InventoryLedgerError(
        "Unable to persist the untracked inventory decision",
        "INVENTORY_SNAPSHOT_WRITE_FAILED",
        500
      );
    }
    return {
      tracked: false,
      recipeId: null,
      recipeVersion: null,
      movements: [],
      replayedMovementCount: 0,
    };
  }

  const components = await client.$queryRaw<ConsumptionComponentRow[]>(Prisma.sql`
    SELECT
      component."id",
      component."recipeId",
      component."ingredientId",
      component."modifierOptionId",
      component."quantityMicros",
      ingredient."costPerUnitMicros"
    FROM "RecipeComponent" AS component
    JOIN "Ingredient" AS ingredient
      ON ingredient."id" = component."ingredientId"
    WHERE component."recipeId" = ${recipe.id}
    ORDER BY component."ingredientId" ASC, component."id" ASC
  `);
  const selected = selectedModifierIds(item.modifiers);
  const applicable = components.filter(
    (component) =>
      component.modifierOptionId === null || selected.has(component.modifierOptionId)
  );

  const movements: StockMovementRow[] = [];
  let replayedMovementCount = 0;
  for (const component of applicable) {
    const requiredMicros = divideAndRoundHalfUp(
      component.quantityMicros *
        BigInt(item.quantity) *
        INVENTORY_QUANTITY_SCALE,
      recipe.yieldMicros
    );
    if (requiredMicros <= 0) continue;

    const result = await createStockMovement(client, {
      idempotencyKey: `production:${item.id}:${component.id}`,
      ingredientId: component.ingredientId,
      movementType: "production_consumption",
      quantityDeltaMicros: -requiredMicros,
      unitCostMicros: component.unitCostMicros,
      sourceType: "OrderItem",
      sourceId: item.orderId,
      sourceLineId: item.id,
      reasonCode: "recipe_consumption",
      reason: `Recipe ${recipe.id} v${recipe.version} production consumption`,
      actor: input.actor,
      metadata: {
        recipeId: recipe.id,
        recipeVersion: recipe.version,
        recipeComponentId: component.id,
        menuItemId: item.menuItemId,
        orderItemQuantity: item.quantity,
        modifierOptionId: component.modifierOptionId,
      },
    });
    movements.push(result.movement);
    if (result.replayed) replayedMovementCount += 1;
  }

  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "OrderItem"
    SET
      "inventoryConsumptionState" = 'consumed',
      "inventoryRecipeId" = ${recipe.id},
      "inventoryRecipeVersion" = ${recipe.version},
      "inventoryConsumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${item.id} AND "inventoryConsumptionState" = 'pending'
  `);
  if (changed !== 1) {
    throw new InventoryLedgerError(
      "Unable to persist the recipe consumption snapshot",
      "INVENTORY_SNAPSHOT_WRITE_FAILED",
      500
    );
  }

  return {
    tracked: true,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    movements,
    replayedMovementCount,
  };
}

export async function consumeOrderInventory(
  client: StockSqlClient,
  input: {
    orderId: string;
    actor: InventoryActor;
  }
): Promise<{
  trackedItemCount: number;
  untrackedItemCount: number;
  movementCount: number;
  replayedMovementCount: number;
}> {
  const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "OrderItem"
    WHERE "orderId" = ${input.orderId} AND "status" <> 'cancelled'
    ORDER BY "id" ASC
    FOR UPDATE
  `);
  let trackedItemCount = 0;
  let untrackedItemCount = 0;
  let movementCount = 0;
  let replayedMovementCount = 0;

  for (const row of rows) {
    const result = await consumeOrderItemInventory(client, {
      orderItemId: row.id,
      actor: input.actor,
    });
    if (result.tracked) trackedItemCount += 1;
    else untrackedItemCount += 1;
    movementCount += result.movements.length;
    replayedMovementCount += result.replayedMovementCount;
  }

  return {
    trackedItemCount,
    untrackedItemCount,
    movementCount,
    replayedMovementCount,
  };
}

function databaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

export function inventoryLedgerErrorFromDatabase(
  error: unknown
): InventoryLedgerError | null {
  const message = databaseErrorMessage(error);
  if (message.includes("Stock movement would make ingredient balance negative")) {
    return new InventoryLedgerError(
      "Insufficient ingredient stock for this operation",
      "INSUFFICIENT_STOCK",
      409
    );
  }
  if (message.includes("Stock movements are immutable")) {
    return new InventoryLedgerError(
      "Stock movements are immutable; create a reversal instead",
      "STOCK_MOVEMENT_IMMUTABLE",
      409
    );
  }
  if (
    message.includes("Stock reversal must exactly negate") ||
    message.includes("A stock reversal cannot reverse")
  ) {
    return new InventoryLedgerError(
      "Invalid stock reversal",
      "INVALID_STOCK_REVERSAL",
      409
    );
  }
  if (
    message.includes("StockMovement_one_reversal_per_movement_idx") ||
    message.includes("duplicate key value") && message.includes("reversalOfId")
  ) {
    return new InventoryLedgerError(
      "This stock movement was already reversed",
      "STOCK_MOVEMENT_ALREADY_REVERSED",
      409
    );
  }
  if (message.includes("Recipe modifier component belongs to another menu item")) {
    return new InventoryLedgerError(
      "A modifier-specific component must belong to the recipe menu item",
      "RECIPE_MODIFIER_MISMATCH",
      400
    );
  }
  if (message.includes("Ingredient quantity is ledger-controlled")) {
    return new InventoryLedgerError(
      "Ingredient quantity is ledger-controlled",
      "DIRECT_QUANTITY_EDIT_DISABLED",
      409
    );
  }
  if (message.includes("Recipe versions are immutable")) {
    return new InventoryLedgerError(
      "Recipe versions are immutable; publish a new version",
      "RECIPE_IMMUTABLE",
      409
    );
  }
  return null;
}
