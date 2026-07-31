import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { StaffSession } from "@/lib/auth/session";
import {
  divideAndRoundHalfUp,
  parseNonNegativeDecimalToScaledInteger,
  UNIT_COST_MICRO_DIGITS,
} from "@/lib/money/scaled-integer";
import {
  createStockMovement,
  inventoryLedgerErrorFromDatabase,
  InventoryLedgerError,
  normalizeInventoryUnit,
  quantityMicrosToNumber,
  readIngredientStock,
  type StockMovementRow,
  type StockSqlClient,
  unitCostMicrosToNumber,
} from "@/lib/inventory/stock-ledger";

const QUANTITY_SCALE = 1_000_000n;
const PURCHASE_TOTAL_DIVISOR = 10_000_000_000n;
const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_LIST_LIMIT = 500;

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "submitted",
  "partially_received",
  "received",
  "cancelled",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type PurchaseReceiptStatus = "posted" | "reversed";
export type SupplierStatus = "active" | "inactive";

export type PurchasingClient = StockSqlClient;
export type PurchasingActor = Pick<StaffSession, "id" | "name" | "role">;

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

type PurchaseOrderSummaryRow = {
  id: string;
  orderNumber: string;
  creationKey: string;
  supplierId: string;
  supplier: string;
  supplierCode: string;
  supplierStatus: SupplierStatus;
  status: PurchaseOrderStatus;
  currency: string;
  totalCostMinor: bigint;
  expectedAt: Date | null;
  notes: string | null;
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
  orderedBaseQuantityMicros: bigint;
  receivedBaseQuantityMicros: bigint;
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
  createdAt: Date;
};

type PurchaseReceiptLineRow = {
  id: string;
  receiptId: string;
  purchaseOrderLineId: string;
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

type PurchaseReceiptWithLines = PurchaseReceiptRow & {
  lines: PurchaseReceiptLineRow[];
};

type PurchaseOrderWithDetails = PurchaseOrderSummaryRow & {
  lines: PurchaseOrderLineRow[];
  receipts: PurchaseReceiptWithLines[];
};

export interface PurchaseOrderLineInput {
  ingredientId: string;
  purchaseUnit: string;
  orderedQuantity: string | number;
  unitCost: string | number;
  notes?: string | null;
}

interface PreparedPurchaseOrderLine {
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
}

interface PreparedReceiptLine {
  id: string;
  orderLine: PurchaseOrderLineRow;
  submittedQuantityMicros: bigint;
  baseQuantityMicros: bigint;
  totalCostMinor: bigint;
}

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

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function boundedText(value: string | null | undefined, maximum: number): string {
  return (value || "").trim().slice(0, maximum);
}

function supplierCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(normalized)) {
    throw new PurchasingError(
      "Supplier code must contain only letters, numbers, dots, underscores, or dashes",
      "INVALID_SUPPLIER_CODE",
      400
    );
  }
  return normalized;
}

function exactPositive(
  value: string | number,
  digits: number,
  label: string
): bigint {
  try {
    const parsed = parseNonNegativeDecimalToScaledInteger(
      String(value),
      digits,
      MAX_SAFE_SCALED
    );
    if (parsed <= 0n) throw new Error("zero");
    return parsed;
  } catch {
    throw new PurchasingError(
      `${label} must be a positive decimal inside the supported range`,
      "INVALID_PURCHASE_VALUE",
      400,
      { field: label }
    );
  }
}

function exactMinorToNumber(value: bigint): number {
  if (value < 0n || value > MAX_SAFE_SCALED) {
    throw new PurchasingError(
      "Stored purchase amount cannot be represented safely",
      "UNSAFE_PURCHASE_AMOUNT",
      500
    );
  }
  return Number(value) / 100;
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PurchasingError(
      "A valid date and time is required",
      "INVALID_PURCHASE_DATE",
      400
    );
  }
  return parsed;
}

async function lockKey(
  client: PurchasingClient,
  namespace: string,
  key: string
): Promise<void> {
  await client.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
    WITH purchasing_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${namespace}:${key}`}, 0)
      )
    )
    SELECT 1::integer AS "locked"
    FROM purchasing_lock
  `);
}

