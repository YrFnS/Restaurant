import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  divideAndRoundHalfUp,
  parseNonNegativeDecimalToScaledInteger,
  UNIT_COST_MICRO_DIGITS,
} from "@/lib/money/scaled-integer";
import {
  createStockMovement,
  INVENTORY_QUANTITY_SCALE,
  InventoryLedgerError,
  normalizeInventoryUnit,
  parseQuantityInputToMicros,
  readStockMovement,
  type InventoryActor,
  type StockMovementRow,
} from "@/lib/inventory/stock-ledger";

const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);
const PURCHASE_TOTAL_DENOMINATOR = BigInt(10_000_000_000);

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "cancelled",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type SupplierStatus = "active" | "inactive";
export type PurchaseReceiptStatus = "posted" | "reversed";

export type PurchasingSqlClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

export class PurchasingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "PurchasingError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  notes: string | null;
  status: SupplierStatus;
  createdAt: Date;
  updatedAt: Date;
};

type PurchaseOrderHeaderRow = {
  id: string;
  orderNumber: string;
  creationKey: string;
  supplierId: string;
  supplierCode: string;
  supplier: string;
  supplierStatus: SupplierStatus;
  currency: string;
  notes: string | null;
  status: PurchaseOrderStatus;
  totalCostMinor: bigint;
  expectedAt: Date | null;
  createdById: string | null;
  createdByName: string;
  submittedById: string | null;
  submittedByName: string | null;
  submittedAt: Date | null;
  cancelledById: string | null;
  cancelledByName: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  legacyImported: boolean;
  lineCount: number;
  completedLineCount: number;
  receiptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type PurchaseOrderLineRow = {
  id: string;
  purchaseOrderId: string;
  lineNumber: number;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionToBaseMicros: bigint;
  orderedPurchaseQuantityMicros: bigint;
  orderedBaseQuantityMicros: bigint;
  receivedBaseQuantityMicros: bigint;
  purchaseUnitCostMicros: bigint;
  baseUnitCostMicros: bigint;
  lineTotalMinor: bigint;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PurchaseReceiptRow = {
  id: string;
  receiptNumber: string;
  idempotencyKey: string;
  reversalKey: string | null;
  purchaseOrderId: string;
  orderNumber: string;
  supplier: string;
  supplierCode: string;
  currency: string;
  status: PurchaseReceiptStatus;
  totalCostMinor: bigint;
  notes: string | null;
  receivedById: string;
  receivedByName: string;
  occurredAt: Date;
  reversedById: string | null;
  reversedByName: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  lineCount: number;
  createdAt: Date;
};

type PurchaseReceiptLineRow = {
  id: string;
  receiptId: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  ingredientId: string;
  ingredientName: string;
  submittedUnit: string;
  submittedQuantityMicros: bigint;
  conversionToBaseMicros: bigint;
  baseQuantityMicros: bigint;
  purchaseUnitCostMicros: bigint;
  baseUnitCostMicros: bigint;
  totalCostMinor: bigint;
  stockMovementId: string;
  reversalMovementId: string | null;
  createdAt: Date;
};

type PurchaseOrderResult = PurchaseOrderHeaderRow & {
  lines: PurchaseOrderLineRow[];
  receipts: PurchaseReceiptRow[];
};

type PurchaseReceiptResult = PurchaseReceiptRow & {
  lines: PurchaseReceiptLineRow[];
};

type DraftLineInput = {
  ingredientId: string;
  quantity: number;
  unit: string;
  unitCost: number;
  notes?: string | null;
};

type DraftOrderInput = {
  supplierId: string;
  currency?: string;
  notes?: string | null;
  expectedAt?: Date | null;
  lines: DraftLineInput[];
};

type PreparedLine = {
  id: string;
  lineNumber: number;
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionToBaseMicros: bigint;
  orderedPurchaseQuantityMicros: bigint;
  orderedBaseQuantityMicros: bigint;
  purchaseUnitCostMicros: bigint;
  baseUnitCostMicros: bigint;
  lineTotalMinor: bigint;
  notes: string | null;
};

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function boundedText(value: string | null | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

function normalizeSupplierCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!normalized) {
    throw new PurchasingError(
      "A valid supplier code is required",
      "INVALID_SUPPLIER_CODE",
      400
    );
  }
  return normalized;
}

function generatedSupplierCode(name: string): string {
  const prefix = normalizeSupplierCode(name).slice(0, 24) || "SUPPLIER";
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function normalizedCurrency(value: string | undefined): string {
  const currency = (value || "USD").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(currency)) {
    throw new PurchasingError(
      "A valid currency code is required",
      "INVALID_PURCHASE_CURRENCY",
      400
    );
  }
  return currency;
}

function costMicros(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PurchasingError(
      "Purchase unit cost must be greater than zero",
      "INVALID_PURCHASE_UNIT_COST",
      400
    );
  }
  try {
    const result = parseNonNegativeDecimalToScaledInteger(
      String(value),
      UNIT_COST_MICRO_DIGITS,
      MAX_SAFE_SCALED
    );
    if (result <= 0) throw new Error("zero");
    return result;
  } catch {
    throw new PurchasingError(
      "Purchase unit cost is outside the supported range",
      "INVALID_PURCHASE_UNIT_COST",
      400
    );
  }
}

function microsToNumber(value: bigint): number {
  if (value < 0 || value > MAX_SAFE_SCALED) {
    throw new PurchasingError(
      "Stored purchase quantity cannot be represented safely",
      "UNSAFE_PURCHASE_QUANTITY",
      500
    );
  }
  return Number(value) / 1_000_000;
}

function minorToNumber(value: bigint): number {
  if (value < 0 || value > MAX_SAFE_SCALED) {
    throw new PurchasingError(
      "Stored purchase total cannot be represented safely",
      "UNSAFE_PURCHASE_TOTAL",
      500
    );
  }
  return Number(value) / 100;
}

function purchaseQuantityFromBase(
  baseQuantityMicros: bigint,
  conversionToBaseMicros: bigint
): number {
  return microsToNumber(
    divideAndRoundHalfUp(
      baseQuantityMicros * INVENTORY_QUANTITY_SCALE,
      conversionToBaseMicros
    )
  );
}

async function lockKey(
  client: PurchasingSqlClient,
  namespace: string,
  key: string
): Promise<void> {
  await client.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
    WITH purchase_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${namespace}:${key}`}, 0)
      )
    )
    SELECT 1::integer AS "locked"
    FROM purchase_lock
  `);
}

async function enableReceiptWrite(client: PurchasingSqlClient): Promise<void> {
  await client.$queryRaw<Array<{ configured: string }>>(Prisma.sql`
    SELECT set_config('app.purchase_receipt_write', 'on', true) AS "configured"
  `);
}

function serializeSupplier(row: SupplierRow) {
  return { ...row };
}

