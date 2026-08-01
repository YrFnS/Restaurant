import { NextRequest, NextResponse } from "next/server";
import {
  PaymentEventStatus,
  PaymentEventType,
  PaymentMethod,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireStaffSession,
  CASH_MANAGEMENT_ROLES,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  CashRegisterError,
  lockOpenRegisterSession,
  readPaymentRegisterLink,
  registerIdentityFromRequest,
  serializeRegister,
  serializeSession,
} from "@/lib/cash/register-session";
import {
  appendCheckoutLedgers,
  checkoutFingerprintFromRequest,
  loyaltyLedgerErrorResponse,
  minorToNumber,
  parseMoneyToMinor,
  parseStoredValueCaptureMetadata,
  prepareCheckoutCredits,
  storedValueCaptureMetadata,
} from "@/lib/loyalty/ledger";

const checkoutSchema = z
  .object({
    orderId: z.string().trim().min(1).max(191),
    paymentMethod: z.literal("cash"),
    tendered: z.number().finite().nonnegative().max(1_000_000).optional(),
    loyaltyPoints: z.number().int().min(0).max(1_000_000_000).default(0),
    giftCardCode: z.string().trim().min(6).max(128).optional(),
    giftCardAmount: z.number().finite().positive().max(1_000_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.giftCardAmount !== undefined && !value.giftCardCode) {
      ctx.addIssue({
        code: "custom",
        path: ["giftCardCode"],
        message: "Gift-card code is required when an amount is supplied",
      });
    }
  });

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,191}$/;

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function registerErrorResponse(error: CashRegisterError) {
  return noStore(
    { error: error.message, code: error.code, details: error.details },
    error.status
  );
}

