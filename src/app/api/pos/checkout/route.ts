import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CASH_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  CashRegisterError,
  linkCashEntryToSession,
  linkPaymentEventToSession,
  lockOpenRegisterSession,
  readCurrentRegisterSession,
  readPaymentRegisterLink,
  registerIdentityFromRequest,
  serializeRegister,
  serializeSession,
} from "@/lib/cash/register-session";
import {
  exactMinorToCents,
  exactMinorToNumber,
  readExactOrderTotalMinor,
} from "@/lib/money/exact-store";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

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

const paymentEventSelect = {
  id: true,
  eventType: true,
  method: true,
  status: true,
  amountCents: true,
  tenderedCents: true,
  changeCents: true,
  currency: true,
  createdAt: true,
} as const;

function inputToCents(value: number): number {
  return exactMinorToCents(
    parseNonNegativeDecimalToScaledInteger(
      String(value),
      CURRENCY_MINOR_DIGITS,
      BigInt(Number.MAX_SAFE_INTEGER)
    )
  );
}

function fromCents(value: number | null): number | null {
  return value === null ? null : value / 100;
}

function captureKey(orderId: string): string {
  return `cash-capture:${orderId}`;
}

function registerErrorResponse(error: CashRegisterError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
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
    const identity = registerIdentityFromRequest(req);
    const [existing, exactTotalMinor] = await Promise.all([
      db.order.findUnique({
        where: { id: input.orderId },
        include: checkoutOrderInclude,
      }),
      readExactOrderTotalMinor(db, input.orderId),
    ]);
    if (!existing || exactTotalMinor === null) {
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

    const totalCents = exactMinorToCents(exactTotalMinor);
    const exactTotal = exactMinorToNumber(exactTotalMinor);
    const tenderedCents =
      input.tendered === undefined ? totalCents : inputToCents(input.tendered);
    if (tenderedCents < totalCents) {
      return NextResponse.json(
        {
          error: "Tendered cash is less than the order total",
          code: "INSUFFICIENT_TENDER",
          total: exactTotal,
        },
        { status: 400 }
      );
    }

    const tendered = tenderedCents / 100;
    const changeCents = tenderedCents - totalCents;
    const change = changeCents / 100;

    if (existing.paymentStatus === "paid") {
      const paymentEvent = await db.paymentEvent.findUnique({
        where: { idempotencyKey: captureKey(existing.id) },
        select: paymentEventSelect,
      });
      const paymentLink = paymentEvent
        ? await readPaymentRegisterLink(db, paymentEvent.id)
        : null;

      if (identity.registerId || identity.deviceId) {
        if (!identity.registerId || !identity.deviceId) {
          throw new CashRegisterError(
            "Register and device headers are required",
            "REGISTER_IDENTITY_REQUIRED",
            400
          );
        }
        await readCurrentRegisterSession(
          db,
          identity.registerId,
          identity.deviceId
        );
        if (!paymentLink || paymentLink.registerId !== identity.registerId) {
          throw new CashRegisterError(
            "This payment belongs to a different register",
            "PAYMENT_REGISTER_MISMATCH",
            409
          );
        }
      }

      return NextResponse.json(
        {
          order: existing,
          payment: {
            eventId: paymentEvent?.id || null,
            method: paymentEvent?.method || existing.paymentMethod,
            status: paymentEvent?.status || "succeeded",
            currency: paymentEvent?.currency || null,
            total: paymentEvent ? paymentEvent.amountCents / 100 : exactTotal,
            tendered:
              fromCents(paymentEvent?.tenderedCents ?? null) ?? tendered,
            change: fromCents(paymentEvent?.changeCents ?? null) ?? change,
            registerSessionId: paymentLink?.registerSessionId || null,
          },
          replayed: true,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const registerContext = await lockOpenRegisterSession(tx, {
        identity,
        actor: auth.session,
        allowLegacyFallback: true,
      });

      if (registerContext.autoOpened) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "cash.session.auto-open",
          entityType: "CashRegisterSession",
          entityId: registerContext.session.id,
          context,
          metadata: {
            registerId: registerContext.register.id,
            registerCode: registerContext.register.code,
            compatibilityFallback: true,
            openingFloatMinor: "0",
          },
        });
      }

      const claimed = await tx.order.updateMany({
        where: { id: input.orderId, paymentStatus: "unpaid" },
        data: {
          paymentStatus: "paid",
          paymentMethod: "cash",
          serverName: auth.session.name,
        },
      });

      if (claimed.count === 0) {
        const [order, paymentEvent] = await Promise.all([
          tx.order.findUnique({
            where: { id: input.orderId },
            include: checkoutOrderInclude,
          }),
          tx.paymentEvent.findUnique({
            where: { idempotencyKey: captureKey(input.orderId) },
            select: paymentEventSelect,
          }),
        ]);
        const paymentLink = paymentEvent
          ? await readPaymentRegisterLink(tx, paymentEvent.id)
          : null;
        return {
          order,
          paymentEvent,
          paymentLink,
          register: registerContext.register,
          session: registerContext.session,
          replayed: true,
        };
      }

      const drawerEntry = await tx.cashDrawerEntry.create({
        data: {
          type: "sale",
          amount: exactTotal,
          amountMinor: exactTotalMinor,
          note: `Sale ${existing.orderNumber}${existing.table ? ` / Table ${existing.table.number}` : ""}`,
          createdBy: auth.session.name,
        },
      });
      await linkCashEntryToSession(
        tx,
        drawerEntry.id,
        registerContext.session.id
      );

      const settings = await tx.restaurantSettings.findUnique({
        where: { id: "1" },
        select: { currency: true },
      });

      const paymentEvent = await tx.paymentEvent.create({
        data: {
          idempotencyKey: captureKey(existing.id),
          orderId: existing.id,
          eventType: "capture",
          method: "cash",
          status: "succeeded",
          amountCents: totalCents,
          tenderedCents,
          changeCents,
          currency: settings?.currency || "USD",
          actorId: auth.session.id,
          actorName: auth.session.name,
          metadata: {
            orderNumber: existing.orderNumber,
            tableId: existing.tableId,
            cashDrawerEntryId: drawerEntry.id,
            registerId: registerContext.register.id,
            registerSessionId: registerContext.session.id,
          },
        },
        select: paymentEventSelect,
      });
      await linkPaymentEventToSession(
        tx,
        paymentEvent.id,
        registerContext.session.id
      );

      if (existing.tableId) {
        await tx.restaurantTable.update({
          where: { id: existing.tableId },
          data: { status: "paid" },
        });
      }

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "payment.cash.capture",
        entityType: "PaymentEvent",
        entityId: paymentEvent.id,
        context,
        metadata: {
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          totalCents,
          tenderedCents,
          changeCents,
          currency: paymentEvent.currency,
          cashDrawerEntryId: drawerEntry.id,
          tableId: existing.tableId,
          registerId: registerContext.register.id,
          registerCode: registerContext.register.code,
          registerSessionId: registerContext.session.id,
        },
      });

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: checkoutOrderInclude,
      });
      return {
        order,
        paymentEvent,
        paymentLink: {
          registerSessionId: registerContext.session.id,
          registerId: registerContext.register.id,
        },
        register: registerContext.register,
        session: registerContext.session,
        replayed: false,
      };
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
          eventId: result.paymentEvent?.id || null,
          method: result.paymentEvent?.method || "cash",
          status: result.paymentEvent?.status || "succeeded",
          currency: result.paymentEvent?.currency || null,
          total: result.paymentEvent
            ? result.paymentEvent.amountCents / 100
            : exactTotal,
          tendered:
            fromCents(result.paymentEvent?.tenderedCents ?? null) ?? tendered,
          change: fromCents(result.paymentEvent?.changeCents ?? null) ?? change,
          registerSessionId: result.paymentLink?.registerSessionId || null,
        },
        register: serializeRegister(result.register),
        session: serializeSession(result.session),
        replayed: result.replayed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) return registerErrorResponse(error);
    console.error("[pos/checkout] Checkout failed", error);
    return NextResponse.json(
      { error: "Unable to complete checkout", code: "CHECKOUT_FAILED" },
      { status: 500 }
    );
  }
}
