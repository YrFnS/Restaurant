import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.193";
const db = new PrismaClient();

interface ApiResult<T> {
  response: Response;
  data: T;
}

interface ExactOrderRow {
  id: string;
  status: string;
  totalCostMinor: bigint;
}

interface ExactLineRow {
  id: string;
  orderedPurchaseQuantityMicros: bigint;
  orderedBaseQuantityMicros: bigint;
  receivedBaseQuantityMicros: bigint;
  purchaseUnitCostMicros: bigint;
  baseUnitCostMicros: bigint;
  lineTotalMinor: bigint;
}

interface ExactIngredientRow {
  quantityMicros: bigint;
}

interface CountRow {
  count: number;
}

async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p1-purchasing-${crypto.randomUUID()}`);
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

function key(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function createIngredient(cookie: string, suffix: string) {
  const result = await api<any>("/api/inventory", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: `P1 Purchase Flour ${suffix}`,
      unit: "kg",
      quantity: 1,
      lowThreshold: 0,
      costPerUnit: 4,
      allowNegativeStock: false,
      supplier: "P1 purchasing integration",
      category: "P1 purchasing",
    }),
  });
  assertStatus(result.response, 201, "Create purchasing ingredient");
  return result.data.item;
}

async function createPurchaseOrder(
  cookie: string,
  supplierId: string,
  ingredientId: string,
  idempotencyKey = key("p1-purchase-order")
) {
  const body = {
    supplierId,
    currency: "USD",
    notes: "P1 exact purchasing integration",
    expectedAt: new Date(Date.now() + 86_400_000).toISOString(),
    lines: [
      {
        ingredientId,
        quantity: 2,
        unit: "bag",
        unitCost: 100,
        notes: "Two 25kg bags",
      },
    ],
  };
  return {
    key: idempotencyKey,
    body,
    result: await api<any>("/api/purchase-orders", {
      method: "POST",
      headers: { cookie, "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    }),
  };
}

async function exactIngredient(id: string): Promise<ExactIngredientRow> {
  const rows = await db.$queryRawUnsafe<ExactIngredientRow[]>(
    'SELECT "quantityMicros" FROM "Ingredient" WHERE "id" = $1',
    id
  );
  assert.ok(rows[0], `Ingredient ${id} must exist`);
  return rows[0];
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
  console.log("\n[p1-purchasing] authorization and supplier administration");
  const [adminCookie, serverCookie] = await Promise.all([
    login("1234"),
    login("1111"),
  ]);

  const anonymous = await api<any>("/api/purchase-orders");
  assertStatus(anonymous.response, 401, "Anonymous purchase-order read");

  const denied = await api<any>("/api/suppliers", {
    method: "POST",
    headers: { cookie: serverCookie },
    body: JSON.stringify({ name: "Denied Supplier" }),
  });
  assertStatus(denied.response, 403, "Server supplier mutation");

  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const supplierResult = await api<any>("/api/suppliers", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      code: `P1-${suffix}`,
      name: `P1 Purchasing Supplier ${suffix}`,
      contactName: "Integration Contact",
      phone: "+9647500000000",
      email: `p1-${suffix}@example.com`,
      address: "Baghdad",
      paymentTerms: "Net 30",
      notes: "Purchasing integration supplier",
    }),
  });
  assertStatus(supplierResult.response, 201, "Create supplier");
  const supplier = supplierResult.data.supplier;
  assert.equal(supplier.status, "active");
  assert.equal(supplier.code, `P1-${suffix}`.toUpperCase());

  const ingredient = await createIngredient(adminCookie, suffix);
  const conversion = await api<any>("/api/inventory/conversions", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      ingredientId: ingredient.id,
      unit: "bag",
      toBaseQuantity: 25,
    }),
  });
  assertStatus(conversion.response, 201, "Create 25kg bag conversion");

  console.log("\n[p1-purchasing] exact draft creation and idempotent replay");
  const created = await createPurchaseOrder(
    adminCookie,
    supplier.id,
    ingredient.id
  );
  assertStatus(created.result.response, 201, "Create exact purchase order");
  const purchaseOrder = created.result.data.purchaseOrder;
  assert.equal(purchaseOrder.status, "draft");
  assert.equal(purchaseOrder.totalCost, 200);
  assert.equal(purchaseOrder.lineCount, 1);
  assert.equal(purchaseOrder.lines[0].orderedQuantity, 2);
  assert.equal(purchaseOrder.lines[0].orderedBaseQuantity, 50);
  assert.equal(purchaseOrder.lines[0].unitCost, 100);
  assert.equal(purchaseOrder.lines[0].baseUnitCost, 4);

  const replay = await api<any>("/api/purchase-orders", {
    method: "POST",
    headers: { cookie: adminCookie, "idempotency-key": created.key },
    body: JSON.stringify(created.body),
  });
  assertStatus(replay.response, 200, "Purchase-order replay");
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.purchaseOrder.id, purchaseOrder.id);

  const exactOrders = await db.$queryRawUnsafe<ExactOrderRow[]>(
    `SELECT "id", "status"::text AS "status", "totalCostMinor"
     FROM "PurchaseOrder" WHERE "id" = $1`,
    purchaseOrder.id
  );
  assert.equal(exactOrders[0].totalCostMinor, 20_000n);
  const exactLines = await db.$queryRawUnsafe<ExactLineRow[]>(
    `SELECT "id", "orderedPurchaseQuantityMicros", "orderedBaseQuantityMicros",
       "receivedBaseQuantityMicros", "purchaseUnitCostMicros",
       "baseUnitCostMicros", "lineTotalMinor"
     FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = $1`,
    purchaseOrder.id
  );
  assert.equal(exactLines.length, 1);
  assert.equal(exactLines[0].orderedPurchaseQuantityMicros, 2_000_000n);
  assert.equal(exactLines[0].orderedBaseQuantityMicros, 50_000_000n);
  assert.equal(exactLines[0].purchaseUnitCostMicros, 100_000_000n);
  assert.equal(exactLines[0].baseUnitCostMicros, 4_000_000n);
  assert.equal(exactLines[0].lineTotalMinor, 20_000n);

  console.log("\n[p1-purchasing] submission freezes commercial terms");
  const submit = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ action: "submit" }),
    }
  );
  assertStatus(submit.response, 200, "Submit purchase order");
  assert.equal(submit.data.purchaseOrder.status, "submitted");

  const submitReplay = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ action: "submit" }),
    }
  );
  assertStatus(submitReplay.response, 200, "Submit replay");
  assert.equal(submitReplay.data.replayed, true);

  const editSubmitted = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        action: "update_draft",
        supplierId: supplier.id,
        currency: "USD",
        notes: "Commercial tampering must fail",
        expectedAt: null,
        lines: created.body.lines,
      }),
    }
  );
  assertStatus(editSubmitted.response, 409, "Edit submitted purchase order");

  console.log("\n[p1-purchasing] partial receiving, replay, and exact stock movement");
  const purchaseOrderLineId = purchaseOrder.lines[0].id;
  const firstReceiptKey = key("p1-purchase-receipt");
  const firstReceiptBody = {
    action: "receive",
    lines: [{ purchaseOrderLineId, quantity: 0.5 }],
    notes: "First partial delivery",
  };
  const firstReceipt = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": firstReceiptKey },
      body: JSON.stringify(firstReceiptBody),
    }
  );
  assertStatus(firstReceipt.response, 201, "Post partial receipt");
  assert.equal(firstReceipt.data.purchaseOrder.status, "partially_received");
  assert.equal(firstReceipt.data.receipt.totalCost, 50);
  assert.equal(firstReceipt.data.receipt.lines[0].submittedQuantity, 0.5);
  assert.equal(firstReceipt.data.receipt.lines[0].baseQuantity, 12.5);
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 13_500_000n);

  const firstReceiptReplay = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": firstReceiptKey },
      body: JSON.stringify(firstReceiptBody),
    }
  );
  assertStatus(firstReceiptReplay.response, 200, "Receipt replay");
  assert.equal(firstReceiptReplay.data.replayed, true);
  assert.equal(
    firstReceiptReplay.data.receipt.id,
    firstReceipt.data.receipt.id
  );
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 13_500_000n);

  const movementRows = await db.$queryRawUnsafe<
    Array<{
      quantityDeltaMicros: bigint;
      unitCostMicros: bigint;
      totalCostMinor: bigint;
      sourceType: string;
      sourceId: string | null;
    }>
  >(
    `SELECT "quantityDeltaMicros", "unitCostMicros", "totalCostMinor",
       "sourceType", "sourceId"
     FROM "StockMovement" WHERE "id" = $1`,
    firstReceipt.data.receipt.lines[0].stockMovementId
  );
  assert.equal(movementRows[0].quantityDeltaMicros, 12_500_000n);
  assert.equal(movementRows[0].unitCostMicros, 4_000_000n);
  assert.equal(movementRows[0].totalCostMinor, 5_000n);
  assert.equal(movementRows[0].sourceType, "PurchaseReceipt");
  assert.equal(movementRows[0].sourceId, firstReceipt.data.receipt.id);

  const overReceipt = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": key("p1-over-receipt") },
      body: JSON.stringify({
        action: "receive",
        lines: [{ purchaseOrderLineId, quantity: 2 }],
        notes: "Over receipt must fail",
      }),
    }
  );
  assertStatus(overReceipt.response, 409, "Reject over receipt");
  assert.equal(overReceipt.data.code, "PURCHASE_RECEIPT_OVER_QUANTITY");
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 13_500_000n);

  console.log("\n[p1-purchasing] concurrent final receipts serialize safely");
  const concurrentBody = JSON.stringify({
    action: "receive",
    lines: [{ purchaseOrderLineId, quantity: 1.5 }],
    notes: "Concurrent final delivery",
  });
  const race = await Promise.all([
    api<any>(
      `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
      {
        method: "POST",
        headers: { cookie: adminCookie, "idempotency-key": key("p1-receipt-race-a") },
        body: concurrentBody,
      }
    ),
    api<any>(
      `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
      {
        method: "POST",
        headers: { cookie: adminCookie, "idempotency-key": key("p1-receipt-race-b") },
        body: concurrentBody,
      }
    ),
  ]);
  assert.deepEqual(
    race.map((entry) => entry.response.status).sort(),
    [201, 409]
  );
  const successfulFinal = race.find((entry) => entry.response.status === 201);
  assert.ok(successfulFinal);
  assert.equal(successfulFinal.data.purchaseOrder.status, "received");
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 51_000_000n);

  const receivedLineRows = await db.$queryRawUnsafe<ExactLineRow[]>(
    `SELECT "id", "orderedPurchaseQuantityMicros", "orderedBaseQuantityMicros",
       "receivedBaseQuantityMicros", "purchaseUnitCostMicros",
       "baseUnitCostMicros", "lineTotalMinor"
     FROM "PurchaseOrderLine" WHERE "id" = $1`,
    purchaseOrderLineId
  );
  assert.equal(receivedLineRows[0].receivedBaseQuantityMicros, 50_000_000n);

  console.log("\n[p1-purchasing] receipt corrections preserve both ledgers");
  const genericReverse = await api<any>("/api/inventory/movements", {
    method: "POST",
    headers: {
      cookie: adminCookie,
      "idempotency-key": key("p1-generic-purchase-reversal"),
    },
    body: JSON.stringify({
      action: "reverse",
      movementId: firstReceipt.data.receipt.lines[0].stockMovementId,
      reasonCode: "manager_correction",
      reason: "Generic reversal must be redirected to Purchasing",
    }),
  });
  assertStatus(genericReverse.response, 409, "Block generic receipt reversal");
  assert.equal(genericReverse.data.code, "PURCHASE_RECEIPT_REVERSAL_REQUIRED");

  const correctionKey = key("p1-purchase-receipt-correction");
  const correctionBody = {
    action: "reverse",
    receiptId: firstReceipt.data.receipt.id,
    reason: "Supplier delivery was recorded against the wrong document",
  };
  const correction = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": correctionKey },
      body: JSON.stringify(correctionBody),
    }
  );
  assertStatus(correction.response, 201, "Reverse posted purchase receipt");
  assert.equal(correction.data.receipt.status, "reversed");
  assert.equal(correction.data.purchaseOrder.status, "partially_received");
  assert.ok(correction.data.receipt.lines[0].reversalMovementId);
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 38_500_000n);

  const correctionReplay = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": correctionKey },
      body: JSON.stringify(correctionBody),
    }
  );
  assertStatus(correctionReplay.response, 200, "Receipt correction replay");
  assert.equal(correctionReplay.data.replayed, true);
  assert.equal((await exactIngredient(ingredient.id)).quantityMicros, 38_500_000n);

  const duplicateCorrection = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/receipts`,
    {
      method: "POST",
      headers: { cookie: adminCookie, "idempotency-key": key("p1-second-correction") },
      body: JSON.stringify(correctionBody),
    }
  );
  assertStatus(duplicateCorrection.response, 409, "Reject second correction");
  assert.equal(duplicateCorrection.data.code, "PURCHASE_RECEIPT_ALREADY_REVERSED");

  console.log("\n[p1-purchasing] cancellation and inactive supplier policy");
  const cancellable = await createPurchaseOrder(
    adminCookie,
    supplier.id,
    ingredient.id,
    key("p1-cancellable-order")
  );
  assertStatus(cancellable.result.response, 201, "Create cancellable draft");
  const cancel = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(cancellable.result.data.purchaseOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ action: "cancel", reason: "Integration cancellation" }),
    }
  );
  assertStatus(cancel.response, 200, "Cancel draft purchase order");
  assert.equal(cancel.data.purchaseOrder.status, "cancelled");
  const cancelReplay = await api<any>(
    `/api/purchase-orders/${encodeURIComponent(cancellable.result.data.purchaseOrder.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ action: "cancel", reason: "Integration cancellation" }),
    }
  );
  assertStatus(cancelReplay.response, 200, "Cancellation replay");
  assert.equal(cancelReplay.data.replayed, true);

  const deactivate = await api<any>("/api/suppliers", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ id: supplier.id, status: "inactive" }),
  });
  assertStatus(deactivate.response, 200, "Deactivate supplier");
  const inactiveOrder = await createPurchaseOrder(
    adminCookie,
    supplier.id,
    ingredient.id,
    key("p1-inactive-supplier-order")
  );
  assertStatus(inactiveOrder.result.response, 409, "Reject inactive supplier order");
  assert.equal(inactiveOrder.result.data.code, "SUPPLIER_INACTIVE");

  console.log("\n[p1-purchasing] database immutability and audit coverage");
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "PurchaseOrder" SET "notes" = $1 WHERE "id" = $2',
        "tampered commercial terms",
        purchaseOrder.id
      ),
    "Submitted purchase-order headers must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "PurchaseOrderLine" SET "lineTotalMinor" = 1 WHERE "id" = $1',
        purchaseOrderLineId
      ),
    "Submitted purchase-order lines must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'UPDATE "PurchaseReceipt" SET "notes" = $1 WHERE "id" = $2',
        "tampered receipt",
        successfulFinal.data.receipt.id
      ),
    "Purchase receipts must be immutable"
  );
  await expectDatabaseFailure(
    () =>
      db.$executeRawUnsafe(
        'DELETE FROM "PurchaseReceiptLine" WHERE "receiptId" = $1',
        successfulFinal.data.receipt.id
      ),
    "Purchase receipt lines cannot be deleted"
  );

  const receiptMovementCounts = await db.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::integer AS "count"
     FROM "StockMovement"
     WHERE "sourceType" IN ('PurchaseReceipt', 'PurchaseReceiptReversal')
       AND "ingredientId" = $1`,
    ingredient.id
  );
  assert.equal(receiptMovementCounts[0].count, 3);

  const auditRows = await db.auditEvent.groupBy({
    by: ["action"],
    where: {
      action: {
        in: [
          "purchasing.supplier.create",
          "purchasing.supplier.update",
          "purchasing.purchase_order.create",
          "purchasing.purchase_order.submit",
          "purchasing.purchase_order.cancel",
          "purchasing.receipt.post",
          "purchasing.receipt.reverse",
        ],
      },
    },
    _count: { _all: true },
  });
  const auditActions = new Set(auditRows.map((entry) => entry.action));
  for (const action of [
    "purchasing.supplier.create",
    "purchasing.supplier.update",
    "purchasing.purchase_order.create",
    "purchasing.purchase_order.submit",
    "purchasing.purchase_order.cancel",
    "purchasing.receipt.post",
    "purchasing.receipt.reverse",
  ]) {
    assert.ok(auditActions.has(action), `Missing purchasing audit action ${action}`);
  }

  console.log("\n[p1-purchasing] Purchase-order and receiving assertions passed.");
}

main()
  .catch((error) => {
    console.error("\n[p1-purchasing] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
