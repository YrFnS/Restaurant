import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ORDER_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { getStaffSession } from "@/lib/auth/session";
import {
  calculateOrderPricing,
  fromCents,
  OrderPricingError,
  orderRequestSchema,
  type OrderRequest,
} from "@/lib/orders/pricing";
import {
  createOrderAccessToken,
  OrderAccessConfigurationError,
  orderIdFromIdempotencyKey,
} from "@/lib/orders/access";
import {
  flushKdsOutboxBestEffort,
  queueKdsEvent,
  resolveKdsScreenSlugs,
} from "@/lib/kds/outbox";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
const orderQuerySchema = z
  .object({
    status: z.union([z.literal("all"), orderStatusSchema]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    from: z.string().datetime().optional(),
    countOnly: z.enum(["true", "false"]).default("false"),
  })
  .strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const ORDER_WINDOW_MS = 60_000;
const MAX_ORDERS_PER_WINDOW = 20;

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `#R-${date}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

const orderInclude = {
  items: { include: { menuItem: true } },
  table: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function publicOrderResponse(order: OrderWithRelations, replayed = false) {
  return {
    order,
    accessToken: createOrderAccessToken(order.id),
    replayed,
  };
}

async function findExistingIdempotentOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: orderInclude });
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(ORDER_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = orderQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const where: Prisma.OrderWhereInput = {
      ...(parsed.data.status && parsed.data.status !== "all"
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.from
        ? { createdAt: { gte: new Date(parsed.data.from) } }
        : {}),
    };

    if (parsed.data.countOnly === "true") {
      const count = await db.order.count({ where });
      return NextResponse.json(
        { count },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: orderInclude,
    });
    return NextResponse.json(
      { orders },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[orders] Failed to load orders", error);
    return NextResponse.json(
      { error: "Unable to load orders", code: "ORDERS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let orderLimit;
  try {
    orderLimit = await consumeRateLimit({
      scope: "order-create",
      identifier: getRequestSource(req),
      limit: MAX_ORDERS_PER_WINDOW,
      windowMs: ORDER_WINDOW_MS,
    });
  } catch (error) {
    console.error("[orders] Shared rate limiter failed", error);
    return NextResponse.json(
      { error: "Ordering is temporarily unavailable", code: "RATE_LIMIT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!orderLimit.allowed) {
    return NextResponse.json(
      { error: "Too many order attempts", code: "ORDER_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(orderLimit) }
    );
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return NextResponse.json(
      {
        error: "A valid Idempotency-Key header is required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
      { status: 400 }
    );
  }

  let input: OrderRequest;
  try {
    const parsed = orderRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid order",
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

  const orderId = orderIdFromIdempotencyKey(idempotencyKey);

  try {
    const existing = await findExistingIdempotentOrder(orderId);
    if (existing) {
      return NextResponse.json(publicOrderResponse(existing, true), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const [actor, context] = await Promise.all([
      getStaffSession().catch(() => null),
      Promise.resolve(auditContextFromRequest(req)),
    ]);
    const order = await db.$transaction(async (tx) => {
      const replay = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (replay) return replay;

      const pricing = await calculateOrderPricing(tx, input);

      let tableId: string | null = null;
      if (input.type === "dine_in") {
        const table = await tx.restaurantTable.findUnique({
          where: { number: input.tableNumber! },
          select: { id: true, status: true },
        });
        if (!table) {
          throw new OrderPricingError(
            "The selected table does not exist",
            "TABLE_NOT_FOUND",
            400
          );
        }
        if (["cleaning", "reserved", "paid"].includes(table.status)) {
          throw new OrderPricingError(
            "The selected table is not available for ordering",
            "TABLE_UNAVAILABLE",
            409
          );
        }
        tableId = table.id;
      }

      let customerId: string | null = null;
      if (input.customerPhone) {
        const customer = await tx.customer.upsert({
          where: { phone: input.customerPhone },
          update: input.customerName ? { name: input.customerName } : {},
          create: {
            name: input.customerName || "Guest",
            phone: input.customerPhone,
          },
          select: { id: true },
        });
        customerId = customer.id;
      }

      const created = await tx.order.create({
        data: {
          id: orderId,
          orderNumber: generateOrderNumber(),
          type: input.type,
          status: "confirmed",
          customerName: input.customerName || "Guest",
          customerPhone: input.customerPhone,
          deliveryAddress:
            input.type === "delivery" ? input.deliveryAddress || null : null,
          notes: input.notes || null,
          subtotal: fromCents(pricing.subtotalCents),
          taxAmount: fromCents(pricing.taxCents),
          deliveryFee: fromCents(pricing.deliveryFeeCents),
          discountAmount: fromCents(pricing.discountCents),
          tipAmount: fromCents(pricing.tipCents),
          total: fromCents(pricing.totalCents),
          paymentMethod: "cash",
          paymentStatus: "unpaid",
          serverName: "",
          tableId,
          customerId,
          estimatedReady: new Date(
            Date.now() + pricing.averagePrepMinutes * 60_000
          ),
          items: {
            create: pricing.lines.map((line) => ({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
              unitPrice: fromCents(line.unitPriceCents),
              modifiers: line.modifiers,
              notes: line.notes,
              totalPrice: fromCents(line.totalPriceCents),
              stationSlug: line.stationSlug,
              course: line.course,
              status: "pending",
            })),
          },
        },
        include: orderInclude,
      });

      if (tableId) {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: "ordered" },
        });
      }

      await writeAuditEvent(tx, {
        actor,
        action: "order.create",
        entityType: "Order",
        entityId: created.id,
        context,
        metadata: {
          orderNumber: created.orderNumber,
          type: created.type,
          status: created.status,
          subtotal: created.subtotal,
          taxAmount: created.taxAmount,
          deliveryFee: created.deliveryFee,
          discountAmount: created.discountAmount,
          tipAmount: created.tipAmount,
          total: created.total,
          itemCount: created.items.length,
          tableId,
          promoCode: pricing.promoCode,
          dynamicMultiplier: pricing.dynamicMultiplier,
          activePricingRules: pricing.activePricingRules,
        },
      });

      const targetScreenSlugs = await resolveKdsScreenSlugs(
        tx,
        created.items.map((item) => item.stationSlug)
      );
      await queueKdsEvent(tx, {
        type: "order:new",
        screenSlugs: targetScreenSlugs,
        payload: { orderId: created.id, orderNumber: created.orderNumber },
      });

      return created;
    });

    await flushKdsOutboxBestEffort(10);

    return NextResponse.json(publicOrderResponse(order), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        { error: "Order access is not configured", code: "ORDER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await findExistingIdempotentOrder(orderId);
      if (replay) {
        return NextResponse.json(publicOrderResponse(replay, true), {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json(
        { error: "Unable to allocate an order reference", code: "ORDER_REFERENCE_CONFLICT" },
        { status: 409 }
      );
    }

    console.error("[orders] Failed to create order", error);
    return NextResponse.json(
      { error: "Unable to place order", code: "ORDER_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