function requestKey(req: NextRequest): string | null {
  const key = req.headers.get("idempotency-key")?.trim() || "";
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

function cents(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CashRegisterError(
      "Stored payment amount cannot be represented safely",
      "UNSAFE_PAYMENT_VALUE",
      500
    );
  }
  return Number(value);
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  let parsed: z.infer<typeof checkoutSchema>;
  try {
    const result = checkoutSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid checkout request",
          code: "VALIDATION_ERROR",
          details: result.error.flatten().fieldErrors,
        },
        400
      );
    }
    parsed = result.data;
  } catch {
    return noStore({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  const key = requestKey(req);
  if (!key) {
    return noStore(
      {
        error: "A valid Idempotency-Key header is required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
      400
    );
  }

  const identity = registerIdentityFromRequest(req);
  const context = auditContextFromRequest(req);

  try {
    const result = await db.$transaction(
      async (tx) => {
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

        const existingOrder = await tx.order.findUnique({
          where: { id: parsed.orderId },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalMinor: true,
            tableId: true,
          },
        });
        if (!existingOrder) {
          throw new CashRegisterError("Order not found", "ORDER_NOT_FOUND", 404);
        }
        if (existingOrder.status === "cancelled") {
          throw new CashRegisterError(
            "Cancelled orders cannot be paid",
            "ORDER_CANCELLED",
            409
          );
        }

        const existingCapture = await tx.paymentEvent.findFirst({
          where: {
            orderId: parsed.orderId,
            eventType: PaymentEventType.capture,
            status: PaymentEventStatus.succeeded,
          },
          orderBy: { createdAt: "asc" },
        });

        if (existingCapture) {
          const paymentLink = await readPaymentRegisterLink(tx, existingCapture.id);
          if (
            paymentLink &&
            paymentLink.registerId !== registerContext.register.id
          ) {
            throw new CashRegisterError(
              "This payment belongs to another register",
              "PAYMENT_REGISTER_MISMATCH",
              409
            );
          }
          const metadata = parseStoredValueCaptureMetadata(existingCapture.metadata);
          const fingerprint = checkoutFingerprintFromRequest({
            orderId: parsed.orderId,
            loyaltyPoints: parsed.loyaltyPoints,
            giftCardCode: parsed.giftCardCode,
            giftCardAmount: parsed.giftCardAmount,
            captureAmountMinor: existingOrder.totalMinor,
          });
          if (
            metadata.checkoutFingerprint &&
            metadata.checkoutFingerprint !== fingerprint
          ) {
            throw new CashRegisterError(
              "Checkout was already completed with another stored-value payload",
              "CHECKOUT_IDEMPOTENCY_CONFLICT",
              409
            );
          }
          return {
            replayed: true,
            order: {
              id: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              paymentStatus: existingOrder.paymentStatus,
              total: minorToNumber(existingOrder.totalMinor),
            },
            payment: {
              eventId: existingCapture.id,
              method: existingCapture.method,
              status: existingCapture.status,
              currency: existingCapture.currency,
              captured: existingCapture.amountCents / 100,
              cashAmount: metadata.cashAmountCents / 100,
              giftCardAmount: metadata.giftCardAmountCents / 100,
              giftCardLast4: metadata.giftCardLast4,
              loyaltyRedeemedPoints: metadata.loyaltyRedeemedPoints,
              loyaltyRedemptionValue:
                metadata.loyaltyRedemptionValueCents / 100,
              loyaltyEarnedPoints: metadata.loyaltyEarnedPoints,
              tendered:
                existingCapture.tenderedCents !== null
                  ? existingCapture.tenderedCents / 100
                  : metadata.cashAmountCents / 100,
              change:
                existingCapture.changeCents !== null
                  ? existingCapture.changeCents / 100
                  : 0,
              registerSessionId: existingCapture.registerSessionId,
            },
            register: serializeRegister(registerContext.register),
            session: serializeSession(registerContext.session),
          };
        }

        if (existingOrder.paymentStatus !== "unpaid") {
          throw new CashRegisterError(
            "Order has already been paid or reversed",
            "ORDER_ALREADY_PAID",
            409
          );
        }

        const plan = await prepareCheckoutCredits(tx, {
          orderId: parsed.orderId,
          loyaltyPoints: parsed.loyaltyPoints,
          giftCardCode: parsed.giftCardCode,
          giftCardAmount: parsed.giftCardAmount,
        });
        if (plan.captureAmountMinor <= 0n) {
          throw new CashRegisterError(
            "A checkout capture must be greater than zero",
            "CHECKOUT_AMOUNT_REQUIRED",
            409
          );
        }

        let tenderedMinor = plan.cashAmountMinor;
        let changeMinor = 0n;
        if (plan.cashAmountMinor > 0n) {
          if (parsed.tendered === undefined) {
            throw new CashRegisterError(
              "Cash tendered is required for the remaining amount",
              "CASH_TENDER_REQUIRED",
              400,
              { amountDue: minorToNumber(plan.cashAmountMinor) }
            );
          }
          tenderedMinor = parseMoneyToMinor(parsed.tendered);
          if (tenderedMinor < plan.cashAmountMinor) {
            throw new CashRegisterError(
              "Cash tendered is less than the remaining amount due",
              "INSUFFICIENT_TENDER",
              409,
              {
                amountDue: minorToNumber(plan.cashAmountMinor),
                tendered: minorToNumber(tenderedMinor),
              }
            );
          }
          changeMinor = tenderedMinor - plan.cashAmountMinor;
        }

        const paymentMethod = plan.paymentMethod as PaymentMethod;
        const order = await tx.order.update({
          where: { id: plan.order.id },
          data: {
            paymentMethod,
            paymentStatus: "paid",
            serverName: auth.session.name,
          },
          select: {
            id: true,
            orderNumber: true,
            paymentStatus: true,
            totalMinor: true,
            tableId: true,
          },
        });

        if (order.tableId) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: { status: "paid" },
          });
        }

        let cashDrawerEntryId: string | null = null;
        if (plan.cashAmountMinor > 0n) {
          const drawer = await tx.cashDrawerEntry.create({
            data: {
              type: "sale",
              amount: minorToNumber(plan.cashAmountMinor),
              amountMinor: plan.cashAmountMinor,
              note: `Sale ${order.orderNumber}`,
              createdBy: auth.session.name,
              registerSessionId: registerContext.session.id,
            },
          });
          cashDrawerEntryId = drawer.id;
        }

        const storedValue = storedValueCaptureMetadata(plan);
        const paymentEvent = await tx.paymentEvent.create({
          data: {
            id: plan.paymentEventId,
            idempotencyKey: `payment-capture:${plan.order.id}`,
            orderId: plan.order.id,
            eventType: PaymentEventType.capture,
            method: paymentMethod,
            status: PaymentEventStatus.succeeded,
            amountCents: cents(plan.captureAmountMinor),
            tenderedCents:
              paymentMethod === PaymentMethod.cash ? cents(tenderedMinor) : null,
            changeCents:
              paymentMethod === PaymentMethod.cash ? cents(changeMinor) : null,
            currency: plan.policy.currency,
            actorId: auth.session.id,
            actorName: auth.session.name,
            registerSessionId: registerContext.session.id,
            metadata: {
              orderNumber: order.orderNumber,
              tableId: order.tableId,
              cashDrawerEntryId,
              registerId: registerContext.register.id,
              registerCode: registerContext.register.code,
              registerSessionId: registerContext.session.id,
              requestId: context.requestId,
              checkoutKey: key,
              storedValue,
            },
          },
        });

        const ledgers = await appendCheckoutLedgers(tx, {
          plan,
          actor: auth.session,
          context,
        });

        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "order.payment.capture",
          entityType: "PaymentEvent",
          entityId: paymentEvent.id,
          context,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentMethod,
            capturedAmountMinor: plan.captureAmountMinor.toString(),
            cashAmountMinor: plan.cashAmountMinor.toString(),
            giftCardAmountMinor: plan.giftCardAmountMinor.toString(),
            loyaltyRedeemedPoints: plan.loyaltyRedeemedPoints,
            loyaltyEarnedPoints: plan.loyaltyEarnedPoints,
            registerId: registerContext.register.id,
            registerCode: registerContext.register.code,
            registerSessionId: registerContext.session.id,
          },
        });

        return {
          replayed: false,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            total: minorToNumber(order.totalMinor),
          },
          payment: {
            eventId: paymentEvent.id,
            method: paymentEvent.method,
            status: paymentEvent.status,
            currency: paymentEvent.currency,
            captured: minorToNumber(plan.captureAmountMinor),
            cashAmount: minorToNumber(plan.cashAmountMinor),
            giftCardAmount: minorToNumber(plan.giftCardAmountMinor),
            giftCardLast4: plan.giftCard?.redemptionCodeLast4 || null,
            loyaltyRedeemedPoints: plan.loyaltyRedeemedPoints,
            loyaltyRedemptionValue: minorToNumber(
              plan.loyaltyRedemptionValueMinor
            ),
            loyaltyEarnedPoints: plan.loyaltyEarnedPoints,
            tendered: minorToNumber(tenderedMinor),
            change: minorToNumber(changeMinor),
            registerSessionId: registerContext.session.id,
            ledgers,
          },
          register: serializeRegister(registerContext.register),
          session: serializeSession(registerContext.session),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      }
    );

    return noStore(result);
  } catch (error) {
    if (error instanceof CashRegisterError) return registerErrorResponse(error);
    const loyaltyError = loyaltyLedgerErrorResponse(error);
    if (loyaltyError) return noStore(loyaltyError.body, loyaltyError.status);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return noStore(
        {
          error: "Checkout has already been recorded",
          code: "CHECKOUT_ALREADY_RECORDED",
        },
        409
      );
    }
    console.error("[pos/checkout] Failed to complete checkout", error);
    return noStore(
      { error: "Unable to complete checkout", code: "CHECKOUT_FAILED" },
      500
    );
  }
}