function serializePurchaseLine(row: PurchaseOrderLineRow) {
  const remainingBaseQuantityMicros =
    row.orderedBaseQuantityMicros - row.receivedBaseQuantityMicros;
  return {
    id: row.id,
    lineNumber: row.lineNumber,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    baseUnit: row.baseUnit,
    purchaseUnit: row.purchaseUnit,
    conversionToBaseQuantity: microsToNumber(row.conversionToBaseMicros),
    orderedQuantity: microsToNumber(row.orderedPurchaseQuantityMicros),
    orderedBaseQuantity: microsToNumber(row.orderedBaseQuantityMicros),
    receivedQuantity: purchaseQuantityFromBase(
      row.receivedBaseQuantityMicros,
      row.conversionToBaseMicros
    ),
    receivedBaseQuantity: microsToNumber(row.receivedBaseQuantityMicros),
    remainingQuantity: purchaseQuantityFromBase(
      remainingBaseQuantityMicros,
      row.conversionToBaseMicros
    ),
    remainingBaseQuantity: microsToNumber(remainingBaseQuantityMicros),
    unitCost: microsToNumber(row.purchaseUnitCostMicros),
    baseUnitCost: microsToNumber(row.baseUnitCostMicros),
    lineTotal: minorToNumber(row.lineTotalMinor),
    notes: row.notes,
    isComplete: row.receivedBaseQuantityMicros === row.orderedBaseQuantityMicros,
  };
}

function serializeReceiptLine(row: PurchaseReceiptLineRow) {
  return {
    id: row.id,
    purchaseOrderLineId: row.purchaseOrderLineId,
    lineNumber: row.lineNumber,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    submittedUnit: row.submittedUnit,
    submittedQuantity: microsToNumber(row.submittedQuantityMicros),
    conversionToBaseQuantity: microsToNumber(row.conversionToBaseMicros),
    baseQuantity: microsToNumber(row.baseQuantityMicros),
    unitCost: microsToNumber(row.purchaseUnitCostMicros),
    baseUnitCost: microsToNumber(row.baseUnitCostMicros),
    totalCost: minorToNumber(row.totalCostMinor),
    stockMovementId: row.stockMovementId,
    reversalMovementId: row.reversalMovementId,
  };
}

function serializeReceipt(row: PurchaseReceiptResult | PurchaseReceiptRow) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    purchaseOrderId: row.purchaseOrderId,
    orderNumber: row.orderNumber,
    supplier: row.supplier,
    supplierCode: row.supplierCode,
    currency: row.currency,
    status: row.status,
    totalCost: minorToNumber(row.totalCostMinor),
    notes: row.notes,
    receivedById: row.receivedById,
    receivedByName: row.receivedByName,
    occurredAt: row.occurredAt,
    reversedById: row.reversedById,
    reversedByName: row.reversedByName,
    reversedAt: row.reversedAt,
    reversalReason: row.reversalReason,
    lineCount: row.lineCount,
    createdAt: row.createdAt,
    lines: "lines" in row ? row.lines.map(serializeReceiptLine) : [],
  };
}

function serializePurchaseOrder(row: PurchaseOrderResult) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    supplierId: row.supplierId,
    supplierCode: row.supplierCode,
    supplier: row.supplier,
    supplierStatus: row.supplierStatus,
    currency: row.currency,
    notes: row.notes,
    status: row.status,
    totalCost: minorToNumber(row.totalCostMinor),
    expectedAt: row.expectedAt,
    createdById: row.createdById,
    createdByName: row.createdByName,
    submittedById: row.submittedById,
    submittedByName: row.submittedByName,
    submittedAt: row.submittedAt,
    cancelledById: row.cancelledById,
    cancelledByName: row.cancelledByName,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    legacyImported: row.legacyImported,
    lineCount: row.lineCount,
    completedLineCount: row.completedLineCount,
    receiptCount: row.receiptCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map(serializePurchaseLine),
    receipts: row.receipts.map((receipt) => serializeReceipt(receipt)),
  };
}

async function readSupplier(
  client: PurchasingSqlClient,
  supplierId: string,
  lock = false
): Promise<SupplierRow | null> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes", "status"::text AS "status",
      "createdAt", "updatedAt"
    FROM "Supplier"
    WHERE "id" = ${supplierId}
    LIMIT 1
    ${lockSql}
  `);
  return rows[0] ?? null;
}

export async function listSuppliers(client: PurchasingSqlClient) {
  const rows = await client.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes", "status"::text AS "status",
      "createdAt", "updatedAt"
    FROM "Supplier"
    ORDER BY "status" ASC, "name" ASC, "id" ASC
  `);
  return rows.map(serializeSupplier);
}

export async function createSupplier(
  client: PurchasingSqlClient,
  input: {
    code?: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    notes?: string | null;
  }
) {
  const name = boundedText(input.name, 240);
  if (!name) {
    throw new PurchasingError("Supplier name is required", "INVALID_SUPPLIER", 400);
  }
  const code = input.code
    ? normalizeSupplierCode(input.code)
    : generatedSupplierCode(name);
  await lockKey(client, "supplier-code", code);

  const existing = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Supplier" WHERE "code" = ${code} LIMIT 1
  `);
  if (existing[0]) {
    throw new PurchasingError(
      "Supplier code is already in use",
      "SUPPLIER_CODE_EXISTS",
      409
    );
  }

  const id = newId("supplier");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "Supplier" (
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes"
    ) VALUES (
      ${id}, ${code}, ${name}, ${boundedText(input.contactName, 160)},
      ${boundedText(input.phone, 80)}, ${boundedText(input.email, 254)},
      ${boundedText(input.address, 1000)}, ${boundedText(input.paymentTerms, 500)},
      ${input.notes ? boundedText(input.notes, 2000) : null}
    )
  `);
  const saved = await readSupplier(client, id);
  if (!saved) {
    throw new PurchasingError(
      "Unable to load created supplier",
      "SUPPLIER_RESULT_MISSING",
      500
    );
  }
  return serializeSupplier(saved);
}

export async function updateSupplier(
  client: PurchasingSqlClient,
  input: {
    id: string;
    code?: string;
    name?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    notes?: string | null;
    status?: SupplierStatus;
  }
) {
  const current = await readSupplier(client, input.id, true);
  if (!current) {
    throw new PurchasingError("Supplier not found", "SUPPLIER_NOT_FOUND", 404);
  }
  const code = input.code ? normalizeSupplierCode(input.code) : current.code;
  if (code !== current.code) {
    await lockKey(client, "supplier-code", code);
    const duplicate = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "Supplier" WHERE "code" = ${code} AND "id" <> ${current.id} LIMIT 1
    `);
    if (duplicate[0]) {
      throw new PurchasingError(
        "Supplier code is already in use",
        "SUPPLIER_CODE_EXISTS",
        409
      );
    }
  }
  const name = input.name === undefined ? current.name : boundedText(input.name, 240);
  if (!name) {
    throw new PurchasingError("Supplier name is required", "INVALID_SUPPLIER", 400);
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "Supplier"
    SET
      "code" = ${code},
      "name" = ${name},
      "contactName" = ${input.contactName === undefined ? current.contactName : boundedText(input.contactName, 160)},
      "phone" = ${input.phone === undefined ? current.phone : boundedText(input.phone, 80)},
      "email" = ${input.email === undefined ? current.email : boundedText(input.email, 254)},
      "address" = ${input.address === undefined ? current.address : boundedText(input.address, 1000)},
      "paymentTerms" = ${input.paymentTerms === undefined ? current.paymentTerms : boundedText(input.paymentTerms, 500)},
      "notes" = ${input.notes === undefined ? current.notes : input.notes ? boundedText(input.notes, 2000) : null},
      "status" = CAST(${input.status || current.status} AS "SupplierStatus"),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${current.id}
  `);
  const saved = await readSupplier(client, current.id);
  if (!saved) {
    throw new PurchasingError(
      "Unable to load updated supplier",
      "SUPPLIER_RESULT_MISSING",
      500
    );
  }
  return serializeSupplier(saved);
}

