import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  createPurchaseOrder,
  PurchasingError,
  purchasingErrorFromDatabase,
  PURCHASE_ORDER_STATUSES,
  readPurchaseOrders,
} from "@/lib/inventory/purchasing";
import {
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
} from "@/lib/inventory/stock-ledger";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const purchaseLineSchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    unitCost: z.number().finite().positive().max(1_000_000_000),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const createPurchaseOrderSchema = z
  .object({
    supplierId: z.string().trim().min(1).max(191),
    currency: z.string().trim().min(3).max(8).optional(),
    notes: z.string().trim().max(4_000).nullable().optional(),
    expectedAt: z.string().datetime({ offset: true }).nullable().optional(),
    lines: z.array(purchaseLineSchema).min(1).max(200),
  })
  .strict();

const querySchema = z
  .object({
    supplierId: z.string().trim().min(1).max(191).optional(),
    status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(300).default(100),
  })
  .strict();

function idempotencyKey(req: NextRequest): string {
  const key = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new PurchasingError(
      "A valid Idempotency-Key header is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  return key;
}

function errorResponse(error: PurchasingError | InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

function mappedError(error: unknown) {
  return purchasingErrorFromDatabase(error) || inventoryLedgerErrorFromDatabase(error);
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid purchase-order query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const purchaseOrders = await readPurchaseOrders(db, parsed.data);
    return NextResponse.json(
      { purchaseOrders },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders] Failed to load purchase orders", error);
    return NextResponse.json(
      {
        error: "Unable to load purchase orders",
        code: "PURCHASE_ORDERS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const key = idempotencyKey(req);
    const parsed = createPurchaseOrderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid purchase order",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const created = await createPurchaseOrder(tx, {
        ...parsed.data,
        expectedAt: parsed.data.expectedAt
          ? new Date(parsed.data.expectedAt)
          : null,
        creationKey: key,
        actor: auth.session,
      });
      if (!created.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "purchasing.purchase_order.create",
          entityType: "PurchaseOrder",
          entityId: created.order.id,
          context,
          metadata: {
            orderNumber: created.order.orderNumber,
            supplierId: created.order.supplierId,
            supplierCode: created.order.supplierCode,
            status: created.order.status,
            lineCount: created.order.lineCount,
            totalCost: created.order.totalCost,
            currency: created.order.currency,
          },
        });
      }
      return created;
    });

    return NextResponse.json(
      { purchaseOrder: result.order, replayed: result.replayed },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (error instanceof PurchasingError || error instanceof InventoryLedgerError) {
      return errorResponse(error);
    }
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders] Failed to create purchase order", error);
    return NextResponse.json(
      {
        error: "Unable to create purchase order",
        code: "PURCHASE_ORDER_CREATE_FAILED",
      },
      { status: 500 }
    );
  }
}
