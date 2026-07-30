import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  KITCHEN_OPERATION_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import {
  flushKdsOutboxBestEffort,
  queueKdsEvent,
  resolveKdsScreenSlugs,
} from "@/lib/kds/outbox";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const kitchenQuerySchema = z
  .object({
    station: slugSchema.optional(),
    screen: slugSchema.optional(),
    completed: z.enum(["true", "false"]).optional(),
  })
  .strict()
  .refine((value) => !(value.station && value.screen), {
    message: "Use either station or screen, not both",
  });

const itemPatchSchema = z
  .object({
    itemId: z.string().trim().min(1).max(191),
    status: z.enum(["preparing", "ready", "served", "cancelled"]),
  })
  .strict();

const orderPatchSchema = z
  .object({
    orderId: z.string().trim().min(1).max(191),
    status: z.literal("completed"),
  })
  .strict();

const kitchenPatchSchema = z.union([itemPatchSchema, orderPatchSchema]);

const ITEM_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: [],
};

const KDS_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  type: true,
  status: true,
  customerName: true,
  notes: true,
  serverName: true,
  tableId: true,
  estimatedReady: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  table: {
    select: {
      id: true,
      number: true,
      section: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(KITCHEN_OPERATION_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = kitchenQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid kitchen query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    let stationFilter: string[] = [];
    let maximumOrders = 200;

    if (parsed.data.screen) {
      const screen = await db.kitchenScreen.findUnique({
        where: { slug: parsed.data.screen },
        select: {
          isActive: true,
          stationFilter: true,
          maxOrders: true,
        },
      });

      if (!screen?.isActive) {
        return NextResponse.json(
          { error: "Kitchen screen not found", code: "KDS_SCREEN_NOT_FOUND" },
          { status: 404 }
        );
      }

      stationFilter = screen.stationFilter
        ? screen.stationFilter.split(",").filter(Boolean)
        : [];
      if (screen.maxOrders > 0) {
        maximumOrders = Math.min(screen.maxOrders, 200);
      }
    } else if (parsed.data.station) {
      stationFilter = [parsed.data.station];
    }

    const includeCompleted = parsed.data.completed === "true";
    const orderItemWhere: Prisma.OrderItemWhereInput = {
      ...(stationFilter.length > 0
        ? { stationSlug: { in: stationFilter } }
        : {}),
      status: includeCompleted
        ? { not: "cancelled" }
        : { notIn: ["served", "cancelled"] },
    };
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);

    const [orders, totalToday] = await Promise.all([
      db.order.findMany({
        where: {
          status: {
            in: includeCompleted
              ? ["confirmed", "preparing", "ready", "completed"]
              : ["confirmed", "preparing", "ready"],
          },
          items: { some: orderItemWhere },
        },
        orderBy: { createdAt: "asc" },
        take: maximumOrders,
        select: {
          ...KDS_ORDER_SELECT,
          items: {
            where: orderItemWhere,
            orderBy: [{ course: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              orderId: true,
              menuItemId: true,
              quantity: true,
              modifiers: true,
              notes: true,
              status: true,
              stationSlug: true,
              course: true,
              hold: true,
              firedAt: true,
              readyAt: true,
              seatNumber: true,
              createdAt: true,
              updatedAt: true,
              menuItem: {
                select: {
                  id: true,
                  nameEn: true,
                  nameAr: true,
                  allergens: true,
                  dietary: true,
                },
              },
            },
          },
        },
      }),
      db.order.count({
        where: {
          createdAt: { gte: startToday },
          status: { not: "cancelled" },
        },
      }),
    ]);

    const allDay: Record<
      string,
      { nameEn: string; nameAr: string; count: number }
    > = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!allDay[item.menuItemId]) {
          allDay[item.menuItemId] = {
            nameEn: item.menuItem.nameEn,
            nameAr: item.menuItem.nameAr,
            count: 0,
          };
        }
        allDay[item.menuItemId].count += item.quantity;
      });
    });

    return NextResponse.json(
      { orders, allDay: Object.values(allDay), totalToday },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[kitchen] Failed to load KDS orders", error);
    return NextResponse.json(
      { error: "Unable to load kitchen orders", code: "KDS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession(KITCHEN_OPERATION_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = kitchenPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid kitchen update", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if ("itemId" in parsed.data) {
      const { itemId, status: nextStatus } = parsed.data;
      const existing = await db.orderItem.findUnique({
        where: { id: itemId },
        select: { id: true, orderId: true, status: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Order item not found", code: "ORDER_ITEM_NOT_FOUND" },
          { status: 404 }
        );
      }

      if (nextStatus !== existing.status) {
        const allowed = ITEM_TRANSITIONS[existing.status] || [];
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

      const item = await db.$transaction(async (tx) => {
        const updated = await tx.orderItem.update({
          where: { id: itemId },
          data: {
            status: nextStatus,
            ...(nextStatus === "preparing" ? { firedAt: new Date() } : {}),
            ...(nextStatus === "ready" ? { readyAt: new Date() } : {}),
            ...(nextStatus === "cancelled" ? { hold: false } : {}),
          },
          select: {
            id: true,
            orderId: true,
            menuItemId: true,
            quantity: true,
            modifiers: true,
            notes: true,
            status: true,
            stationSlug: true,
            course: true,
            hold: true,
            firedAt: true,
            readyAt: true,
            seatNumber: true,
            menuItem: {
              select: {
                id: true,
                nameEn: true,
                nameAr: true,
                allergens: true,
                dietary: true,
              },
            },
          },
        });

        const siblings = await tx.orderItem.findMany({
          where: { orderId: existing.orderId },
          select: { status: true },
        });
        const activeItems = siblings.filter(
          (sibling) => sibling.status !== "cancelled"
        );

        if (
          activeItems.length > 0 &&
          activeItems.every((sibling) =>
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

        return updated;
      });

      await flushKdsOutboxBestEffort(10);

      return NextResponse.json({ item });
    }

    const { orderId } = parsed.data;
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, tableId: true },
    });
    if (!existingOrder) {
      return NextResponse.json(
        { error: "Order not found", code: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (!["confirmed", "preparing", "ready"].includes(existingOrder.status)) {
      return NextResponse.json(
        {
          error: `Order cannot be completed from ${existingOrder.status}`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 409 }
      );
    }

    const order = await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "completed", completedAt: new Date() },
      });
      await tx.orderItem.updateMany({
        where: { orderId, status: { not: "cancelled" } },
        data: { status: "served" },
      });
      if (existingOrder.tableId) {
        await tx.restaurantTable.update({
          where: { id: existingOrder.tableId },
          data: { status: "cleaning", seatedAt: null },
        });
      }

      await queueKdsEvent(tx, {
        type: "order:status",
        screenSlugs: [],
        payload: { orderId, status: "completed" },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          ...KDS_ORDER_SELECT,
          items: {
            orderBy: [{ course: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              orderId: true,
              menuItemId: true,
              quantity: true,
              modifiers: true,
              notes: true,
              status: true,
              stationSlug: true,
              course: true,
              hold: true,
              firedAt: true,
              readyAt: true,
              seatNumber: true,
              menuItem: {
                select: {
                  id: true,
                  nameEn: true,
                  nameAr: true,
                  allergens: true,
                  dietary: true,
                },
              },
            },
          },
        },
      });
    });

    await flushKdsOutboxBestEffort(10);

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[kitchen] Failed to update KDS state", error);
    return NextResponse.json(
      { error: "Unable to update kitchen state", code: "KDS_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