async function readPurchaseOrderLines(
  client: PurchasingSqlClient,
  orderIds: string[]
): Promise<PurchaseOrderLineRow[]> {
  if (orderIds.length === 0) return [];
  return client.$queryRaw<PurchaseOrderLineRow[]>(Prisma.sql`
    SELECT
      "id", "purchaseOrderId", "lineNumber", "ingredientId",
      "ingredientName", "baseUnit", "purchaseUnit", "conversionToBaseMicros",
      "orderedPurchaseQuantityMicros", "orderedBaseQuantityMicros",
      "receivedBaseQuantityMicros", "purchaseUnitCostMicros",
      "baseUnitCostMicros", "lineTotalMinor", "notes", "createdAt", "updatedAt"
    FROM "PurchaseOrderLine"
    WHERE "purchaseOrderId" IN (${Prisma.join(orderIds)})
    ORDER BY "purchaseOrderId" ASC, "lineNumber" ASC, "id" ASC
  `);
}

export async function readPurchaseReceipts(
  client: PurchasingSqlClient,
  options: {
    purchaseOrderId?: string;
    purchaseOrderIds?: string[];
    receiptId?: string;
    includeLines?: boolean;
    limit?: number;
  } = {}
): Promise<PurchaseReceiptResult[]> {
  const filters: Prisma.Sql[] = [];
  if (options.purchaseOrderId) {
    filters.push(Prisma.sql`receipt."purchaseOrderId" = ${options.purchaseOrderId}`);
  }
  if (options.purchaseOrderIds?.length) {
    filters.push(
      Prisma.sql`receipt."purchaseOrderId" IN (${Prisma.join(options.purchaseOrderIds)})`
    );
  }
  if (options.receiptId) {
    filters.push(Prisma.sql`receipt."id" = ${options.receiptId}`);
  }
  const where = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;
  const limit = Math.max(1, Math.min(options.limit || 200, 500));

  const headers = await client.$queryRaw<PurchaseReceiptRow[]>(Prisma.sql`
    SELECT
      receipt."id", receipt."receiptNumber", receipt."idempotencyKey",
      receipt."reversalKey", receipt."purchaseOrderId",
      purchase_order."orderNumber", purchase_order."supplier",
      purchase_order."supplierCode", purchase_order."currency",
      receipt."status"::text AS "status", receipt."totalCostMinor",
      receipt."notes", receipt."receivedById", receipt."receivedByName",
      receipt."occurredAt", receipt."reversedById", receipt."reversedByName",
      receipt."reversedAt", receipt."reversalReason", receipt."createdAt",
      COUNT(line."id")::integer AS "lineCount"
    FROM "PurchaseReceipt" AS receipt
    JOIN "PurchaseOrder" AS purchase_order
      ON purchase_order."id" = receipt."purchaseOrderId"
    LEFT JOIN "PurchaseReceiptLine" AS line
      ON line."receiptId" = receipt."id"
    ${where}
    GROUP BY receipt."id", purchase_order."id"
    ORDER BY receipt."createdAt" DESC, receipt."id" DESC
    LIMIT ${limit}
  `);

  const byReceipt = new Map<string, PurchaseReceiptLineRow[]>();
  if (options.includeLines !== false && headers.length > 0) {
    const lines = await client.$queryRaw<PurchaseReceiptLineRow[]>(Prisma.sql`
      SELECT
        line."id", line."receiptId", line."purchaseOrderLineId",
        purchase_line."lineNumber", line."ingredientId", line."ingredientName",
        line."submittedUnit", line."submittedQuantityMicros",
        line."conversionToBaseMicros", line."baseQuantityMicros",
        line."purchaseUnitCostMicros", line."baseUnitCostMicros",
        line."totalCostMinor", line."stockMovementId",
        line."reversalMovementId", line."createdAt"
      FROM "PurchaseReceiptLine" AS line
      JOIN "PurchaseOrderLine" AS purchase_line
        ON purchase_line."id" = line."purchaseOrderLineId"
      WHERE line."receiptId" IN (${Prisma.join(headers.map((entry) => entry.id))})
      ORDER BY line."receiptId" ASC, purchase_line."lineNumber" ASC
    `);
    for (const line of lines) {
      const bucket = byReceipt.get(line.receiptId) || [];
      bucket.push(line);
      byReceipt.set(line.receiptId, bucket);
    }
  }

  return headers.map((header) => ({
    ...header,
    lines: byReceipt.get(header.id) || [],
  }));
}

