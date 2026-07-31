import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  postPurchaseReceipt,
  PurchasingError,
  purchasingErrorFromDatabase,
  readPurchaseReceipts,
  reversePurchaseReceipt,
} from "@/lib/inventory/purchasing";
import {
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
} from "@/lib/inventory/stock-ledger";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const receiveSchema = z
  .object({
    action: z.literal("receive"),
    lines: z
      .array(
        z
          .object({
            purchaseOrderLineId: z.string().trim().min(1).max(191),
            quantity: z.number().finite().positive().max(1_000_000_000),
          })
          .strict()
      )
      .min(1)
      .max(200),
    notes: z.string().trim().max(4_000).nullable().optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const reverseSchema = z
  .object({
    action: z.literal("reverse"),
    receiptId: z.string().trim().min(1).max(191),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

const receiptMutationSchema = z.discriminatedUnion("action", [
  receiveSchema,
  reverseSchema,
]);

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const receipts = await readPurchaseReceipts(db, {
      purchaseOrderId: id,
      includeLines: true,
      limit: 300,
    });
    return NextResponse.json(
      { receipts },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders/:id/receipts] Failed to load receipts", error);
    return NextResponse.json(
      {
        error: "Unable to load purchase receipts",
        code: "PURCHASE_RECEIPTS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const key = idempotencyKey(req);
    const parsed = receiptMutationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid purchase receipt",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.action === "receive") {
        const posted = await postPurchaseReceipt(tx, id, {
          idempotencyKey: key,
          lines: parsed.data.lines,
          notes: parsed.data.notes,
          occurredAt: parsed.data.occurredAt
            ? new Date(parsed.data.occurredAt)
            : undefined,
          actor: auth.session,
        });
        if (!posted.replayed) {
          await writeAuditEvent(tx, {
            actor: auth.session,
            action: "purchasing.receipt.post",
            entityType: "PurchaseReceipt",
            entityId: posted.receipt.id,
            context,
            metadata: {
              receiptNumber: posted.receipt.receiptNumber,
              purchaseOrderId: posted.order.id,
              orderNumber: posted.order.orderNumber,
              lineCount: posted.receipt.lineCount,
              totalCost: posted.receipt.totalCost,
              currency: posted.receipt.currency,
              stockMovementIds: posted.receipt.lines.map(
                (line) => line.stockMovementId
              ),
              resultingStatus: posted.order.status,
            },
          });
        }
        return {
          receipt: posted.receipt,
          purchaseOrder: posted.order,
          replayed: posted.replayed,
        };
      }

      const reversed = await reversePurchaseReceipt(tx, id, {
        receiptId: parsed.data.receiptId,
        idempotencyKey: key,
        reason: parsed.data.reason,
        actor: auth.session,
      });
      if (!reversed.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "purchasing.receipt.reverse",
          entityType: "PurchaseReceipt",
          entityId: reversed.receipt.id,
          context,
          metadata: {
            receiptNumber: reversed.receipt.receiptNumber,
            purchaseOrderId: reversed.order.id,
            orderNumber: reversed.order.orderNumber,
            reason: parsed.data.reason,
            reversalMovementIds: reversed.movements.map(
              (movement) => movement.id
            ),
            resultingStatus: reversed.order.status,
          },
        });
      }
      return {
        receipt: reversed.receipt,
        purchaseOrder: reversed.order,
        replayed: reversed.replayed,
      };
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PurchasingError || error instanceof InventoryLedgerError) {
      return errorResponse(error);
    }
    const mapped = mappedError(error);
    if (mapped) return errorResponse(mapped);
    console.error("[purchase-orders/:id/receipts] Failed to mutate receipt", error);
    return NextResponse.json(
      {
        error: "Unable to process purchase receipt",
        code: "PURCHASE_RECEIPT_MUTATION_FAILED",
      },
      { status: 500 }
    );
  }
}
