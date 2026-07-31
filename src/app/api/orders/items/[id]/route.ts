import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  flushKdsOutboxBestEffort,
  queueKdsEvent,
  resolveKdsScreenSlugs,
} from "@/lib/kds/outbox";
import {
  consumeOrderItemInventory,
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
} from "@/lib/inventory/stock-ledger";

const ITEM_OPERATION_ROLES = [
  "owner",
  "admin",
  "manager",
  "server",
  "cook",
  "bartender",
] as const;

const itemStatusSchema = z
  .object({
    status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
  })
  .strict();

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

function inventoryErrorResponse(error: InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(ITEM_OPERATION_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = itemStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid item update", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const existing = await db.orderItem.findUnique({
      where: { id },
      select: { id: true, orderId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Order item not found", code: "ORDER_ITEM_NOT_FOUND" },
        { status: 404 }
      );
    }

    const nextStatus = parsed.data.status;
    if (nextStatus !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          {
            error: `Item cannot move from ${existing.status} to ${nextStatus}`,
            code: "INVALID_STATUS_TRANSITION",
          },
          { status: 409 }
        );
      }
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const consumption = ["preparing", "ready", "served"].includes(nextStatus)
        ? await consumeOrderItemInventory(tx, {
            orderItemId: id,
            actor: auth.session,
          })
        : null;
      const inventory = consumption
        ? {
            tracked: consumption.tracked,
            recipeId: consumption.recipeId,
            recipeVersion: consumption.recipeVersion,
            movementCount: consumption.movements.length,
            replayedMovementCount: consumption.replayedMovementCount,
          }
        : null;

      const updated = await tx.orderItem.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === "preparing" && existing.status !== "preparing"
            ? { firedAt: new Date() }
            : {}),
          ...(nextStatus === "ready" && existing.status !== "ready"
            ? { readyAt: new Date() }
            : {}),
          ...(nextStatus === "cancelled" ? { hold: false } : {}),
        },
        include: { menuItem: true },
      });

      const siblings = await tx.orderItem.findMany({
        where: { orderId: existing.orderId },
        select: { status: true },
      });
      const activeSiblings = siblings.filter(
        (sibling) => sibling.status !== "cancelled"
      );

      if (
        activeSiblings.length > 0 &&
        activeSiblings.every((sibling) =>
          ["ready", "served"].includes(sibling.status)
        )
      ) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: "ready" },
        });
      } else if (nextStatus === "preparing") {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: "preparing" },
        });
      }

      if (
        inventory &&
        inventory.movementCount > inventory.replayedMovementCount
      ) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "inventory.production.consume_item",
          entityType: "OrderItem",
          entityId: id,
          context,
          metadata: {
            orderId: existing.orderId,
            ...inventory,
          },
        });
      }

      const targetScreenSlugs = await resolveKdsScreenSlugs(tx, [
        updated.stationSlug,
      ]);
      await queueKdsEvent(tx, {
        type: "order:update",
        screenSlugs: targetScreenSlugs,
        payload: {
          orderId: existing.orderId,
          itemId: updated.id,
          status: nextStatus,
        },
      });

      return { item: updated, inventory };
    });

    await flushKdsOutboxBestEffort(10);

    return NextResponse.json({
      item: result.item,
      inventory: result.inventory,
    });
  } catch (error) {
    if (error instanceof InventoryLedgerError) {
      return inventoryErrorResponse(error);
    }
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return inventoryErrorResponse(mapped);
    console.error("[order-items] Failed to update item", error);
    return NextResponse.json(
      { error: "Unable to update order item", code: "ORDER_ITEM_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const auth = await requireStaffSession(["owner", "admin"]);
  if ("response" in auth) return auth.response;

  return NextResponse.json(
    {
      error: "Order item deletion is disabled; cancel the item instead",
      code: "ORDER_ITEM_DELETE_DISABLED",
    },
    { status: 405, headers: { Allow: "PATCH" } }
  );
}