function orderNumber(): string {
  const now = new Date();
  const date = `${String(now.getUTCFullYear()).slice(-2)}${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `PO-${date}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function receiptNumber(): string {
  const now = new Date();
  const date = `${String(now.getUTCFullYear()).slice(-2)}${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `PR-${date}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export function serializeSupplier(row: SupplierRow) {
  return { ...row };
}

function receivedPurchaseQuantity(line: PurchaseOrderLineRow): number {
  return quantityMicrosToNumber(
    divideAndRoundHalfUp(
      line.receivedBaseQuantityMicros * QUANTITY_SCALE,
      line.conversionToBaseMicros
    )
  );
}

export function serializePurchaseOrderLine(row: PurchaseOrderLineRow) {
  return {
    id: row.id,
    lineNumber: row.lineNumber,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    baseUnit: row.baseUnit,
    purchaseUnit: row.purchaseUnit,
    conversionToBaseQuantity: quantityMicrosToNumber(
      row.conversionToBaseMicros
    ),
    orderedQuantity: quantityMicrosToNumber(
      row.orderedPurchaseQuantityMicros
    ),
    orderedBaseQuantity: quantityMicrosToNumber(row.orderedBaseQuantityMicros),
    receivedQuantity: receivedPurchaseQuantity(row),
    receivedBaseQuantity: quantityMicrosToNumber(
      row.receivedBaseQuantityMicros
    ),
    remainingBaseQuantity: quantityMicrosToNumber(
      row.orderedBaseQuantityMicros - row.receivedBaseQuantityMicros
    ),
    unitCost: unitCostMicrosToNumber(row.purchaseUnitCostMicros),
    baseUnitCost: unitCostMicrosToNumber(row.baseUnitCostMicros),
    lineTotal: exactMinorToNumber(row.lineTotalMinor),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializePurchaseReceiptLine(row: PurchaseReceiptLineRow) {
  return {
    id: row.id,
    purchaseOrderLineId: row.purchaseOrderLineId,
    ingredientId: row.ingredientId,
    ingredientName: row.ingredientName,
    submittedUnit: row.submittedUnit,
    submittedQuantity: quantityMicrosToNumber(row.submittedQuantityMicros),
    conversionToBaseQuantity: quantityMicrosToNumber(
      row.conversionToBaseMicros
    ),
    baseQuantity: quantityMicrosToNumber(row.baseQuantityMicros),
    unitCost: unitCostMicrosToNumber(row.purchaseUnitCostMicros),
    baseUnitCost: unitCostMicrosToNumber(row.baseUnitCostMicros),
    totalCost: exactMinorToNumber(row.totalCostMinor),
    stockMovementId: row.stockMovementId,
    reversalMovementId: row.reversalMovementId,
    createdAt: row.createdAt,
  };
}

export function serializePurchaseReceipt(row: PurchaseReceiptWithLines) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    purchaseOrderId: row.purchaseOrderId,
    status: row.status,
    totalCost: exactMinorToNumber(row.totalCostMinor),
    notes: row.notes,
    receivedById: row.receivedById,
    receivedByName: row.receivedByName,
    occurredAt: row.occurredAt,
    reversedById: row.reversedById,
    reversedByName: row.reversedByName,
    reversedAt: row.reversedAt,
    reversalReason: row.reversalReason,
    createdAt: row.createdAt,
    lines: row.lines.map(serializePurchaseReceiptLine),
  };
}

export function serializePurchaseOrder(row: PurchaseOrderWithDetails) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    supplierId: row.supplierId,
    supplier: row.supplier,
    supplierCode: row.supplierCode,
    supplierStatus: row.supplierStatus,
    status: row.status,
    currency: row.currency,
    totalCost: exactMinorToNumber(row.totalCostMinor),
    expectedAt: row.expectedAt,
    notes: row.notes,
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
    orderedBaseQuantity: quantityMicrosToNumber(
      row.orderedBaseQuantityMicros
    ),
    receivedBaseQuantity: quantityMicrosToNumber(
      row.receivedBaseQuantityMicros
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines: row.lines.map(serializePurchaseOrderLine),
    receipts: row.receipts.map(serializePurchaseReceipt),
  };
}

function serializePurchaseOrderSummary(row: PurchaseOrderSummaryRow) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    supplierId: row.supplierId,
    supplier: row.supplier,
    supplierCode: row.supplierCode,
    supplierStatus: row.supplierStatus,
    status: row.status,
    currency: row.currency,
    totalCost: exactMinorToNumber(row.totalCostMinor),
    expectedAt: row.expectedAt,
    notes: row.notes,
    lineCount: row.lineCount,
    orderedBaseQuantity: quantityMicrosToNumber(
      row.orderedBaseQuantityMicros
    ),
    receivedBaseQuantity: quantityMicrosToNumber(
      row.receivedBaseQuantityMicros
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function readSuppliers(
  client: PurchasingClient,
  includeInactive = false
): Promise<ReturnType<typeof serializeSupplier>[]> {
  const rows = await client.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes", "status"::text AS "status",
      "createdAt", "updatedAt"
    FROM "Supplier"
    WHERE ${includeInactive} OR "status" = 'active'
    ORDER BY "status" ASC, "name" ASC, "id" ASC
  `);
  return rows.map(serializeSupplier);
}

export async function createSupplier(
  client: PurchasingClient,
  input: {
    code: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    notes?: string | null;
  }
): Promise<ReturnType<typeof serializeSupplier>> {
  const code = supplierCode(input.code);
  const name = boundedText(input.name, 240);
  if (!name) {
    throw new PurchasingError(
      "Supplier name is required",
      "SUPPLIER_NAME_REQUIRED",
      400
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
      ${boundedText(input.address, 1000)},
      ${boundedText(input.paymentTerms, 500)},
      ${input.notes ? boundedText(input.notes, 2000) : null}
    )
  `);

  const rows = await client.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes", "status"::text AS "status",
      "createdAt", "updatedAt"
    FROM "Supplier" WHERE "id" = ${id}
  `);
  if (!rows[0]) {
    throw new PurchasingError(
      "Unable to load the created supplier",
      "SUPPLIER_RESULT_MISSING",
      500
    );
  }
  return serializeSupplier(rows[0]);
}

export async function updateSupplier(
  client: PurchasingClient,
  input: {
    id: string;
    code: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    address?: string;
    paymentTerms?: string;
    notes?: string | null;
    status: SupplierStatus;
  }
): Promise<ReturnType<typeof serializeSupplier>> {
  const code = supplierCode(input.code);
  const name = boundedText(input.name, 240);
  if (!name) {
    throw new PurchasingError(
      "Supplier name is required",
      "SUPPLIER_NAME_REQUIRED",
      400
    );
  }

  const updated = await client.$executeRaw(Prisma.sql`
    UPDATE "Supplier"
    SET
      "code" = ${code},
      "name" = ${name},
      "contactName" = ${boundedText(input.contactName, 160)},
      "phone" = ${boundedText(input.phone, 80)},
      "email" = ${boundedText(input.email, 254)},
      "address" = ${boundedText(input.address, 1000)},
      "paymentTerms" = ${boundedText(input.paymentTerms, 500)},
      "notes" = ${input.notes ? boundedText(input.notes, 2000) : null},
      "status" = CAST(${input.status} AS "SupplierStatus"),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.id}
  `);
  if (updated !== 1) {
    throw new PurchasingError("Supplier not found", "SUPPLIER_NOT_FOUND", 404);
  }

  const rows = await client.$queryRaw<SupplierRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "contactName", "phone", "email",
      "address", "paymentTerms", "notes", "status"::text AS "status",
      "createdAt", "updatedAt"
    FROM "Supplier" WHERE "id" = ${input.id}
  `);
  if (!rows[0]) {
    throw new PurchasingError(
      "Unable to load the updated supplier",
      "SUPPLIER_RESULT_MISSING",
      500
    );
  }
  return serializeSupplier(rows[0]);
}

