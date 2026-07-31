import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.181";
const db = new PrismaClient();

interface ApiResponse<T> {
  response: Response;
  data: T;
}

interface IngredientExactRow {
  id: string;
  quantityMicros: bigint;
  allowNegativeStock: boolean;
  costPerUnitMicros: bigint;
}

interface MovementExactRow {
  id: string;
  movementType: string;
  quantityDeltaMicros: bigint;
  unitCostMicros: bigint;
  totalCostMinor: bigint;
  balanceAfterMicros: bigint;
  sourceId: string | null;
  sourceLineId: string | null;
  reversalOfId: string | null;
}

interface CountRow {
  count: number;
}

interface OrderItemInventorySnapshotRow {
  inventoryConsumptionState: "pending" | "consumed" | "untracked";
  inventoryRecipeId: string | null;
  inventoryRecipeVersion: number | null;
  inventoryConsumedAt: Date | null;
}

async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-stock-${crypto.randomUUID()}`);

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("origin", BASE_URL);
    headers.set("sec-fetch-site", "same-origin");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  const raw = await response.text();
  let data: T;
  try {
    data = (raw ? JSON.parse(raw) : null) as T;
  } catch {
    throw new Error(
      `${method} ${path} returned non-JSON status ${response.status}: ${raw.slice(0, 500)}`
    );
  }
  return { response, data };
}

function assertStatus(response: Response, expected: number, context: string) {
  assert.equal(
    response.status,
    expected,
    `${context}: expected HTTP ${expected}, received ${response.status}`
  );
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Successful login must set a staff session cookie");
  return setCookie.split(";", 1)[0];
}

async function login(pin: string): Promise<string> {
  const result = await api<any>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  assertStatus(result.response, 200, `Login for PIN ${pin}`);
  return cookieFrom(result.response);
}

async function createIngredient(
  cookie: string,
  input: {
    name: string;
    unit: string;
    quantity: number;
    lowThreshold?: number;
    costPerUnit: number;
    allowNegativeStock?: boolean;
  }
) {
  const result = await api<any>("/api/inventory", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: input.name,
      unit: input.unit,
      quantity: input.quantity,
      lowThreshold: input.lowThreshold ?? 0,
      costPerUnit: input.costPerUnit,
      allowNegativeStock: input.allowNegativeStock ?? false,
      supplier: "P1 integration",
      category: "P1 stock test",
    }),
  });
  assertStatus(result.response, 201, `Create ingredient ${input.name}`);
  return result.data.item;
}

async function createMenuItem(
  cookie: string,
  categoryId: string,
  name: string,
  withModifier = false
) {
  const result = await api<any>("/api/menu", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      type: "item",
      nameEn: name,
      nameAr: name,
      descriptionEn: "P1 stock-ledger integration item",
      descriptionAr: "P1 stock-ledger integration item",
      price: 10,
      image: "",
      isAvailable: true,
      isPopular: false,
      isSpecial: false,
      isNew: false,
      preparationTime: 1,
      calories: 0,
      allergens: "",
      dietary: "",
      sortOrder: 999,
      categoryId,
      modifierGroups: withModifier
        ? [
            {
              nameEn: "Stock options",
              nameAr: "Stock options",
              isRequired: false,
              min: 0,
              max: 1,
              options: [
                {
                  nameEn: "Extra stock component",
                  nameAr: "Extra stock component",
                  price: 1,
                  isDefault: false,
                  preset: "extra",
                },
              ],
            },
          ]
        : [],
    }),
  });
  assertStatus(result.response, 201, `Create menu item ${name}`);
  return result.data.item;
}

async function publishRecipe(
  cookie: string,
  body: Record<string, unknown>,
  key = `p1-stock-recipe-${crypto.randomUUID()}`
) {
  return api<any>("/api/inventory/recipes", {
    method: "POST",
    headers: { cookie, "idempotency-key": key },
    body: JSON.stringify(body),
  });
}

async function createOrder(
  menuItemId: string,
  modifierOptionIds: string[] = [],
  quantity = 1
) {
  const result = await api<any>("/api/orders", {
    method: "POST",
    headers: {
      "idempotency-key": `p1-stock-order-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      type: "takeout",
      customerName: "P1 Stock Guest",
      customerPhone: "",
      deliveryAddress: null,
      notes: "P1 stock ledger integration order",
      promoCode: null,
      tip: { mode: "none" },
      items: [
        {
          menuItemId,
          quantity,
          modifierOptionIds,
          notes: null,
          course: 1,
        },
      ],
    }),
  });
  assertStatus(result.response, 201, "Create stock-ledger order");
  return result.data.order;
}

