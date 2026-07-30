import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CASH_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";

const checkoutSchema = z
  .object({
    orderId: z.string().trim().min(1).max(191),
    paymentMethod: z.enum(["cash", "card"]),
    tendered: z.number().finite().min(0).max(1_000_000).optional(),
  })
  .strict();

const checkoutOrderInclude = {
  items: { include: { menuItem: true } },
  table: true,
} as const;

function toCents(value: number): number {
  return Math.round(value * 100);
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  let input: z.infer<typeof checkoutSchema>;
  try {
    const parsed = checkoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout request",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    input = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  if (input.paymentMethod === "card") {
    return NextResponse.json(
      {
        error: "Card checkout is disabled until a payment processor is configured",
        code: "CARD_PROCESSOR_NOT_CONFIGURED",
      },
      { status: 501 }
    );
  }

  try {
    const existing = await db.order.findUnique({
      where: { id: input.orderId },
      include: checkoutOrderInclude,
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Order not found", code: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Cancelled orders cannot be paid", code: "ORDER_CANCELLED" },
        { status: 409 }
      );
    }

    const totalCents = toCents(existing.total);
    const tenderedCents = toCents(input.tendered ?? 0);
    if (tenderedCents < totalCents) {
      return NextResponse.json(
        {
          error: "Tendered cash is less than the order total",
          code: "INSUFFICIENT_TENDER",
          total: existing.total,
        },
        { status: 400 }
      );
    }

    if (existing.paymentStatus === "paid") {
      return NextResponse.json(
        {
          order: existing,
          payment: {
            method: existing.paymentMethod,
            total: existing.total,
            tendered: input.tendered ?? existing.total,
            change: Math.max(0, (input.tendered ?? existing.total) - existing.total),
          },
          replayed: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: input.orderId, paymentStatus: "unpaid" },
        data: {
          paymentStatus: "paid",
          paymentMethod: "cash",
          serverName: auth.session.name,
        },
      });

      if (claimed.count === 0) {
        const replay = await tx.order.findUnique({
          where: { id: input.orderId },
          include: checkoutOrderInclude,
        });
        return { order: replay, replayed: true };
      }

      await tx.cashDrawerEntry.create({
        data: {
          type: "sale",
          amount: existing.total,
          note: `Sale ${existing.orderNumber}${existing.table ? ` / Table ${existing.table.number}` : ""}`,
          createdBy: auth.session.name,
        },
      });

      if (existing.tableId) {
        await tx.restaurantTable.update({
          where: { id: existing.tableId },
          data: { status: "paid" },
        });
      }

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: checkoutOrderInclude,
      });
      return { order, replayed: false };
    });

    if (!result.order) {
      return NextResponse.json(
        { error: "Unable to load paid order", code: "CHECKOUT_RESULT_MISSING" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        order: result.order,
        payment: {
          method: "cash",
          total: result.order.total,
          tendered: input.tendered ?? result.order.total,
          change: Math.max(
            0,
            (input.tendered ?? result.order.total) - result.order.total
          ),
        },
        replayed: result.replayed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[pos/checkout] Checkout failed", error);
    return NextResponse.json(
      { error: "Unable to complete checkout", code: "CHECKOUT_FAILED" },
      { status: 500 }
    );
  }
}