async function purchaseOrderSummaries(
  client: PurchasingClient,
  options: { id?: string; status?: PurchaseOrderStatus; limit?: number } = {}
): Promise<PurchaseOrderSummaryRow[]> {
  const limit = Math.max(1, Math.min(options.limit || 100, MAX_LIST_LIMIT));
  const filters: Prisma.Sql[] = [];
  if (options.id) filters.push(Prisma.sql`purchase_order."id" = ${options.id}`);
  if (options.status) {
    filters.push(
      Prisma.sql`purchase_order."status" = CAST(${options.status} AS "PurchaseOrderStatus")`
    );
  }
  const where =
    filters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

  return client.$queryRaw<PurchaseOrderSummaryRow[]>(Prisma.sql`
    SELECT
      purchase_order."id",
      purchase_order."orderNumber",
      purchase_order."creationKey",
      purchase_order."supplierId",
      purchase_order."supplier",
      purchase_order."supplierCode",
      supplier."status"::text AS "supplierStatus",
      purchase_order."status"::text AS "status",
      purchase_order."currency",
      purchase_order."totalCostMinor",
      purchase_order."expectedAt",
      purchase_order."notes",
      purchase_order."createdById",
      purchase_order."createdByName",
      purchase_order."submittedById",
      purchase_order."submittedByName",
      purchase_order."submittedAt",
      purchase_order."cancelledById",
      purchase_order."cancelledByName",
      purchase_order."cancelledAt",
      purchase_order."cancellationReason",
      purchase_order."legacyImported",
      COALESCE(line_summary."lineCount", 0)::integer AS "lineCount",
      COALESCE(line_summary."orderedBaseQuantityMicros", 0)::bigint
        AS "orderedBaseQuantityMicros",
      COALESCE(line_summary."receivedBaseQuantityMicros", 0)::bigint
        AS "receivedBaseQuantityMicros",
      purchase_order."createdAt",
      purchase_order."updatedAt"
    FROM "PurchaseOrder" AS purchase_order
    JOIN "Supplier" AS supplier ON supplier."id" = purchase_order."supplierId"
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::integer AS "lineCount",
        COALESCE(SUM(line."orderedBaseQuantityMicros"), 0)::bigint
          AS "orderedBaseQuantityMicros",
        COALESCE(SUM(line."receivedBaseQuantityMicros"), 0)::bigint
          AS "receivedBaseQuantityMicros"
      FROM "PurchaseOrderLine" AS line
      WHERE line."purchaseOrderId" = purchase_order."id"
    ) AS line_summary ON true
    ${where}
    ORDER BY purchase_order."createdAt" DESC, purchase_order."id" DESC
    LIMIT ${limit}
  `);
}

export async function readPurchaseOrders(
  client: PurchasingClient,
  options: { status?: PurchaseOrderStatus; limit?: number } = {}
) {
  const rows = await purchaseOrderSummaries(client, options);
  return rows.map(serializePurchaseOrderSummary);
}