async function movement(
  cookie: string,
  body: Record<string, unknown>,
  key = `p1-stock-movement-${crypto.randomUUID()}`
) {
  return api<any>("/api/inventory/movements", {
    method: "POST",
    headers: { cookie, "idempotency-key": key },
    body: JSON.stringify(body),
  });
}

async function ingredientExact(id: string): Promise<IngredientExactRow> {
  const rows = await db.$queryRawUnsafe<IngredientExactRow[]>(
    `SELECT "id", "quantityMicros", "allowNegativeStock", "costPerUnitMicros"
     FROM "Ingredient" WHERE "id" = $1`,
    id
  );
  assert.ok(rows[0], `Ingredient ${id} must exist`);
  return rows[0];
}

async function itemInventorySnapshot(
  orderItemId: string
): Promise<OrderItemInventorySnapshotRow> {
  const rows = await db.$queryRawUnsafe<OrderItemInventorySnapshotRow[]>(
    `SELECT
       "inventoryConsumptionState"::text AS "inventoryConsumptionState",
       "inventoryRecipeId",
       "inventoryRecipeVersion",
       "inventoryConsumedAt"
     FROM "OrderItem" WHERE "id" = $1`,
    orderItemId
  );
  assert.ok(rows[0], `Order item ${orderItemId} must exist`);
  return rows[0];
}

async function movementRows(
  ingredientId: string,
  sourceLineId?: string
): Promise<MovementExactRow[]> {
  return db.$queryRawUnsafe<MovementExactRow[]>(
    `SELECT
       "id", "movementType"::text AS "movementType",
       "quantityDeltaMicros", "unitCostMicros", "totalCostMinor",
       "balanceAfterMicros", "sourceId", "sourceLineId", "reversalOfId"
     FROM "StockMovement"
     WHERE "ingredientId" = $1
       AND ($2::text IS NULL OR "sourceLineId" = $2)
     ORDER BY "createdAt" ASC, "id" ASC`,
    ingredientId,
    sourceLineId || null
  );
}

async function expectDatabaseFailure(
  operation: () => Promise<unknown>,
  context: string
) {
  let failed = false;
  try {
    await operation();
  } catch {
    failed = true;
  }
  assert.equal(failed, true, context);
}