export async function readPurchaseOrders(
  client: PurchasingSqlClient,
  options: {
    id?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    limit?: number;
  } = {}
) {
  const filters: Prisma.Sql[] = [];
  if (options.id) filters.push(Prisma.sql`purchase_order."id" = ${options.id}`);
  if (options.supplierId) {
    filters.push(Prisma.sql`purchase_order."supplierId" = ${options.supplierId}`);
  }
  if (options.status) {
    filters.push(
      Prisma.sql`purchase_order."status" = CAST(${options.status} AS "PurchaseOrderStatus")`
    );
  }
  const where = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;
  const limit = Math.max(1, Math.min(options.limit || 100, 300));

  const headers = await client.$queryRaw<PurchaseOrderHeaderRow[]>(Prisma.sql`
    SELECT
      purchase_order."id", purchase_order."orderNumber",
      purchase_order."creationKey", purchase_order."supplierId",
      purchase_order."supplierCode", purchase_order."supplier",
      supplier."status"::text AS "supplierStatus", purchase_order."currency",
      purchase_order."notes", purchase_order."status"::text AS "status",
      purchase_order."totalCostMinor", purchase_order."expectedAt",
      purchase_order."createdById", purchase_order."createdByName",
      purchase_order."submittedById", purchase_order."submittedByName",
      purchase_order."submittedAt", purchase_order."cancelledById",
      purchase_order."cancelledByName", purchase_order."cancelledAt",
      purchase_order."cancellationReason", purchase_order."legacyImported",
      purchase_order."createdAt", purchase_order."updatedAt",
      COUNT(line."id")::integer AS "lineCount",
      COUNT(line."id") FILTER (
        WHERE line."receivedBaseQuantityMicros" = line."orderedBaseQuantityMicros"
      )::integer AS "completedLineCount",
      (
        SELECT COUNT(*)::integer
        FROM "PurchaseReceipt" AS receipt
        WHERE receipt."purchaseOrderId" = purchase_order."id"
          AND receipt."status" = 'posted'
      ) AS "receiptCount"
    FROM "PurchaseOrder" AS purchase_order
    JOIN "Supplier" AS supplier ON supplier."id" = purchase_order."supplierId"
    LEFT JOIN "PurchaseOrderLine" AS line
      ON line."purchaseOrderId" = purchase_order."id"
    ${where}
    GROUP BY purchase_order."id", supplier."id"
    ORDER BY purchase_order."createdAt" DESC, purchase_order."id" DESC
    LIMIT ${limit}
  `);

  const ids = headers.map((entry) => entry.id);
  const [lines, receipts] = await Promise.all([
    readPurchaseOrderLines(client, ids),
    readPurchaseReceipts(client, {
      purchaseOrderIds: ids,
      includeLines: false,
      limit: 500,
    }),
  ]);
  const linesByOrder = new Map<string, PurchaseOrderLineRow[]>();
  for (const line of lines) {
    const bucket = linesByOrder.get(line.purchaseOrderId) || [];
    bucket.push(line);
    linesByOrder.set(line.purchaseOrderId, bucket);
  }
  const receiptsByOrder = new Map<string, PurchaseReceiptRow[]>();
  for (const receipt of receipts) {
    const bucket = receiptsByOrder.get(receipt.purchaseOrderId) || [];
    bucket.push(receipt);
    receiptsByOrder.set(receipt.purchaseOrderId, bucket);
  }

  return headers.map((header) =>
    serializePurchaseOrder({
      ...header,
      lines: linesByOrder.get(header.id) || [],
      receipts: receiptsByOrder.get(header.id) || [],
    })
  );
}

async function prepareDraftLines(
  client: PurchasingSqlClient,
  inputs: DraftLineInput[]
): Promise<PreparedLine[]> {
  if (inputs.length === 0 || inputs.length > 200) {
    throw new PurchasingError(
      "A purchase order requires between 1 and 200 lines",
      "INVALID_PURCHASE_ORDER_LINES",
      400
    );
  }

  const duplicate = new Set<string>();
  const result: PreparedLine[] = [];
  for (const [index, input] of inputs.entries()) {
    const ingredientRows = await client.$queryRaw<
      Array<{ id: string; name: string; unit: string }>
    >(Prisma.sql`
      SELECT "id", "name", "unit"
      FROM "Ingredient"
      WHERE "id" = ${input.ingredientId}
      LIMIT 1
    `);
    const ingredient = ingredientRows[0];
    if (!ingredient) {
      throw new PurchasingError(
        "Purchase-order ingredient not found",
        "INGREDIENT_NOT_FOUND",
        404,
        { ingredientId: input.ingredientId }
      );
    }

    const purchaseUnit = normalizeInventoryUnit(input.unit);
    const baseUnit = normalizeInventoryUnit(ingredient.unit);
    let conversionToBaseMicros = INVENTORY_QUANTITY_SCALE;
    if (purchaseUnit !== baseUnit) {
      const conversionRows = await client.$queryRaw<Array<{ toBaseMicros: bigint }>>(
        Prisma.sql`
          SELECT "toBaseMicros"
          FROM "IngredientUnitConversion"
          WHERE "ingredientId" = ${ingredient.id} AND "unit" = ${purchaseUnit}
          LIMIT 1
        `
      );
      if (!conversionRows[0]) {
        throw new PurchasingError(
          `No ${purchaseUnit} conversion is configured for ${ingredient.name}`,
          "UNIT_CONVERSION_NOT_FOUND",
          409,
          { ingredientId: ingredient.id, unit: purchaseUnit, baseUnit }
        );
      }
      conversionToBaseMicros = conversionRows[0].toBaseMicros;
    }

    const duplicateKey = `${ingredient.id}:${purchaseUnit}`;
    if (duplicate.has(duplicateKey)) {
      throw new PurchasingError(
        "The same ingredient and purchasing unit cannot appear twice",
        "DUPLICATE_PURCHASE_ORDER_LINE",
        400
      );
    }
    duplicate.add(duplicateKey);

    const orderedPurchaseQuantityMicros = parseQuantityInputToMicros(input.quantity);
    const orderedBaseQuantityMicros = divideAndRoundHalfUp(
      orderedPurchaseQuantityMicros * conversionToBaseMicros,
      INVENTORY_QUANTITY_SCALE
    );
    const purchaseUnitCostMicros = costMicros(input.unitCost);
    const baseUnitCostMicros = divideAndRoundHalfUp(
      purchaseUnitCostMicros * INVENTORY_QUANTITY_SCALE,
      conversionToBaseMicros
    );
    const lineTotalMinor = divideAndRoundHalfUp(
      orderedPurchaseQuantityMicros * purchaseUnitCostMicros,
      PURCHASE_TOTAL_DENOMINATOR
    );
    if (orderedBaseQuantityMicros <= 0 || baseUnitCostMicros <= 0 || lineTotalMinor <= 0) {
      throw new PurchasingError(
        "Purchase-order quantity or cost is too small",
        "PURCHASE_ORDER_LINE_TOO_SMALL",
        400
      );
    }

    result.push({
      id: newId("purchase_order_line"),
      lineNumber: index + 1,
      ingredientId: ingredient.id,
      ingredientName: boundedText(ingredient.name, 240),
      baseUnit,
      purchaseUnit,
      conversionToBaseMicros,
      orderedPurchaseQuantityMicros,
      orderedBaseQuantityMicros,
      purchaseUnitCostMicros,
      baseUnitCostMicros,
      lineTotalMinor,
      notes: input.notes ? boundedText(input.notes, 2000) : null,
    });
  }
  return result;
}