async function readPurchaseOrderLines(
  client: PurchasingClient,
  purchaseOrderId: string,
  lock = false
): Promise<PurchaseOrderLineRow[]> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE OF line` : Prisma.empty;
  return client.$queryRaw<PurchaseOrderLineRow[]>(Prisma.sql`
    SELECT
      line."id", line."purchaseOrderId", line."lineNumber",
      line."ingredientId", line."ingredientName", line."baseUnit",
      line."purchaseUnit", line."conversionToBaseMicros",
      line."orderedPurchaseQuantityMicros", line."orderedBaseQuantityMicros",
      line."receivedBaseQuantityMicros", line."purchaseUnitCostMicros",
      line."baseUnitCostMicros", line."lineTotalMinor", line."notes",
      line."createdAt", line."updatedAt"
    FROM "PurchaseOrderLine" AS line
    WHERE line."purchaseOrderId" = ${purchaseOrderId}
    ORDER BY line."lineNumber" ASC, line."id" ASC
    ${lockSql}
  `);
}

async function readPurchaseReceipts(
  client: PurchasingClient,
  purchaseOrderId: string
): Promise<PurchaseReceiptWithLines[]> {
  const receipts = await client.$queryRaw<PurchaseReceiptRow[]>(Prisma.sql`
    SELECT
      "id", "receiptNumber", "idempotencyKey", "reversalKey",
      "purchaseOrderId", "status"::text AS "status", "totalCostMinor",
      "notes", "receivedById", "receivedByName", "occurredAt",
      "reversedById", "reversedByName", "reversedAt", "reversalReason",
      "createdAt"
    FROM "PurchaseReceipt"
    WHERE "purchaseOrderId" = ${purchaseOrderId}
    ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
  `);
  if (receipts.length === 0) return [];

  const lines = await client.$queryRaw<PurchaseReceiptLineRow[]>(Prisma.sql`
    SELECT
      "id", "receiptId", "purchaseOrderLineId", "ingredientId",
      "ingredientName", "submittedUnit", "submittedQuantityMicros",
      "conversionToBaseMicros", "baseQuantityMicros",
      "purchaseUnitCostMicros", "baseUnitCostMicros", "totalCostMinor",
      "stockMovementId", "reversalMovementId", "createdAt"
    FROM "PurchaseReceiptLine"
    WHERE "receiptId" IN (${Prisma.join(receipts.map((entry) => entry.id))})
    ORDER BY "createdAt" ASC, "id" ASC
  `);
  const byReceipt = new Map<string, PurchaseReceiptLineRow[]>();
  for (const line of lines) {
    const bucket = byReceipt.get(line.receiptId) || [];
    bucket.push(line);
    byReceipt.set(line.receiptId, bucket);
  }
  return receipts.map((receipt) => ({
    ...receipt,
    lines: byReceipt.get(receipt.id) || [],
  }));
}

export async function readPurchaseOrder(
  client: PurchasingClient,
  purchaseOrderId: string
): Promise<PurchaseOrderWithDetails | null> {
  const [summary] = await purchaseOrderSummaries(client, {
    id: purchaseOrderId,
    limit: 1,
  });
  if (!summary) return null;
  const [lines, receipts] = await Promise.all([
    readPurchaseOrderLines(client, purchaseOrderId),
    readPurchaseReceipts(client, purchaseOrderId),
  ]);
  return { ...summary, lines, receipts };
}

async function activeSupplier(
  client: PurchasingClient,
  supplierId: string,
  lock = false
): Promise<SupplierRow> {
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
  const supplier = rows[0];
  if (!supplier) {
    throw new PurchasingError("Supplier not found", "SUPPLIER_NOT_FOUND", 404);
  }
  if (supplier.status !== "active") {
    throw new PurchasingError(
      "Inactive suppliers cannot be used for new purchase orders",
      "SUPPLIER_INACTIVE",
      409
    );
  }
  return supplier;
}

async function preparePurchaseOrderLines(
  client: PurchasingClient,
  lines: PurchaseOrderLineInput[]
): Promise<PreparedPurchaseOrderLine[]> {
  if (lines.length === 0 || lines.length > 500) {
    throw new PurchasingError(
      "A purchase order requires between 1 and 500 lines",
      "INVALID_PURCHASE_ORDER_LINES",
      400
    );
  }

  const seen = new Set<string>();
  const prepared: PreparedPurchaseOrderLine[] = [];
  for (const [index, input] of lines.entries()) {
    if (seen.has(input.ingredientId)) {
      throw new PurchasingError(
        "Each ingredient may appear only once in a purchase order",
        "DUPLICATE_PURCHASE_INGREDIENT",
        400,
        { ingredientId: input.ingredientId }
      );
    }
    seen.add(input.ingredientId);

    const ingredient = await readIngredientStock(client, input.ingredientId, true);
    if (!ingredient) {
      throw new PurchasingError(
        "Purchase-order ingredient not found",
        "INGREDIENT_NOT_FOUND",
        404,
        { ingredientId: input.ingredientId }
      );
    }

    const purchaseUnit = normalizeInventoryUnit(input.purchaseUnit);
    const baseUnit = normalizeInventoryUnit(ingredient.unit);
    let conversionToBaseMicros = QUANTITY_SCALE;
    if (purchaseUnit !== baseUnit) {
      const conversions = await client.$queryRaw<Array<{ toBaseMicros: bigint }>>(
        Prisma.sql`
          SELECT "toBaseMicros"
          FROM "IngredientUnitConversion"
          WHERE "ingredientId" = ${ingredient.id} AND "unit" = ${purchaseUnit}
          LIMIT 1
        `
      );
      if (!conversions[0]) {
        throw new PurchasingError(
          `No ${purchaseUnit} conversion is configured for ${ingredient.name}`,
          "PURCHASE_UNIT_CONVERSION_NOT_FOUND",
          409,
          { ingredientId: ingredient.id, purchaseUnit, baseUnit }
        );
      }
      conversionToBaseMicros = conversions[0].toBaseMicros;
    }

    const orderedPurchaseQuantityMicros = exactPositive(
      input.orderedQuantity,
      6,
      "orderedQuantity"
    );
    const purchaseUnitCostMicros = exactPositive(
      input.unitCost,
      UNIT_COST_MICRO_DIGITS,
      "unitCost"
    );
    const orderedBaseQuantityMicros = divideAndRoundHalfUp(
      orderedPurchaseQuantityMicros * conversionToBaseMicros,
      QUANTITY_SCALE
    );
    const baseUnitCostMicros = divideAndRoundHalfUp(
      purchaseUnitCostMicros * QUANTITY_SCALE,
      conversionToBaseMicros
    );
    const lineTotalMinor = divideAndRoundHalfUp(
      orderedPurchaseQuantityMicros * purchaseUnitCostMicros,
      PURCHASE_TOTAL_DIVISOR
    );

    prepared.push({
      id: newId("purchase_order_line"),
      lineNumber: index + 1,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
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
  return prepared;
}

async function insertPurchaseOrderLines(
  client: PurchasingClient,
  purchaseOrderId: string,
  lines: PreparedPurchaseOrderLine[]
): Promise<void> {
  for (const line of lines) {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "PurchaseOrderLine" (
        "id", "purchaseOrderId", "lineNumber", "ingredientId",
        "ingredientName", "baseUnit", "purchaseUnit",
        "conversionToBaseMicros", "orderedPurchaseQuantityMicros",
        "orderedBaseQuantityMicros", "purchaseUnitCostMicros",
        "baseUnitCostMicros", "lineTotalMinor", "notes"
      ) VALUES (
        ${line.id}, ${purchaseOrderId}, ${line.lineNumber},
        ${line.ingredientId}, ${line.ingredientName}, ${line.baseUnit},
        ${line.purchaseUnit}, ${line.conversionToBaseMicros},
        ${line.orderedPurchaseQuantityMicros},
        ${line.orderedBaseQuantityMicros}, ${line.purchaseUnitCostMicros},
        ${line.baseUnitCostMicros}, ${line.lineTotalMinor}, ${line.notes}
      )
    `);
  }
}