async function main() {
  console.log("\n[p1-stock] authorization, migration backfill, and exact opening balance");
  const [adminCookie, serverCookie] = await Promise.all([
    login("1234"),
    login("1111"),
  ]);

  const anonymous = await api<any>("/api/inventory/movements");
  assertStatus(anonymous.response, 401, "Anonymous stock-ledger read");

  const denied = await api<any>("/api/inventory/movements", {
    method: "POST",
    headers: {
      cookie: serverCookie,
      "idempotency-key": `p1-stock-denied-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ action: "invalid" }),
  });
  assertStatus(denied.response, 403, "Server stock mutation authorization");

  const missingOpeningRows = await db.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*)::integer AS "count"
    FROM "Ingredient" AS ingredient
    WHERE ingredient."quantityMicros" <> 0
      AND NOT EXISTS (
        SELECT 1 FROM "StockMovement" AS movement
        WHERE movement."ingredientId" = ingredient."id"
          AND movement."movementType"::text = 'opening_balance'
      )
  `);
  assert.equal(
    missingOpeningRows[0]?.count,
    0,
    "Every migrated or seeded non-zero ingredient needs an opening movement"
  );

  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const flour = await createIngredient(adminCookie, {
    name: `P1 Flour ${suffix}`,
    unit: "kg",
    quantity: 2,
    lowThreshold: 0.25,
    costPerUnit: 4.5,
  });
  assert.equal(flour.quantity, 2);
  const flourExact = await ingredientExact(flour.id);
  assert.equal(flourExact.quantityMicros, 2_000_000n);
  assert.equal(flourExact.costPerUnitMicros, 4_500_000n);
  assert.equal(flourExact.allowNegativeStock, false);

  const openingRows = await movementRows(flour.id);
  assert.equal(openingRows.length, 1);
  assert.equal(openingRows[0].movementType, "opening_balance");
  assert.equal(openingRows[0].quantityDeltaMicros, 2_000_000n);
  assert.equal(openingRows[0].balanceAfterMicros, 2_000_000n);
  assert.equal(openingRows[0].totalCostMinor, 900n);

  const directQuantity = await api<any>("/api/inventory", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ id: flour.id, quantity: 3 }),
  });
  assertStatus(directQuantity.response, 409, "Direct quantity replacement");
  assert.equal(directQuantity.data.code, "DIRECT_QUANTITY_EDIT_DISABLED");

  console.log("\n[p1-stock] unit conversion and immutable recipe versioning");
  const conversion = await api<any>("/api/inventory/conversions", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      ingredientId: flour.id,
      unit: "g",
      toBaseQuantity: 0.001,
    }),
  });
  assertStatus(conversion.response, 201, "Gram-to-kilogram conversion");
  assert.equal(conversion.data.conversion.unit, "g");
  assert.equal(conversion.data.conversion.toBaseQuantity, 0.001);

  const menu = await api<any>("/api/menu?all=true", {
    headers: { cookie: adminCookie },
  });
  assertStatus(menu.response, 200, "Administrative menu lookup");
  const category = (menu.data.categories || []).find(
    (entry: any) => entry.isAvailable
  );
  assert.ok(category, "An available menu category is required");

  const trackedItem = await createMenuItem(
    adminCookie,
    category.id,
    `P1 Tracked Dish ${suffix}`,
    true
  );
  const modifierOptionId = trackedItem.modifierGroups?.[0]?.options?.[0]?.id;
  assert.ok(modifierOptionId, "Tracked item must expose its modifier option ID");

  const recipeKey = `p1-stock-recipe-v1-${crypto.randomUUID()}`;
  const recipeBodyV1 = {
    menuItemId: trackedItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: flour.id,
        quantity: 100,
        unit: "g",
        modifierOptionId: null,
      },
      {
        ingredientId: flour.id,
        quantity: 50,
        unit: "g",
        modifierOptionId,
      },
    ],
  };
  const recipeV1 = await publishRecipe(adminCookie, recipeBodyV1, recipeKey);
  assertStatus(recipeV1.response, 201, "Publish recipe version 1");
  assert.equal(recipeV1.data.recipe.version, 1);
  assert.equal(recipeV1.data.recipe.components.length, 2);
  assert.equal(recipeV1.data.replayed, false);

  const recipeReplay = await publishRecipe(adminCookie, recipeBodyV1, recipeKey);
  assertStatus(recipeReplay.response, 200, "Recipe version replay");
  assert.equal(recipeReplay.data.replayed, true);
  assert.equal(recipeReplay.data.recipe.id, recipeV1.data.recipe.id);

  const recipeV2 = await publishRecipe(adminCookie, {
    menuItemId: trackedItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: flour.id,
        quantity: 120,
        unit: "g",
        modifierOptionId: null,
      },
      {
        ingredientId: flour.id,
        quantity: 30,
        unit: "g",
        modifierOptionId,
      },
    ],
  });
  assertStatus(recipeV2.response, 201, "Publish recipe version 2");
  assert.equal(recipeV2.data.recipe.version, 2);

  const recipeStateRows = await db.$queryRawUnsafe<
    Array<{ version: number; isActive: boolean; supersededAt: Date | null }>
  >(
    `SELECT "version", "isActive", "supersededAt"
     FROM "Recipe" WHERE "menuItemId" = $1 ORDER BY "version" ASC`,
    trackedItem.id
  );
  assert.deepEqual(
    recipeStateRows.map((row) => [row.version, row.isActive]),
    [
      [1, false],
      [2, true],
    ]
  );
  assert.ok(recipeStateRows[0].supersededAt);

  const foreignItem = await createMenuItem(
    adminCookie,
    category.id,
    `P1 Foreign Modifier ${suffix}`,
    true
  );
  const foreignOptionId = foreignItem.modifierGroups?.[0]?.options?.[0]?.id;
  assert.ok(foreignOptionId);
  const mismatchedRecipe = await publishRecipe(adminCookie, {
    menuItemId: trackedItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: flour.id,
        quantity: 1,
        unit: "g",
        modifierOptionId: foreignOptionId,
      },
    ],
  });
  assertStatus(mismatchedRecipe.response, 400, "Cross-item modifier recipe");
  assert.equal(mismatchedRecipe.data.code, "RECIPE_MODIFIER_MISMATCH");

  console.log("\n[p1-stock] direct KDS production consumes the active recipe once");
  const trackedOrder = await createOrder(
    trackedItem.id,
    [modifierOptionId],
    2
  );
  const trackedOrderItem = trackedOrder.items[0];
  const ready = await api<any>("/api/kitchen", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ itemId: trackedOrderItem.id, status: "ready" }),
  });
  assertStatus(ready.response, 200, "Direct pending-to-ready KDS transition");
  assert.equal(ready.data.inventory.tracked, true);
  assert.equal(ready.data.inventory.recipeVersion, 2);
  assert.equal(ready.data.inventory.movementCount, 2);
  assert.equal(ready.data.inventory.replayedMovementCount, 0);

  const productionRows = await movementRows(flour.id, trackedOrderItem.id);
  assert.equal(productionRows.length, 2);
  assert.equal(
    productionRows.reduce((sum, row) => sum + row.quantityDeltaMicros, 0n),
    -300_000n
  );
  assert.equal(
    productionRows.reduce((sum, row) => sum + row.totalCostMinor, 0n),
    135n
  );
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_700_000n);

  const readyReplay = await api<any>("/api/kitchen", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ itemId: trackedOrderItem.id, status: "ready" }),
  });
  assertStatus(readyReplay.response, 200, "Repeated ready transition");
  assert.equal(readyReplay.data.inventory.replayedMovementCount, 2);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_700_000n);

  console.log("\n[p1-stock] recipe consumption snapshots survive recipe changes");
  const orderLevel = await createOrder(trackedItem.id, [], 1);
  const orderLevelItem = orderLevel.items[0];
  const preparing = await api<any>(
    `/api/orders/${encodeURIComponent(orderLevel.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "preparing" }),
    }
  );
  assertStatus(preparing.response, 200, "Order enters production");
  assert.equal(preparing.data.inventory.trackedItemCount, 1);
  assert.equal(preparing.data.inventory.replayedMovementCount, 0);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_580_000n);

  const firstSnapshot = await itemInventorySnapshot(orderLevelItem.id);
  assert.equal(firstSnapshot.inventoryConsumptionState, "consumed");
  assert.equal(firstSnapshot.inventoryRecipeId, recipeV2.data.recipe.id);
  assert.equal(firstSnapshot.inventoryRecipeVersion, 2);
  assert.ok(firstSnapshot.inventoryConsumedAt);

  const recipeV3 = await publishRecipe(adminCookie, {
    menuItemId: trackedItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: flour.id,
        quantity: 400,
        unit: "g",
        modifierOptionId: null,
      },
    ],
  });
  assertStatus(recipeV3.response, 201, "Publish recipe after production started");
  assert.equal(recipeV3.data.recipe.version, 3);

  const orderReady = await api<any>(
    `/api/orders/${encodeURIComponent(orderLevel.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "ready" }),
    }
  );
  assertStatus(orderReady.response, 200, "Order ready after recipe replacement");
  assert.equal(orderReady.data.inventory.replayedMovementCount, 1);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_580_000n);
  assert.equal((await movementRows(flour.id, orderLevelItem.id)).length, 1);
  const replaySnapshot = await itemInventorySnapshot(orderLevelItem.id);
  assert.equal(replaySnapshot.inventoryRecipeId, recipeV2.data.recipe.id);
  assert.equal(replaySnapshot.inventoryRecipeVersion, 2);

  const completed = await api<any>(
    `/api/orders/${encodeURIComponent(orderLevel.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "completed" }),
    }
  );
  assertStatus(completed.response, 200, "Order completion after production");
  assert.equal(completed.data.inventory.replayedMovementCount, 1);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_580_000n);

  console.log("\n[p1-stock] a no-recipe decision remains permanently untracked");
  const lateRecipeItem = await createMenuItem(
    adminCookie,
    category.id,
    `P1 Late Recipe ${suffix}`
  );
  const lateRecipeOrder = await createOrder(lateRecipeItem.id);
  const lateRecipeOrderItem = lateRecipeOrder.items[0];
  const latePreparing = await api<any>(
    `/api/orders/${encodeURIComponent(lateRecipeOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "preparing" }),
    }
  );
  assertStatus(latePreparing.response, 200, "Untracked order enters production");
  assert.equal(latePreparing.data.inventory.untrackedItemCount, 1);
  const untrackedSnapshot = await itemInventorySnapshot(lateRecipeOrderItem.id);
  assert.equal(untrackedSnapshot.inventoryConsumptionState, "untracked");
  assert.equal(untrackedSnapshot.inventoryRecipeId, null);
  assert.ok(untrackedSnapshot.inventoryConsumedAt);

  const lateRecipe = await publishRecipe(adminCookie, {
    menuItemId: lateRecipeItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: flour.id,
        quantity: 250,
        unit: "g",
        modifierOptionId: null,
      },
    ],
  });
  assertStatus(lateRecipe.response, 201, "Publish recipe after untracked decision");

  const lateReady = await api<any>(
    `/api/orders/${encodeURIComponent(lateRecipeOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "ready" }),
    }
  );
  assertStatus(lateReady.response, 200, "Untracked order becomes ready");
  assert.equal(lateReady.data.inventory.untrackedItemCount, 1);
  assert.equal((await movementRows(flour.id, lateRecipeOrderItem.id)).length, 0);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 1_580_000n);
  assert.equal(
    (await itemInventorySnapshot(lateRecipeOrderItem.id)).inventoryConsumptionState,
    "untracked"
  );

  console.log("\n[p1-stock] insufficient stock rolls the status transition back");
  const scarce = await createIngredient(adminCookie, {
    name: `P1 Scarce Spice ${suffix}`,
    unit: "kg",
    quantity: 0.05,
    costPerUnit: 100,
  });
  const scarceItem = await createMenuItem(
    adminCookie,
    category.id,
    `P1 Scarce Dish ${suffix}`
  );
  const scarceRecipe = await publishRecipe(adminCookie, {
    menuItemId: scarceItem.id,
    yieldQuantity: 1,
    components: [
      {
        ingredientId: scarce.id,
        quantity: 0.1,
        unit: "kg",
        modifierOptionId: null,
      },
    ],
  });
  assertStatus(scarceRecipe.response, 201, "Scarce recipe creation");

  const scarceOrder = await createOrder(scarceItem.id);
  const scarceOrderItem = scarceOrder.items[0];
  const insufficient = await api<any>("/api/kitchen", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ itemId: scarceOrderItem.id, status: "ready" }),
  });
  assertStatus(insufficient.response, 409, "Insufficient production stock");
  assert.equal(insufficient.data.code, "INSUFFICIENT_STOCK");
  const unchangedItem = await db.orderItem.findUnique({
    where: { id: scarceOrderItem.id },
    select: { status: true },
  });
  assert.equal(unchangedItem?.status, "pending");
  assert.equal((await movementRows(scarce.id, scarceOrderItem.id)).length, 0);
  assert.equal((await ingredientExact(scarce.id)).quantityMicros, 50_000n);

  console.log("\n[p1-stock] receipt, waste, replay, reversal, and cost snapshots");
  const receiptKey = `p1-stock-receipt-${crypto.randomUUID()}`;
  const receipt = await movement(
    adminCookie,
    {
      action: "receipt",
      ingredientId: flour.id,
      quantity: 500,
      unit: "g",
      unitCost: 4.5,
      referenceType: "IntegrationReceipt",
      referenceId: suffix,
      reasonCode: "supplier_delivery",
      reason: "Integration supplier receipt",
    },
    receiptKey
  );
  assertStatus(receipt.response, 201, "Converted stock receipt");
  assert.equal(receipt.data.movement.quantityDelta, 0.5);
  assert.equal(receipt.data.movement.totalCost, 2.25);
  assert.equal(receipt.data.ingredient.quantity, 2.08);

  const receiptReplay = await movement(
    adminCookie,
    {
      action: "receipt",
      ingredientId: flour.id,
      quantity: 500,
      unit: "g",
      unitCost: 4.5,
      referenceType: "IntegrationReceipt",
      referenceId: suffix,
      reasonCode: "supplier_delivery",
      reason: "Integration supplier receipt",
    },
    receiptKey
  );
  assertStatus(receiptReplay.response, 200, "Receipt replay");
  assert.equal(receiptReplay.data.replayed, true);
  assert.equal(receiptReplay.data.movement.id, receipt.data.movement.id);
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 2_080_000n);

  const wasteKey = `p1-stock-waste-${crypto.randomUUID()}`;
  const wasteResult = await movement(
    adminCookie,
    {
      action: "waste",
      ingredientId: flour.id,
      quantity: 100,
      unit: "g",
      reasonCode: "expired",
      reason: "Expired integration batch",
    },
    wasteKey
  );
  assertStatus(wasteResult.response, 201, "Converted waste movement");
  assert.ok(wasteResult.data.waste?.id);
  assert.equal(wasteResult.data.movement.quantityDelta, -0.1);
  assert.equal(wasteResult.data.ingredient.quantity, 1.98);

  const wasteReplay = await movement(
    adminCookie,
    {
      action: "waste",
      ingredientId: flour.id,
      quantity: 100,
      unit: "g",
      reasonCode: "expired",
      reason: "Expired integration batch",
    },
    wasteKey
  );
  assertStatus(wasteReplay.response, 200, "Waste replay");
  assert.equal(wasteReplay.data.replayed, true);
  assert.equal(wasteReplay.data.movement.id, wasteResult.data.movement.id);
  assert.equal(wasteReplay.data.waste.id, wasteResult.data.waste.id);

  const wasteCounts = await db.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::integer AS "count"
     FROM "WasteLog" WHERE "id" = $1`,
    wasteResult.data.waste.id
  );
  assert.equal(wasteCounts[0]?.count, 1);

  const reversalKey = `p1-stock-reversal-${crypto.randomUUID()}`;
  const reversal = await movement(
    adminCookie,
    {
      action: "reverse",
      movementId: wasteResult.data.movement.id,
      reasonCode: "manager_correction",
      reason: "Waste entry was recorded against the wrong batch",
    },
    reversalKey
  );
  assertStatus(reversal.response, 201, "Waste movement reversal");
  assert.equal(reversal.data.movement.quantityDelta, 0.1);
  assert.equal(reversal.data.ingredient.quantity, 2.08);

  const reversalReplay = await movement(
    adminCookie,
    {
      action: "reverse",
      movementId: wasteResult.data.movement.id,
      reasonCode: "manager_correction",
      reason: "Waste entry was recorded against the wrong batch",
    },
    reversalKey
  );
  assertStatus(reversalReplay.response, 200, "Reversal replay");
  assert.equal(reversalReplay.data.replayed, true);

  const duplicateReversal = await movement(adminCookie, {
    action: "reverse",
    movementId: wasteResult.data.movement.id,
    reasonCode: "manager_correction",
    reason: "A second reversal must be rejected",
  });
  assertStatus(duplicateReversal.response, 409, "Duplicate stock reversal");

  console.log("\n[p1-stock] concurrent writes serialize and negative-stock policy is explicit");
  const race = await Promise.all([
    movement(adminCookie, {
      action: "adjustment",
      direction: "out",
      ingredientId: flour.id,
      quantity: 1.5,
      unit: "kg",
      reasonCode: "physical_count",
      reason: "Concurrent physical-count correction A",
    }),
    movement(adminCookie, {
      action: "adjustment",
      direction: "out",
      ingredientId: flour.id,
      quantity: 1.5,
      unit: "kg",
      reasonCode: "physical_count",
      reason: "Concurrent physical-count correction B",
    }),
  ]);
  assert.deepEqual(
    race.map((entry) => entry.response.status).sort(),
    [201, 409]
  );
  assert.equal((await ingredientExact(flour.id)).quantityMicros, 580_000n);

  const negativeIngredient = await createIngredient(adminCookie, {
    name: `P1 Negative Allowed ${suffix}`,
    unit: "kg",
    quantity: 0.1,
    costPerUnit: 2,
    allowNegativeStock: true,
  });
  const negativeMovement = await movement(adminCookie, {
    action: "adjustment",
    direction: "out",
    ingredientId: negativeIngredient.id,
    quantity: 0.2,
    unit: "kg",
    reasonCode: "production_continuity",
    reason: "Explicit negative-stock policy test",
  });
  assertStatus(negativeMovement.response, 201, "Allowed negative stock");
  assert.equal(negativeMovement.data.ingredient.quantity, -0.1);

  console.log("\n[p1-stock] ledger reconciliation, immutability, and audits");
  const reconciliationRows = await db.$queryRawUnsafe<
    Array<{ movementTotal: bigint; quantityMicros: bigint; latestBalance: bigint }>
  >(
    `SELECT
       COALESCE(SUM(movement."quantityDeltaMicros"), 0)::bigint AS "movementTotal",
       ingredient."quantityMicros",
       (
         SELECT latest."balanceAfterMicros"
         FROM "StockMovement" AS latest
         WHERE latest."ingredientId" = ingredient."id"
         ORDER BY latest."createdAt" DESC, latest."id" DESC
         LIMIT 1
       ) AS "latestBalance"
     FROM "Ingredient" AS ingredient
     LEFT JOIN "StockMovement" AS movement
       ON movement."ingredientId" = ingredient."id"
     WHERE ingredient."id" = $1
     GROUP BY ingredient."id", ingredient."quantityMicros"`,
    flour.id
  );
  assert.equal(
    reconciliationRows[0].movementTotal,
    reconciliationRows[0].quantityMicros
  );
  assert.equal(
    reconciliationRows[0].latestBalance,
    reconciliationRows[0].quantityMicros
  );

  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "Ingredient" SET "quantity" = 99 WHERE "id" = $1',
        flour.id
      ),
    "Direct database quantity edits must be blocked"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "StockMovement" SET "reason" = $1 WHERE "id" = $2',
        "tampered",
        receipt.data.movement.id
      ),
    "Stock movements must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'DELETE FROM "StockMovement" WHERE "id" = $1',
        receipt.data.movement.id
      ),
    "Stock movements cannot be deleted"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "RecipeComponent" SET "quantityMicros" = 1 WHERE "recipeId" = $1',
        recipeV2.data.recipe.id
      ),
    "Recipe components must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'DELETE FROM "Recipe" WHERE "id" = $1',
        recipeV2.data.recipe.id
      ),
    "Recipe versions cannot be deleted"
  );

  const auditRows = await db.auditEvent.groupBy({
    by: ["action"],
    where: {
      action: {
        in: [
          "inventory.ingredient.create",
          "inventory.unit_conversion.upsert",
          "inventory.recipe.publish",
          "inventory.production.consume_item",
          "inventory.production.consume_order",
          "inventory.stock.receipt",
          "inventory.stock.waste",
          "inventory.stock.reverse",
          "inventory.stock.adjustment_out",
        ],
      },
    },
    _count: { _all: true },
  });
  const auditActions = new Set(auditRows.map((entry) => entry.action));
  for (const action of [
    "inventory.ingredient.create",
    "inventory.unit_conversion.upsert",
    "inventory.recipe.publish",
    "inventory.production.consume_item",
    "inventory.production.consume_order",
    "inventory.stock.receipt",
    "inventory.stock.waste",
    "inventory.stock.reverse",
    "inventory.stock.adjustment_out",
  ]) {
    assert.ok(auditActions.has(action), `Missing inventory audit action ${action}`);
  }

  console.log("\n[p1-stock] Stock ledger and recipe assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-stock] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
