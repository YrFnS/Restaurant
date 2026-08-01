import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  cancelPurchaseOrder,
  PurchasingError,
  purchasingErrorFromDatabase,
  readPurchaseOrders,
  replaceDraftPurchaseOrder,
  submitPurchaseOrder,
} from "@/lib/inventory/purchasing";
import {
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
} from "@/lib/inventory/stock-ledger";

const purchaseLineSchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    unitCost: z.number().finite().positive().max(1_000_000_000),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const updateDraftSchema = z
  .object({
    action: z.literal("update_draft"),
    supplierId: z.string().trim().min(1).max(191),
    currency: z.string().trim().min(3).max(8).optional(),
    notes: z.string().trim().max(4_000).nullable().optional(),
    expectedAt: z.string().datetime({ offset: true }).nullable().optional(),
    lines: z.array(purchaseLineSchema).min(1).max(200),
  })
  .strict();

const submitSchema = z.object({ action: z.literal("submit") }).strict();
const cancelSchema = z
  .object({
    action: z.literal("cancel"),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
const lifecycleSchema = z.discriminatedUnion("action", [
  updateDraftSchema,
  submitSchema,
  cancelSchema,
]);

function errorResponse(error: PurchasingError | InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

function mappedError(error: unknown) {
  return purchasingErrorFromDatabase(error) || inventoryLedgerErrorFromDatabase(error);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const purchaseOrders = await readPurchaseOrders(db, { id });
    if (!purchaseOrders[0]) {
      return NextResponse.json(
        { error: "Purchase order not found", code: "PURCHASE_ORDER_NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { purchaseOrder: purchaseOrders[0] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders/:id] Failed to load purchase order", error);
    return NextResponse.json(
      {
        error: "Unable to load purchase order",
        code: "PURCHASE_ORDER_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = lifecycleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid purchase-order update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.action === "update_draft") {
        const purchaseOrder = await replaceDraftPurchaseOrder(tx, id, {
          ...parsed.data,
          expectedAt: parsed.data.expectedAt
            ? new Date(parsed.data.expectedAt)
            : null,
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "purchasing.purchase_order.update_draft",
          entityType: "PurchaseOrder",
          entityId: purchaseOrder.id,
          context,
          metadata: {
            orderNumber: purchaseOrder.orderNumber,
            supplierId: purchaseOrder.supplierId,
            lineCount: purchaseOrder.lineCount,
            totalCost: purchaseOrder.totalCost,
            currency: purchaseOrder.currency,
          },
        });
        return { purchaseOrder, replayed: false };
      }

      if (parsed.data.action === "submit") {
        const submitted = await submitPurchaseOrder(tx, id, auth.session);
        if (!submitted.replayed) {
          await writeAuditEvent(tx, {
            actor: auth.session,
            action: "purchasing.purchase_order.submit",
            entityType: "PurchaseOrder",
            entityId: submitted.order.id,
            context,
            metadata: {
              orderNumber: submitted.order.orderNumber,
              supplierId: submitted.order.supplierId,
              lineCount: submitted.order.lineCount,
              totalCost: submitted.order.totalCost,
              currency: submitted.order.currency,
            },
          });
        }
        return { purchaseOrder: submitted.order, replayed: submitted.replayed };
      }

      const cancelled = await cancelPurchaseOrder(tx, id, {
        reason: parsed.data.reason,
        actor: auth.session,
      });
      if (!cancelled.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "purchasing.purchase_order.cancel",
          entityType: "PurchaseOrder",
          entityId: cancelled.order.id,
          context,
          metadata: {
            orderNumber: cancelled.order.orderNumber,
            previousStatus: "draft_or_submitted",
            reason: parsed.data.reason,
          },
        });
      }
      return { purchaseOrder: cancelled.order, replayed: cancelled.replayed };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PurchasingError || error instanceof InventoryLedgerError) {
      return errorResponse(error);
    }
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders/:id] Failed to update purchase order", error);
    return NextResponse.json(
      {
        error: "Unable to update purchase order",
        code: "PURCHASE_ORDER_UPDATE_FAILED",
      },
      { status: 500 }
    );
  }
}