async function insertDraftLines(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  lines: PreparedLine[]
): Promise<void> {
  for (const line of lines) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "PurchaseOrderLine" (
        "id", "purchaseOrderId", "lineNumber", "ingredientId",
        "ingredientName", "baseUnit", "purchaseUnit", "conversionToBaseMicros",
        "orderedPurchaseQuantityMicros", "orderedBaseQuantityMicros",
        "purchaseUnitCostMicros", "baseUnitCostMicros", "lineTotalMinor", "notes"
      ) VALUES (
        ${line.id}, ${purchaseOrderId}, ${line.lineNumber}, ${line.ingredientId},
        ${line.ingredientName}, ${line.baseUnit}, ${line.purchaseUnit},
        ${line.conversionToBaseMicros}, ${line.orderedPurchaseQuantityMicros},
        ${line.orderedBaseQuantityMicros}, ${line.purchaseUnitCostMicros},
        ${line.baseUnitCostMicros}, ${line.lineTotalMinor}, ${line.notes}
      )
    `);
  }
}

function purchaseOrderNumber(): string {
  const date = new Date();
  const stamp = `${String(date.getUTCFullYear()).slice(-2)}${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `PO-${stamp}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function purchaseReceiptNumber(): string {
  const date = new Date();
  const stamp = `${String(date.getUTCFullYear()).slice(-2)}${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `PR-${stamp}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export async function createPurchaseOrder(
  client: PurchasingSqlClient,
  input: DraftOrderInput & {
    creationKey: string;
    actor: InventoryActor;
  }
): Promise<{ order: ReturnType<typeof serializePurchaseOrder>; replayed: boolean }> {
  const key = boundedText(input.creationKey, 191);
  if (key.length < 16) {
    throw new PurchasingError(
      "A valid purchase-order idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  await lockKey(client, "purchase-order", key);
  const replay = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "PurchaseOrder" WHERE "creationKey" = ${key} LIMIT 1
  `);
  if (replay[0]) {
    const orders = await readPurchaseOrders(client, { id: replay[0].id });
    if (!orders[0]) {
      throw new PurchasingError(
        "Purchase-order replay could not be loaded",
        "PURCHASE_ORDER_REPLAY_MISSING",
        500
      );
    }
    return { order: orders[0], replayed: true };
  }

  const supplier = await readSupplier(client, input.supplierId, true);
  if (!supplier) {
    throw new PurchasingError("Supplier not found", "SUPPLIER_NOT_FOUND", 404);
  }
  if (supplier.status !== "active") {
    throw new PurchasingError(
      "Inactive suppliers cannot receive new purchase orders",
      "SUPPLIER_INACTIVE",
      409
    );
  }
  const lines = await prepareDraftLines(client, input.lines);
  const id = newId("purchase_order");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "PurchaseOrder" (
      "id", "orderNumber", "creationKey", "supplierId", "supplierCode",
      "supplier", "currency", "notes", "status", "totalCost", "totalCostMinor",
      "expectedAt", "createdById", "createdByName", "legacyImported"
    ) VALUES (
      ${id}, ${purchaseOrderNumber()}, ${key}, ${supplier.id}, ${supplier.code},
      ${supplier.name}, ${normalizedCurrency(input.currency)},
      ${input.notes ? boundedText(input.notes, 4000) : null},
      'draft', 0, 0, ${input.expectedAt || null}, ${input.actor.id},
      ${boundedText(input.actor.name, 160)}, false
    )
  `);
  await insertDraftLines(client, id, lines);

  const orders = await readPurchaseOrders(client, { id });
  if (!orders[0]) {
    throw new PurchasingError(
      "Unable to load created purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return { order: orders[0], replayed: false };
}

export async function replaceDraftPurchaseOrder(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  input: DraftOrderInput
) {
  const rows = await client.$queryRaw<
    Array<{ id: string; status: PurchaseOrderStatus; legacyImported: boolean }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "legacyImported"
    FROM "PurchaseOrder"
    WHERE "id" = ${purchaseOrderId}
    FOR UPDATE
  `);
  const current = rows[0];
  if (!current) {
    throw new PurchasingError(
      "Purchase order not found",
      "PURCHASE_ORDER_NOT_FOUND",
      404
    );
  }
  if (current.status !== "draft" || current.legacyImported) {
    throw new PurchasingError(
      "Only non-legacy draft purchase orders can be edited",
      "PURCHASE_ORDER_NOT_EDITABLE",
      409
    );
  }

  const supplier = await readSupplier(client, input.supplierId, true);
  if (!supplier) {
    throw new PurchasingError("Supplier not found", "SUPPLIER_NOT_FOUND", 404);
  }
  if (supplier.status !== "active") {
    throw new PurchasingError(
      "Inactive suppliers cannot receive new purchase orders",
      "SUPPLIER_INACTIVE",
      409
    );
  }
  const lines = await prepareDraftLines(client, input.lines);

  await client.$executeRaw(Prisma.sql`
    DELETE FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${purchaseOrderId}
  `);
  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET
      "supplierId" = ${supplier.id},
      "supplierCode" = ${supplier.code},
      "supplier" = ${supplier.name},
      "currency" = ${normalizedCurrency(input.currency)},
      "notes" = ${input.notes ? boundedText(input.notes, 4000) : null},
      "expectedAt" = ${input.expectedAt || null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${purchaseOrderId}
  `);
  await insertDraftLines(client, purchaseOrderId, lines);

  const orders = await readPurchaseOrders(client, { id: purchaseOrderId });
  if (!orders[0]) {
    throw new PurchasingError(
      "Unable to load updated purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return orders[0];
}

export async function submitPurchaseOrder(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  actor: InventoryActor
): Promise<{ order: ReturnType<typeof serializePurchaseOrder>; replayed: boolean }> {
  const rows = await client.$queryRaw<
    Array<{ id: string; status: PurchaseOrderStatus; legacyImported: boolean }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "legacyImported"
    FROM "PurchaseOrder"
    WHERE "id" = ${purchaseOrderId}
    FOR UPDATE
  `);
  const current = rows[0];
  if (!current) {
    throw new PurchasingError(
      "Purchase order not found",
      "PURCHASE_ORDER_NOT_FOUND",
      404
    );
  }
  if (["submitted", "partially_received", "received"].includes(current.status)) {
    const orders = await readPurchaseOrders(client, { id: purchaseOrderId });
    return { order: orders[0], replayed: true };
  }
  if (current.status !== "draft" || current.legacyImported) {
    throw new PurchasingError(
      "This purchase order cannot be submitted",
      "INVALID_PURCHASE_ORDER_TRANSITION",
      409
    );
  }
  const counts = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "PurchaseOrderLine"
    WHERE "purchaseOrderId" = ${purchaseOrderId}
  `);
  if ((counts[0]?.count || 0) === 0) {
    throw new PurchasingError(
      "A purchase order requires at least one line before submission",
      "PURCHASE_ORDER_LINES_REQUIRED",
      409
    );
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET
      "status" = 'submitted',
      "submittedById" = ${actor.id},
      "submittedByName" = ${boundedText(actor.name, 160)},
      "submittedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${purchaseOrderId}
  `);
  const orders = await readPurchaseOrders(client, { id: purchaseOrderId });
  return { order: orders[0], replayed: false };
}