export async function createPurchaseOrder(
  client: PurchasingClient,
  input: {
    creationKey: string;
    supplierId: string;
    expectedAt?: Date | string | null;
    notes?: string | null;
    lines: PurchaseOrderLineInput[];
    actor: PurchasingActor;
  }
): Promise<{ order: PurchaseOrderWithDetails; replayed: boolean }> {
  await lockKey(client, "purchase-order", input.creationKey);
  const existing = await client.$queryRaw<Array<{ id: string; supplierId: string }>>(
    Prisma.sql`
      SELECT "id", "supplierId"
      FROM "PurchaseOrder"
      WHERE "creationKey" = ${input.creationKey}
      LIMIT 1
    `
  );
  if (existing[0]) {
    if (existing[0].supplierId !== input.supplierId) {
      throw new PurchasingError(
        "The purchase-order idempotency key was used for another request",
        "PURCHASE_ORDER_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    const replay = await readPurchaseOrder(client, existing[0].id);
    if (!replay) {
      throw new PurchasingError(
        "Unable to load the existing purchase order",
        "PURCHASE_ORDER_RESULT_MISSING",
        500
      );
    }
    return { order: replay, replayed: true };
  }

  const supplier = await activeSupplier(client, input.supplierId, true);
  const lines = await preparePurchaseOrderLines(client, input.lines);
  const settings = await client.$queryRaw<Array<{ currency: string }>>(Prisma.sql`
    SELECT "currency" FROM "RestaurantSettings" WHERE "id" = '1'
  `);
  const id = newId("purchase_order");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "PurchaseOrder" (
      "id", "orderNumber", "creationKey", "supplierId", "supplier",
      "supplierCode", "currency", "expectedAt", "notes",
      "createdById", "createdByName"
    ) VALUES (
      ${id}, ${orderNumber()}, ${input.creationKey}, ${supplier.id},
      ${supplier.name}, ${supplier.code}, ${boundedText(settings[0]?.currency || "USD", 8)},
      ${normalizeDate(input.expectedAt)},
      ${input.notes ? boundedText(input.notes, 4000) : null},
      ${input.actor.id}, ${boundedText(input.actor.name, 160)}
    )
  `);
  await insertPurchaseOrderLines(client, id, lines);

  const order = await readPurchaseOrder(client, id);
  if (!order) {
    throw new PurchasingError(
      "Unable to load the created purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return { order, replayed: false };
}

async function lockedPurchaseOrder(
  client: PurchasingClient,
  id: string
): Promise<{ id: string; status: PurchaseOrderStatus; supplierId: string }> {
  const rows = await client.$queryRaw<
    Array<{ id: string; status: PurchaseOrderStatus; supplierId: string }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "supplierId"
    FROM "PurchaseOrder"
    WHERE "id" = ${id}
    FOR UPDATE
  `);
  if (!rows[0]) {
    throw new PurchasingError(
      "Purchase order not found",
      "PURCHASE_ORDER_NOT_FOUND",
      404
    );
  }
  return rows[0];
}

export async function updateDraftPurchaseOrder(
  client: PurchasingClient,
  input: {
    id: string;
    supplierId: string;
    expectedAt?: Date | string | null;
    notes?: string | null;
    lines: PurchaseOrderLineInput[];
  }
): Promise<PurchaseOrderWithDetails> {
  const existing = await lockedPurchaseOrder(client, input.id);
  if (existing.status !== "draft") {
    throw new PurchasingError(
      "Only draft purchase orders can be edited",
      "PURCHASE_ORDER_NOT_DRAFT",
      409
    );
  }
  const supplier = await activeSupplier(client, input.supplierId, true);
  const lines = await preparePurchaseOrderLines(client, input.lines);

  await client.$executeRaw(Prisma.sql`
    DELETE FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${input.id}
  `);
  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET
      "supplierId" = ${supplier.id},
      "supplier" = ${supplier.name},
      "supplierCode" = ${supplier.code},
      "expectedAt" = ${normalizeDate(input.expectedAt)},
      "notes" = ${input.notes ? boundedText(input.notes, 4000) : null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.id}
  `);
  await insertPurchaseOrderLines(client, input.id, lines);

  const order = await readPurchaseOrder(client, input.id);
  if (!order) {
    throw new PurchasingError(
      "Unable to load the updated purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return order;
}

export async function submitPurchaseOrder(
  client: PurchasingClient,
  input: { id: string; actor: PurchasingActor }
): Promise<{ order: PurchaseOrderWithDetails; replayed: boolean }> {
  const existing = await lockedPurchaseOrder(client, input.id);
  if (existing.status === "submitted") {
    const replay = await readPurchaseOrder(client, input.id);
    if (!replay) {
      throw new PurchasingError(
        "Unable to load the submitted purchase order",
        "PURCHASE_ORDER_RESULT_MISSING",
        500
      );
    }
    return { order: replay, replayed: true };
  }
  if (existing.status !== "draft") {
    throw new PurchasingError(
      "Only a draft purchase order can be submitted",
      "PURCHASE_ORDER_NOT_DRAFT",
      409
    );
  }
  const counts = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "PurchaseOrderLine" WHERE "purchaseOrderId" = ${input.id}
  `);
  if (!counts[0]?.count) {
    throw new PurchasingError(
      "A purchase order must contain at least one line before submission",
      "PURCHASE_ORDER_LINES_REQUIRED",
      409
    );
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET
      "status" = 'submitted',
      "submittedById" = ${input.actor.id},
      "submittedByName" = ${boundedText(input.actor.name, 160)},
      "submittedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.id}
  `);
  const order = await readPurchaseOrder(client, input.id);
  if (!order) {
    throw new PurchasingError(
      "Unable to load the submitted purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return { order, replayed: false };
}

export async function cancelPurchaseOrder(
  client: PurchasingClient,
  input: { id: string; reason: string; actor: PurchasingActor }
): Promise<{ order: PurchaseOrderWithDetails; replayed: boolean }> {
  const existing = await lockedPurchaseOrder(client, input.id);
  const reason = boundedText(input.reason, 2000);
  if (!reason) {
    throw new PurchasingError(
      "A cancellation reason is required",
      "PURCHASE_ORDER_CANCELLATION_REASON_REQUIRED",
      400
    );
  }
  if (existing.status === "cancelled") {
    const replay = await readPurchaseOrder(client, input.id);
    if (!replay) {
      throw new PurchasingError(
        "Unable to load the cancelled purchase order",
        "PURCHASE_ORDER_RESULT_MISSING",
        500
      );
    }
    return { order: replay, replayed: true };
  }
  if (!(["draft", "submitted"] as PurchaseOrderStatus[]).includes(existing.status)) {
    throw new PurchasingError(
      "A received purchase order cannot be cancelled",
      "PURCHASE_ORDER_NOT_CANCELLABLE",
      409
    );
  }

  const receipts = await client.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::integer AS "count"
    FROM "PurchaseReceipt"
    WHERE "purchaseOrderId" = ${input.id} AND "status" = 'posted'
  `);
  if ((receipts[0]?.count || 0) > 0) {
    throw new PurchasingError(
      "A purchase order with posted receipts cannot be cancelled",
      "PURCHASE_ORDER_HAS_RECEIPTS",
      409
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
    WHERE "id" = ${input.id}
  `);
  const order = await readPurchaseOrder(client, input.id);
  if (!order) {
    throw new PurchasingError(
      "Unable to load the cancelled purchase order",
      "PURCHASE_ORDER_RESULT_MISSING",
      500
    );
  }
  return { order, replayed: false };
}

async function receiptByIdempotencyKey(
  client: PurchasingClient,
  key: string
): Promise<PurchaseReceiptRow | null> {
  const rows = await client.$queryRaw<PurchaseReceiptRow[]>(Prisma.sql`
    SELECT
      "id", "receiptNumber", "idempotencyKey", "reversalKey",
      "purchaseOrderId", "status"::text AS "status", "totalCostMinor",
      "notes", "receivedById", "receivedByName", "occurredAt",
      "reversedById", "reversedByName", "reversedAt", "reversalReason",
      "createdAt"
    FROM "PurchaseReceipt"
    WHERE "idempotencyKey" = ${key}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function receiptWithLines(
  client: PurchasingClient,
  receiptId: string,
  lock = false
): Promise<PurchaseReceiptWithLines | null> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw<PurchaseReceiptRow[]>(Prisma.sql`
    SELECT
      "id", "receiptNumber", "idempotencyKey", "reversalKey",
      "purchaseOrderId", "status"::text AS "status", "totalCostMinor",
      "notes", "receivedById", "receivedByName", "occurredAt",
      "reversedById", "reversedByName", "reversedAt", "reversalReason",
      "createdAt"
    FROM "PurchaseReceipt"
    WHERE "id" = ${receiptId}
    LIMIT 1
    ${lockSql}
  `);
  if (!rows[0]) return null;
  const lines = await client.$queryRaw<PurchaseReceiptLineRow[]>(Prisma.sql`
    SELECT
      "id", "receiptId", "purchaseOrderLineId", "ingredientId",
      "ingredientName", "submittedUnit", "submittedQuantityMicros",
      "conversionToBaseMicros", "baseQuantityMicros",
      "purchaseUnitCostMicros", "baseUnitCostMicros", "totalCostMinor",
      "stockMovementId", "reversalMovementId", "createdAt"
    FROM "PurchaseReceiptLine"
    WHERE "receiptId" = ${receiptId}
    ORDER BY "createdAt" ASC, "id" ASC
    ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}
  `);
  return { ...rows[0], lines };
}

async function recomputeOrderReceiptStatus(
  client: PurchasingClient,
  purchaseOrderId: string
): Promise<PurchaseOrderStatus> {
  const rows = await client.$queryRaw<
    Array<{ anyReceived: boolean; allReceived: boolean }>
  >(Prisma.sql`
    SELECT
      COALESCE(bool_or("receivedBaseQuantityMicros" > 0), false)
        AS "anyReceived",
      COALESCE(bool_and(
        "receivedBaseQuantityMicros" = "orderedBaseQuantityMicros"
      ), false) AS "allReceived"
    FROM "PurchaseOrderLine"
    WHERE "purchaseOrderId" = ${purchaseOrderId}
  `);
  const status: PurchaseOrderStatus = rows[0]?.allReceived
    ? "received"
    : rows[0]?.anyReceived
      ? "partially_received"
      : "submitted";
  await client.$executeRaw(Prisma.sql`
    SELECT set_config('app.purchase_receipt_write', 'on', true)
  `);
  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseOrder"
    SET "status" = CAST(${status} AS "PurchaseOrderStatus"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${purchaseOrderId}
  `);
  return status;
}

export async function receivePurchaseOrder(
  client: PurchasingClient,
  input: {
    idempotencyKey: string;
    purchaseOrderId: string;
    lines: Array<{ purchaseOrderLineId: string; quantity: string | number }>;
    notes?: string | null;
    occurredAt?: Date | string | null;
    actor: PurchasingActor;
  }
): Promise<{
  order: PurchaseOrderWithDetails;
  receipt: PurchaseReceiptWithLines;
  replayed: boolean;
}> {
  await lockKey(client, "purchase-receipt", input.idempotencyKey);
  const replayHeader = await receiptByIdempotencyKey(client, input.idempotencyKey);
  if (replayHeader) {
    if (replayHeader.purchaseOrderId !== input.purchaseOrderId) {
      throw new PurchasingError(
        "The receipt idempotency key was used for another purchase order",
        "PURCHASE_RECEIPT_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    const [receipt, order] = await Promise.all([
      receiptWithLines(client, replayHeader.id),
      readPurchaseOrder(client, input.purchaseOrderId),
    ]);
    if (!receipt || !order) {
      throw new PurchasingError(
        "Unable to load the existing purchase receipt",
        "PURCHASE_RECEIPT_RESULT_MISSING",
        500
      );
    }
    return { order, receipt, replayed: true };
  }

  const orderHeader = await lockedPurchaseOrder(client, input.purchaseOrderId);
  if (!(["submitted", "partially_received"] as PurchaseOrderStatus[]).includes(orderHeader.status)) {
    throw new PurchasingError(
      "Only submitted or partially received orders can receive stock",
      "PURCHASE_ORDER_NOT_RECEIVABLE",
      409
    );
  }
  if (input.lines.length === 0 || input.lines.length > 500) {
    throw new PurchasingError(
      "A receipt requires between 1 and 500 lines",
      "INVALID_PURCHASE_RECEIPT_LINES",
      400
    );
  }

  const orderLines = await readPurchaseOrderLines(client, input.purchaseOrderId, true);
  const byId = new Map(orderLines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const prepared: PreparedReceiptLine[] = [];
  for (const inputLine of input.lines) {
    if (seen.has(inputLine.purchaseOrderLineId)) {
      throw new PurchasingError(
        "A purchase-order line may appear only once in a receipt",
        "DUPLICATE_PURCHASE_RECEIPT_LINE",
        400
      );
    }
    seen.add(inputLine.purchaseOrderLineId);
    const orderLine = byId.get(inputLine.purchaseOrderLineId);
    if (!orderLine) {
      throw new PurchasingError(
        "Purchase-order line not found",
        "PURCHASE_ORDER_LINE_NOT_FOUND",
        404
      );
    }
    const submittedQuantityMicros = exactPositive(
      inputLine.quantity,
      6,
      "receiptQuantity"
    );
    const baseQuantityMicros = divideAndRoundHalfUp(
      submittedQuantityMicros * orderLine.conversionToBaseMicros,
      QUANTITY_SCALE
    );
    const remaining =
      orderLine.orderedBaseQuantityMicros - orderLine.receivedBaseQuantityMicros;
    if (baseQuantityMicros > remaining) {
      throw new PurchasingError(
        "Receipt quantity exceeds the remaining ordered quantity",
        "PURCHASE_RECEIPT_OVER_RECEIPT",
        409,
        {
          purchaseOrderLineId: orderLine.id,
          remainingBaseQuantity: quantityMicrosToNumber(remaining),
        }
      );
    }
    prepared.push({
      id: newId("purchase_receipt_line"),
      orderLine,
      submittedQuantityMicros,
      baseQuantityMicros,
      totalCostMinor: divideAndRoundHalfUp(
        baseQuantityMicros * orderLine.baseUnitCostMicros,
        PURCHASE_TOTAL_DIVISOR
      ),
    });
  }
  prepared.sort((left, right) =>
    left.orderLine.ingredientId.localeCompare(right.orderLine.ingredientId)
  );

  const receiptId = newId("purchase_receipt");
  const receiptTotal = prepared.reduce(
    (total, line) => total + line.totalCostMinor,
    0n
  );
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "PurchaseReceipt" (
      "id", "receiptNumber", "idempotencyKey", "purchaseOrderId",
      "totalCostMinor", "notes", "receivedById", "receivedByName",
      "occurredAt"
    ) VALUES (
      ${receiptId}, ${receiptNumber()}, ${input.idempotencyKey},
      ${input.purchaseOrderId}, ${receiptTotal},
      ${input.notes ? boundedText(input.notes, 4000) : null},
      ${input.actor.id}, ${boundedText(input.actor.name, 160)},
      ${normalizeDate(input.occurredAt) || new Date()}
    )
  `);

  await client.$executeRaw(Prisma.sql`
    SELECT set_config('app.purchase_receipt_write', 'on', true)
  `);
  for (const line of prepared) {
    const movement = await createStockMovement(client, {
      idempotencyKey: `purchase-receipt:${receiptId}:${line.id}`,
      ingredientId: line.orderLine.ingredientId,
      movementType: "receipt",
      quantityDeltaMicros: line.baseQuantityMicros,
      unitCostMicros: line.orderLine.baseUnitCostMicros,
      sourceType: "PurchaseReceipt",
      sourceId: receiptId,
      sourceLineId: line.id,
      reasonCode: "purchase_receipt",
      reason: `Receipt for purchase order ${input.purchaseOrderId}`,
      actor: input.actor,
      metadata: {
        purchaseOrderId: input.purchaseOrderId,
        purchaseOrderLineId: line.orderLine.id,
        submittedUnit: line.orderLine.purchaseUnit,
        submittedQuantityMicros: line.submittedQuantityMicros.toString(),
        conversionToBaseMicros:
          line.orderLine.conversionToBaseMicros.toString(),
      },
    });
    if (movement.replayed) {
      throw new PurchasingError(
        "A new purchase receipt unexpectedly reused a stock movement",
        "PURCHASE_RECEIPT_STOCK_REPLAY",
        409
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
        ${line.id}, ${receiptId}, ${line.orderLine.id},
        ${line.orderLine.ingredientId}, ${line.orderLine.ingredientName},
        ${line.orderLine.purchaseUnit}, ${line.submittedQuantityMicros},
        ${line.orderLine.conversionToBaseMicros}, ${line.baseQuantityMicros},
        ${line.orderLine.purchaseUnitCostMicros},
        ${line.orderLine.baseUnitCostMicros}, ${line.totalCostMinor},
        ${movement.movement.id}
      )
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseOrderLine"
      SET
        "receivedBaseQuantityMicros" =
          "receivedBaseQuantityMicros" + ${line.baseQuantityMicros},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${line.orderLine.id}
    `);
  }
  await recomputeOrderReceiptStatus(client, input.purchaseOrderId);

  const [receipt, order] = await Promise.all([
    receiptWithLines(client, receiptId),
    readPurchaseOrder(client, input.purchaseOrderId),
  ]);
  if (!receipt || !order) {
    throw new PurchasingError(
      "Unable to load the posted purchase receipt",
      "PURCHASE_RECEIPT_RESULT_MISSING",
      500
    );
  }
  return { order, receipt, replayed: false };
}

export async function reversePurchaseReceipt(
  client: PurchasingClient,
  input: {
    receiptId: string;
    reversalKey: string;
    reason: string;
    actor: PurchasingActor;
  }
): Promise<{
  order: PurchaseOrderWithDetails;
  receipt: PurchaseReceiptWithLines;
  replayed: boolean;
}> {
  await lockKey(client, "purchase-receipt-reversal", input.reversalKey);
  const keyRows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "PurchaseReceipt"
    WHERE "reversalKey" = ${input.reversalKey}
    LIMIT 1
  `);
  if (keyRows[0] && keyRows[0].id !== input.receiptId) {
    throw new PurchasingError(
      "The receipt reversal key was used for another receipt",
      "PURCHASE_RECEIPT_REVERSAL_KEY_CONFLICT",
      409
    );
  }

  const receipt = await receiptWithLines(client, input.receiptId, true);
  if (!receipt) {
    throw new PurchasingError(
      "Purchase receipt not found",
      "PURCHASE_RECEIPT_NOT_FOUND",
      404
    );
  }
  if (receipt.status === "reversed") {
    if (receipt.reversalKey !== input.reversalKey) {
      throw new PurchasingError(
        "The purchase receipt was already reversed",
        "PURCHASE_RECEIPT_ALREADY_REVERSED",
        409
      );
    }
    const order = await readPurchaseOrder(client, receipt.purchaseOrderId);
    if (!order) {
      throw new PurchasingError(
        "Unable to load the reversed purchase order",
        "PURCHASE_ORDER_RESULT_MISSING",
        500
      );
    }
    return { order, receipt, replayed: true };
  }

  const reason = boundedText(input.reason, 2000);
  if (!reason) {
    throw new PurchasingError(
      "A receipt reversal reason is required",
      "PURCHASE_RECEIPT_REVERSAL_REASON_REQUIRED",
      400
    );
  }

  const orderedLines = [...receipt.lines].sort((left, right) =>
    left.ingredientId.localeCompare(right.ingredientId)
  );
  await client.$executeRaw(Prisma.sql`
    SELECT set_config('app.purchase_receipt_write', 'on', true)
  `);
  for (const line of orderedLines) {
    if (line.reversalMovementId) {
      throw new PurchasingError(
        "A purchase receipt line was already reversed",
        "PURCHASE_RECEIPT_ALREADY_REVERSED",
        409
      );
    }
    const movement = await createStockMovement(client, {
      idempotencyKey: `purchase-receipt-reversal:${input.reversalKey}:${line.id}`,
      ingredientId: line.ingredientId,
      movementType: "reversal",
      quantityDeltaMicros: -line.baseQuantityMicros,
      unitCostMicros: line.baseUnitCostMicros,
      sourceType: "PurchaseReceiptReversal",
      sourceId: receipt.id,
      sourceLineId: line.id,
      reversalOfId: line.stockMovementId,
      reasonCode: "purchase_receipt_correction",
      reason,
      actor: input.actor,
      metadata: {
        purchaseOrderId: receipt.purchaseOrderId,
        purchaseReceiptId: receipt.id,
        purchaseReceiptLineId: line.id,
      },
    });

    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseReceiptLine"
      SET "reversalMovementId" = ${movement.movement.id}
      WHERE "id" = ${line.id}
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE "PurchaseOrderLine"
      SET
        "receivedBaseQuantityMicros" =
          "receivedBaseQuantityMicros" - ${line.baseQuantityMicros},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${line.purchaseOrderLineId}
    `);
  }

  await client.$executeRaw(Prisma.sql`
    UPDATE "PurchaseReceipt"
    SET
      "status" = 'reversed',
      "reversalKey" = ${input.reversalKey},
      "reversedById" = ${input.actor.id},
      "reversedByName" = ${boundedText(input.actor.name, 160)},
      "reversedAt" = CURRENT_TIMESTAMP,
      "reversalReason" = ${reason}
    WHERE "id" = ${receipt.id}
  `);
  await recomputeOrderReceiptStatus(client, receipt.purchaseOrderId);

  const [updatedReceipt, order] = await Promise.all([
    receiptWithLines(client, receipt.id),
    readPurchaseOrder(client, receipt.purchaseOrderId),
  ]);
  if (!updatedReceipt || !order) {
    throw new PurchasingError(
      "Unable to load the corrected purchase receipt",
      "PURCHASE_RECEIPT_RESULT_MISSING",
      500
    );
  }
  return { order, receipt: updatedReceipt, replayed: false };
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
    for (const key of [
      "code",
      "message",
      "meta",
      "cause",
      "constraint",
      "target",
      "detail",
    ]) {
      visit(record[key], depth + 1);
    }
  };
  visit(error, 0);
  return parts.join(" ");
}

export function purchasingErrorFromDatabase(error: unknown): PurchasingError | null {
  const inventoryError = inventoryLedgerErrorFromDatabase(error);
  if (inventoryError) {
    return new PurchasingError(
      inventoryError.message,
      inventoryError.code,
      inventoryError.status,
      inventoryError.details
    );
  }
  if (error instanceof InventoryLedgerError) {
    return new PurchasingError(
      error.message,
      error.code,
      error.status,
      error.details
    );
  }

  const details = databaseErrorDetails(error);
  if (details.includes("Supplier_code_key")) {
    return new PurchasingError(
      "Supplier code already exists",
      "SUPPLIER_CODE_EXISTS",
      409
    );
  }
  if (details.includes("PurchaseOrder_creationKey_key")) {
    return new PurchasingError(
      "The purchase-order idempotency key was already used",
      "PURCHASE_ORDER_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (details.includes("PurchaseReceipt_idempotencyKey_key")) {
    return new PurchasingError(
      "The purchase-receipt idempotency key was already used",
      "PURCHASE_RECEIPT_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (
    details.includes("Submitted purchase-order commercial terms are immutable") ||
    details.includes("Submitted purchase-order lines are immutable")
  ) {
    return new PurchasingError(
      "Submitted purchase orders are immutable",
      "PURCHASE_ORDER_IMMUTABLE",
      409
    );
  }
  if (details.includes("Received purchase quantity is receipt-controlled")) {
    return new PurchasingError(
      "Received quantities are controlled by purchase receipts",
      "PURCHASE_RECEIPT_CONTROLLED",
      409
    );
  }
  if (details.includes("Purchase receipts are immutable")) {
    return new PurchasingError(
      "Purchase receipts are immutable; use the reviewed correction workflow",
      "PURCHASE_RECEIPT_IMMUTABLE",
      409
    );
  }
  if (details.includes("A received purchase order cannot be cancelled")) {
    return new PurchasingError(
      "A purchase order with receipts cannot be cancelled",
      "PURCHASE_ORDER_HAS_RECEIPTS",
      409
    );
  }
  return null;
}
