import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ORDER_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { flushKdsOutboxBestEffort, queueKdsEvent } from "@/lib/kds/outbox";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  consumeOrderInventory,
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
} from "@/lib/inventory/stock-ledger";

const orderStatusSchema = z
  .object({
    status: z.enum([
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "completed",
      "cancelled",
    ]),
  })
  .strict();

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
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
  const auth = await requireStaffSession(ORDER_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = orderStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid order update", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const existing = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        tableId: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Order not found", code: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const nextStatus = parsed.data.status;
    if (nextStatus !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          {
            error: `Order cannot move from ${existing.status} to ${nextStatus}`,
            code: "INVALID_STATUS_TRANSITION",
          },
          { status: 409 }
        );
      }
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const inventory =
        nextStatus === "completed"
          ? await consumeOrderInventory(tx, {
              orderId: id,
              actor: auth.session,
            })
          : null;

      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === "completed" && existing.status !== "completed"
            ? { completedAt: new Date() }
            : {}),
        },
      });

      if (nextStatus === "completed") {
        await tx.orderItem.updateMany({
          where: { orderId: id, status: { not: "cancelled" } },
          data: { status: "served" },
        });
        if (existing.tableId) {
          await tx.restaurantTable.update({
            where: { id: existing.tableId },
            data: { status: "cleaning", seatedAt: null },
          });
        }
      } else if (nextStatus === "cancelled") {
        await tx.orderItem.updateMany({
          where: { orderId: id, status: { not: "served" } },
          data: { status: "cancelled", hold: false },
        });
        if (existing.tableId) {
          const otherActiveOrders = await tx.order.count({
            where: {
              tableId: existing.tableId,
              id: { not: id },
              status: { in: ["pending", "confirmed", "preparing", "ready"] },
            },
          });
          if (otherActiveOrders === 0) {
            await tx.restaurantTable.update({
              where: { id: existing.tableId },
              data: { status: "open", seatedAt: null },
            });
          }
        }
      }

      if (nextStatus !== existing.status) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "order.status.update",
          entityType: "Order",
          entityId: id,
          context,
          metadata: {
            orderNumber: existing.orderNumber,
            previousStatus: existing.status,
            status: nextStatus,
            paymentStatus: existing.paymentStatus,
            total: existing.total,
            tableId: existing.tableId,
            inventory,
          },
        });
      }

      if (
        inventory &&
        inventory.movementCount > inventory.replayedMovementCount
      ) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "inventory.production.consume_order",
          entityType: "Order",
          entityId: id,
          context,
          metadata: inventory,
        });
      }

      await queueKdsEvent(tx, {
        type: "order:status",
        screenSlugs: [],
        payload: { orderId: id, status: nextStatus },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: { include: { menuItem: true } }, table: true },
      });
      return { order, inventory };
    });

    await flushKdsOutboxBestEffort(10);

    return NextResponse.json({
      order: result.order,
      inventory: result.inventory,
    });
  } catch (error) {
    if (error instanceof InventoryLedgerError) {
      return inventoryErrorResponse(error);
    }
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return inventoryErrorResponse(mapped);
    console.error("[orders] Failed to update order", error);
    return NextResponse.json(
      { error: "Unable to update order", code: "ORDER_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const auth = await requireStaffSession(["owner", "admin"]);
  if ("response" in auth) return auth.response;

  return NextResponse.json(
    {
      error: "Order deletion is disabled; cancel or refund the order instead",
      code: "ORDER_DELETE_DISABLED",
    },
    { status: 405, headers: { Allow: "PATCH" } }
  );
}