export async function cancelPurchaseOrder(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  input: { reason: string; actor: InventoryActor }
): Promise<{ order: ReturnType<typeof serializePurchaseOrder>; replayed: boolean }> {
  const rows = await client.$queryRaw<Array<{ status: PurchaseOrderStatus }>>(
    Prisma.sql`
      SELECT "status"::text AS "status"
      FROM "PurchaseOrder"
      WHERE "id" = ${purchaseOrderId}
      FOR UPDATE
    `
  );
  const current = rows[0];
  if (!current) {
    throw new PurchasingError(
      "Purchase order not found",
      "PURCHASE_ORDER_NOT_FOUND",
      404
    );
  }
  if (current.status === "cancelled") {
    const orders = await readPurchaseOrders(client, { id: purchaseOrderId });
    return { order: orders[0], replayed: true };
  }
  if (!["draft", "submitted"].includes(current.status)) {
    throw new PurchasingError(
      "Only an unreceived draft or submitted purchase order can be cancelled",
      "PURCHASE_ORDER_NOT_CANCELLABLE",
      409
    );
  }
  const reason = boundedText(input.reason, 2000);
  if (!reason) {
    throw new PurchasingError(
      "A cancellation reason is required",
      "CANCELLATION_REASON_REQUIRED",
      400
    );
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET
      "status" = 'cancelled',
      "cancelledById" = ${input.actor.id},
      "cancelledByName" = ${boundedText(input.actor.name, 160)},
      "cancelledAt" = CURRENT_TIMESTAMP,
      "cancellationReason" = ${reason},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${purchaseOrderId}
  `);
  const orders = await readPurchaseOrders(client, { id: purchaseOrderId });
  return { order: orders[0], replayed: false };
}

async function recalculatePurchaseOrderStatus(
  client: PurchasingSqlClient,
  purchaseOrderId: string
): Promise<PurchaseOrderStatus> {
  const rows = await client.$queryRaw<
    Array<{ total: number; complete: number; started: number }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::integer AS "total",
      COUNT(*) FILTER (
        WHERE "receivedBaseQuantityMicros" = "orderedBaseQuantityMicros"
      )::integer AS "complete",
      COUNT(*) FILTER (
        WHERE "receivedBaseQuantityMicros" > 0
      )::integer AS "started"
    FROM "PurchaseOrderLine"
    WHERE "purchaseOrderId" = ${purchaseOrderId}
  `);
  const state = rows[0];
  if (!state || state.total === 0) {
    throw new PurchasingError(
      "Purchase order has no lines",
      "PURCHASE_ORDER_LINES_REQUIRED",
      409
    );
  }
  const status: PurchaseOrderStatus =
    state.complete === state.total
      ? "received"
      : state.started > 0
        ? "partially_received"
        : "submitted";
  await enableReceiptWrite(client);
  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET "status" = CAST(${status} AS "PurchaseOrderStatus"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${purchaseOrderId}
  `);
  return status;
}

type ReceiptLineInput = {
  purchaseOrderLineId: string;
  quantity: number;
};

type PreparedReceiptLine = {
  id: string;
  purchaseOrderLineId: string;
  ingredientId: string;
  ingredientName: string;
  purchaseUnit: string;
  submittedQuantityMicros: bigint;
  conversionToBaseMicros: bigint;
  baseQuantityMicros: bigint;
  purchaseUnitCostMicros: bigint;
  baseUnitCostMicros: bigint;
  totalCostMinor: bigint;
  remainingBaseQuantityMicros: bigint;
};

async function prepareReceiptLines(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  inputs: ReceiptLineInput[]
): Promise<PreparedReceiptLine[]> {
  if (inputs.length === 0 || inputs.length > 200) {
    throw new PurchasingError(
      "A receipt requires between 1 and 200 lines",
      "INVALID_PURCHASE_RECEIPT_LINES",
      400
    );
  }
  const seen = new Set<string>();
  const prepared: PreparedReceiptLine[] = [];
  for (const input of inputs) {
    if (seen.has(input.purchaseOrderLineId)) {
      throw new PurchasingError(
        "A receipt cannot contain the same purchase-order line twice",
        "DUPLICATE_PURCHASE_RECEIPT_LINE",
        400
      );
    }
    seen.add(input.purchaseOrderLineId);

    const rows = await client.$queryRaw<PurchaseOrderLineRow[]>(Prisma.sql`
      SELECT
        "id", "purchaseOrderId", "lineNumber", "ingredientId",
        "ingredientName", "baseUnit", "purchaseUnit", "conversionToBaseMicros",
        "orderedPurchaseQuantityMicros", "orderedBaseQuantityMicros",
        "receivedBaseQuantityMicros", "purchaseUnitCostMicros",
        "baseUnitCostMicros", "lineTotalMinor", "notes", "createdAt", "updatedAt"
      FROM "PurchaseOrderLine"
      WHERE "id" = ${input.purchaseOrderLineId}
        AND "purchaseOrderId" = ${purchaseOrderId}
      FOR UPDATE
    `);
    const line = rows[0];
    if (!line) {
      throw new PurchasingError(
        "Purchase-order line not found",
        "PURCHASE_ORDER_LINE_NOT_FOUND",
        404,
        { purchaseOrderLineId: input.purchaseOrderLineId }
      );
    }
    const submittedQuantityMicros = parseQuantityInputToMicros(input.quantity);
    const baseQuantityMicros = divideAndRoundHalfUp(
      submittedQuantityMicros * line.conversionToBaseMicros,
      INVENTORY_QUANTITY_SCALE
    );
    const remainingBaseQuantityMicros =
      line.orderedBaseQuantityMicros - line.receivedBaseQuantityMicros;
    if (baseQuantityMicros > remainingBaseQuantityMicros) {
      throw new PurchasingError(
        "Receipt quantity exceeds the remaining purchase-order quantity",
        "PURCHASE_RECEIPT_OVER_QUANTITY",
        409,
        {
          purchaseOrderLineId: line.id,
          remainingQuantity: purchaseQuantityFromBase(
            remainingBaseQuantityMicros,
            line.conversionToBaseMicros
          ),
          purchaseUnit: line.purchaseUnit,
        }
      );
    }
    const totalCostMinor = divideAndRoundHalfUp(
      baseQuantityMicros * line.baseUnitCostMicros,
      PURCHASE_TOTAL_DENOMINATOR
    );
    if (baseQuantityMicros <= 0 || totalCostMinor <= 0) {
      throw new PurchasingError(
        "Receipt quantity or cost is too small",
        "PURCHASE_RECEIPT_LINE_TOO_SMALL",
        400
      );
    }
    prepared.push({
      id: newId("purchase_receipt_line"),
      purchaseOrderLineId: line.id,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      purchaseUnit: line.purchaseUnit,
      submittedQuantityMicros,
      conversionToBaseMicros: line.conversionToBaseMicros,
      baseQuantityMicros,
      purchaseUnitCostMicros: line.purchaseUnitCostMicros,
      baseUnitCostMicros: line.baseUnitCostMicros,
      totalCostMinor,
      remainingBaseQuantityMicros,
    });
  }
  return prepared;
}

export async function postPurchaseReceipt(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  input: {
    idempotencyKey: string;
    lines: ReceiptLineInput[];
    notes?: string | null;
    occurredAt?: Date;
    actor: InventoryActor;
  }
): Promise<{
  receipt: ReturnType<typeof serializeReceipt>;
  order: ReturnType<typeof serializePurchaseOrder>;
  replayed: boolean;
}> {
  const key = boundedText(input.idempotencyKey, 191);
  if (key.length < 16) {
    throw new PurchasingError(
      "A valid receipt idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  await lockKey(client, "purchase-receipt", key);
  const replayRows = await client.$queryRaw<Array<{ id: string; purchaseOrderId: string }>>(
    Prisma.sql`
      SELECT "id", "purchaseOrderId"
      FROM "PurchaseReceipt"
      WHERE "idempotencyKey" = ${key}
      LIMIT 1
    `
  );
  if (replayRows[0]) {
    if (replayRows[0].purchaseOrderId !== purchaseOrderId) {
      throw new PurchasingError(
        "Receipt idempotency key was used for another purchase order",
        "PURCHASE_RECEIPT_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    const [receipts, orders] = await Promise.all([
      readPurchaseReceipts(client, {
        receiptId: replayRows[0].id,
        includeLines: true,
      }),
      readPurchaseOrders(client, { id: purchaseOrderId }),
    ]);
    return {
      receipt: serializeReceipt(receipts[0]),
      order: orders[0],
      replayed: true,
    };
  }

  const orderRows = await client.$queryRaw<
    Array<{ id: string; status: PurchaseOrderStatus; orderNumber: string; legacyImported: boolean }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "orderNumber", "legacyImported"
    FROM "PurchaseOrder"
    WHERE "id" = ${purchaseOrderId}
    FOR UPDATE
  `);
  const order = orderRows[0];
  if (!order) {
    throw new PurchasingError(
      "Purchase order not found",
      "PURCHASE_ORDER_NOT_FOUND",
      404
    );
  }
  if (order.legacyImported || !["submitted", "partially_received"].includes(order.status)) {
    throw new PurchasingError(
      "Only a submitted line-based purchase order can be received",
      "PURCHASE_ORDER_NOT_RECEIVABLE",
      409
    );
  }

  const lines = await prepareReceiptLines(client, purchaseOrderId, input.lines);
  const totalCostMinor = lines.reduce((total, line) => total + line.totalCostMinor, 0n);
  const receiptId = newId("purchase_receipt");
  const receiptNumber = purchaseReceiptNumber();
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "PurchaseReceipt" (
      "id", "receiptNumber", "idempotencyKey", "purchaseOrderId",
      "status", "totalCostMinor", "notes", "receivedById",
      "receivedByName", "occurredAt"
    ) VALUES (
      ${receiptId}, ${receiptNumber}, ${key}, ${purchaseOrderId}, 'posted',
      ${totalCostMinor}, ${input.notes ? boundedText(input.notes, 4000) : null},
      ${input.actor.id}, ${boundedText(input.actor.name, 160)},
      ${input.occurredAt || new Date()}
    )
  `);

  await enableReceiptWrite(client);
  for (const line of lines) {
    const movement = await createStockMovement(client, {
      idempotencyKey: `purchase-receipt:${receiptId}:${line.id}`,
      ingredientId: line.ingredientId,
      movementType: "receipt",
      quantityDeltaMicros: line.baseQuantityMicros,
      unitCostMicros: line.baseUnitCostMicros,
      sourceType: "PurchaseReceipt",
      sourceId: receiptId,
      sourceLineId: line.id,
      reasonCode: "purchase_receipt",
      reason: `Receipt ${receiptNumber} for purchase order ${order.orderNumber}`,
      actor: input.actor,
      metadata: {
        purchaseOrderId,
        purchaseOrderNumber: order.orderNumber,
        purchaseOrderLineId: line.purchaseOrderLineId,
        receiptId,
        receiptNumber,
        submittedQuantityMicros: line.submittedQuantityMicros.toString(),
        submittedUnit: line.purchaseUnit,
        conversionToBaseMicros: line.conversionToBaseMicros.toString(),
      },
      occurredAt: input.occurredAt,
    });
    if (movement.movement.totalCostMinor !== line.totalCostMinor) {
      throw new PurchasingError(
        "Receipt cost snapshot does not match the stock ledger",
        "PURCHASE_RECEIPT_COST_MISMATCH",
        500
      );
    }

    await client.$executeRaw(Prisma.sql`
      INSERT INTO "PurchaseReceiptLine" (
        "id", "receiptId", "purchaseOrderLineId", "ingredientId",
        "ingredientName", "submittedUnit", "submittedQuantityMicros",
        "conversionToBaseMicros", "baseQuantityMicros",
        "purchaseUnitCostMicros", "baseUnitCostMicros", "totalCostMinor",
        "stockMovementId"
      ) VALUES (
        ${line.id}, ${receiptId}, ${line.purchaseOrderLineId}, ${line.ingredientId},
        ${line.ingredientName}, ${line.purchaseUnit}, ${line.submittedQuantityMicros},
        ${line.conversionToBaseMicros}, ${line.baseQuantityMicros},
        ${line.purchaseUnitCostMicros}, ${line.baseUnitCostMicros},
        ${line.totalCostMinor}, ${movement.movement.id}
      )
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseOrderLine"
      SET
        "receivedBaseQuantityMicros" = "receivedBaseQuantityMicros" + ${line.baseQuantityMicros},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${line.purchaseOrderLineId}
    `);
  }
  await recalculatePurchaseOrderStatus(client, purchaseOrderId);

  const [receipts, orders] = await Promise.all([
    readPurchaseReceipts(client, { receiptId, includeLines: true }),
    readPurchaseOrders(client, { id: purchaseOrderId }),
  ]);
  if (!receipts[0] || !orders[0]) {
    throw new PurchasingError(
      "Unable to load posted purchase receipt",
      "PURCHASE_RECEIPT_RESULT_MISSING",
      500
    );
  }
  return {
    receipt: serializeReceipt(receipts[0]),
    order: orders[0],
    replayed: false,
  };
}

export async function reversePurchaseReceipt(
  client: PurchasingSqlClient,
  purchaseOrderId: string,
  input: {
    receiptId: string;
    idempotencyKey: string;
    reason: string;
    actor: InventoryActor;
  }
): Promise<{
  receipt: ReturnType<typeof serializeReceipt>;
  order: ReturnType<typeof serializePurchaseOrder>;
  movements: StockMovementRow[];
  replayed: boolean;
}> {
  const key = boundedText(input.idempotencyKey, 191);
  const reason = boundedText(input.reason, 2000);
  if (key.length < 16 || !reason) {
    throw new PurchasingError(
      "A valid correction key and reason are required",
      "PURCHASE_RECEIPT_CORRECTION_REQUIRED",
      400
    );
  }
  await lockKey(client, "purchase-receipt-reversal", key);
  const receiptRows = await client.$queryRaw<
    Array<{
      id: string;
      purchaseOrderId: string;
      receiptNumber: string;
      status: PurchaseReceiptStatus;
      reversalKey: string | null;
    }>
  >(Prisma.sql`
    SELECT
      "id", "purchaseOrderId", "receiptNumber",
      "status"::text AS "status", "reversalKey"
    FROM "PurchaseReceipt"
    WHERE "id" = ${input.receiptId}
    FOR UPDATE
  `);
  const receipt = receiptRows[0];
  if (!receipt || receipt.purchaseOrderId !== purchaseOrderId) {
    throw new PurchasingError(
      "Purchase receipt not found",
      "PURCHASE_RECEIPT_NOT_FOUND",
      404
    );
  }
  if (receipt.status === "reversed") {
    if (receipt.reversalKey !== key) {
      throw new PurchasingError(
        "This receipt was already reversed by another correction",
        "PURCHASE_RECEIPT_ALREADY_REVERSED",
        409
      );
    }
    const [receipts, orders] = await Promise.all([
      readPurchaseReceipts(client, { receiptId: receipt.id, includeLines: true }),
      readPurchaseOrders(client, { id: purchaseOrderId }),
    ]);
    return {
      receipt: serializeReceipt(receipts[0]),
      order: orders[0],
      movements: [],
      replayed: true,
    };
  }

  const lines = await client.$queryRaw<PurchaseReceiptLineRow[]>(Prisma.sql`
    SELECT
      line."id", line."receiptId", line."purchaseOrderLineId",
      purchase_line."lineNumber", line."ingredientId", line."ingredientName",
      line."submittedUnit", line."submittedQuantityMicros",
      line."conversionToBaseMicros", line."baseQuantityMicros",
      line."purchaseUnitCostMicros", line."baseUnitCostMicros",
      line."totalCostMinor", line."stockMovementId",
      line."reversalMovementId", line."createdAt"
    FROM "PurchaseReceiptLine" AS line
    JOIN "PurchaseOrderLine" AS purchase_line
      ON purchase_line."id" = line."purchaseOrderLineId"
    WHERE line."receiptId" = ${receipt.id}
    ORDER BY purchase_line."lineNumber" ASC
    FOR UPDATE OF line
  `);
  if (lines.length === 0) {
    throw new PurchasingError(
      "Purchase receipt has no lines",
      "PURCHASE_RECEIPT_LINES_MISSING",
      500
    );
  }

  await enableReceiptWrite(client);
  const movements: StockMovementRow[] = [];
  for (const line of lines) {
    const original = await readStockMovement(client, line.stockMovementId, true);
    if (!original) {
      throw new PurchasingError(
        "Receipt stock movement is missing",
        "PURCHASE_RECEIPT_MOVEMENT_MISSING",
        500
      );
    }
    const reversal = await createStockMovement(client, {
      idempotencyKey: `purchase-receipt-reversal:${receipt.id}:${line.id}`,
      ingredientId: original.ingredientId,
      movementType: "reversal",
      quantityDeltaMicros: -original.quantityDeltaMicros,
      unitCostMicros: original.unitCostMicros,
      sourceType: "PurchaseReceiptReversal",
      sourceId: receipt.id,
      sourceLineId: line.id,
      reversalOfId: original.id,
      reasonCode: "purchase_receipt_correction",
      reason,
      actor: input.actor,
      metadata: {
        purchaseOrderId,
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        receiptLineId: line.id,
        originalMovementId: original.id,
      },
    });
    movements.push(reversal.movement);

    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseReceiptLine"
      SET "reversalMovementId" = ${reversal.movement.id}
      WHERE "id" = ${line.id}
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseOrderLine"
      SET
        "receivedBaseQuantityMicros" = "receivedBaseQuantityMicros" - ${line.baseQuantityMicros},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${line.purchaseOrderLineId}
    `);
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseReceipt"
    SET
      "status" = 'reversed',
      "reversalKey" = ${key},
      "reversedById" = ${input.actor.id},
      "reversedByName" = ${boundedText(input.actor.name, 160)},
      "reversedAt" = CURRENT_TIMESTAMP,
      "reversalReason" = ${reason}
    WHERE "id" = ${receipt.id}
  `);
  await recalculatePurchaseOrderStatus(client, purchaseOrderId);

  const [receipts, orders] = await Promise.all([
    readPurchaseReceipts(client, { receiptId: receipt.id, includeLines: true }),
    readPurchaseOrders(client, { id: purchaseOrderId }),
  ]);
  return {
    receipt: serializeReceipt(receipts[0]),
    order: orders[0],
    movements,
    replayed: false,
  };
}

function databaseErrorDetails(error: unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5 || value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number") {
      parts.push(String(value));
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Error) {
      parts.push(value.name, value.message);
      visit(value.cause, depth + 1);
    }
    const record = value as Record<string, unknown>;
    for (const field of [
      "code",
      "message",
      "meta",
      "cause",
      "constraint",
      "target",
    ]) {
      visit(record[field], depth + 1);
    }
  };
  visit(error, 0);
  return parts.join(" ");
}

export function purchasingErrorFromDatabase(error: unknown): PurchasingError | null {
  if (error instanceof PurchasingError) return error;
  if (error instanceof InventoryLedgerError) return null;
  const details = databaseErrorDetails(error);
  const mappings: Array<[string, string, string, number]> = [
    [
      "Purchase-order totals are line-controlled",
      "Purchase-order totals are controlled by their lines",
      "PURCHASE_ORDER_TOTAL_CONTROLLED",
      409,
    ],
    [
      "Submitted purchase-order commercial terms are immutable",
      "Submitted purchase-order terms are immutable",
      "PURCHASE_ORDER_IMMUTABLE",
      409,
    ],
    [
      "Submitted purchase-order lines are immutable",
      "Submitted purchase-order lines are immutable",
      "PURCHASE_ORDER_LINE_IMMUTABLE",
      409,
    ],
    [
      "Received purchase quantity is receipt-controlled",
      "Received quantity is controlled by purchase receipts",
      "PURCHASE_RECEIPT_CONTROLLED",
      409,
    ],
    [
      "Invalid purchase-order status transition",
      "Invalid purchase-order status transition",
      "INVALID_PURCHASE_ORDER_TRANSITION",
      409,
    ],
    [
      "A received purchase order cannot be cancelled",
      "A purchase order with receipts cannot be cancelled",
      "PURCHASE_ORDER_NOT_CANCELLABLE",
      409,
    ],
    [
      "Purchase receipts are immutable",
      "Purchase receipts are immutable",
      "PURCHASE_RECEIPT_IMMUTABLE",
      409,
    ],
    [
      "Purchase receipt lines are immutable",
      "Purchase receipt lines are immutable",
      "PURCHASE_RECEIPT_IMMUTABLE",
      409,
    ],
    [
      "Purchase-receipt movements require the purchasing correction workflow",
      "Purchase receipt movements must be corrected from Purchasing",
      "PURCHASE_RECEIPT_REVERSAL_REQUIRED",
      409,
    ],
  ];
  for (const [needle, message, code, status] of mappings) {
    if (details.includes(needle)) {
      return new PurchasingError(message, code, status);
    }
  }
  if (
    details.includes("Supplier_code_key") ||
    (details.includes("23505") && details.toLowerCase().includes("supplier"))
  ) {
    return new PurchasingError(
      "Supplier code is already in use",
      "SUPPLIER_CODE_EXISTS",
      409
    );
  }
  if (details.includes("PurchaseOrder_creationKey_key")) {
    return new PurchasingError(
      "Purchase-order idempotency key is already in use",
      "PURCHASE_ORDER_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (details.includes("PurchaseReceipt_idempotencyKey_key")) {
    return new PurchasingError(
      "Receipt idempotency key is already in use",
      "PURCHASE_RECEIPT_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  return null;
}
