import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { StaffSession } from "@/lib/auth/session";
import {
  CashRegisterError,
  type RegisterIdentity,
  lockOpenRegisterSession,
  parseCurrencyInputToMinor,
} from "@/lib/cash/register-session";
import {
  type AuditRequestContext,
  writeAuditEvent,
} from "@/lib/audit";

export const PAYMENT_REVERSAL_ROLES = ["owner", "admin", "manager"] as const;
export const PAYMENT_LEDGER_READ_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
] as const;

export const REVERSAL_REASON_CODES = [
  "customer_request",
  "item_unavailable",
  "quality_issue",
  "duplicate_charge",
  "operator_error",
  "order_cancelled",
  "fraud_suspected",
  "other",
] as const;

export type PaymentReversalAction = "refund" | "void";
export type PaymentReversalReasonCode = (typeof REVERSAL_REASON_CODES)[number];

type PaymentSqlClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

type PaymentActor = Pick<StaffSession, "id" | "name" | "role" | "sessionId">;

type OrderLedgerRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalMinor: bigint;
  tableId: string | null;
  customerId: string | null;
  updatedAt: Date;
};

type PaymentLedgerRow = {
  id: string;
  idempotencyKey: string;
  orderId: string;
  eventType: "capture" | "refund" | "void" | "adjustment";
  method: "cash" | "card" | "split";
  status: "pending" | "succeeded" | "failed" | "voided";
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  currency: string;
  actorId: string | null;
  actorName: string;
  parentEventId: string | null;
  reasonCode: string;
  reason: string | null;
  registerSessionId: string | null;
  createdAt: Date;
};

export class PaymentReversalError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "PaymentReversalError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function paymentEventId(): string {
  return `payment_event_${randomUUID().replaceAll("-", "")}`;
}

function centsToNumber(cents: number): number {
  return cents / 100;
}

function safeCents(value: bigint, label: string): number {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PaymentReversalError(
      `${label} cannot be represented safely`,
      "UNSAFE_PAYMENT_VALUE",
      500
    );
  }
  return Number(value);
}

async function lockOrder(
  client: PaymentSqlClient,
  orderId: string
): Promise<OrderLedgerRow> {
  const rows = await client.$queryRaw<OrderLedgerRow[]>(Prisma.sql`
    SELECT
      "id", "orderNumber", "status"::text AS "status",
      "paymentStatus"::text AS "paymentStatus",
      "paymentMethod"::text AS "paymentMethod",
      "totalMinor", "tableId", "customerId", "updatedAt"
    FROM "Order"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `);
  const order = rows[0];
  if (!order) {
    throw new PaymentReversalError("Order not found", "ORDER_NOT_FOUND", 404);
  }
  return order;
}

async function readOrder(
  client: PaymentSqlClient,
  orderId: string
): Promise<OrderLedgerRow> {
  const rows = await client.$queryRaw<OrderLedgerRow[]>(Prisma.sql`
    SELECT
      "id", "orderNumber", "status"::text AS "status",
      "paymentStatus"::text AS "paymentStatus",
      "paymentMethod"::text AS "paymentMethod",
      "totalMinor", "tableId", "customerId", "updatedAt"
    FROM "Order"
    WHERE "id" = ${orderId}
    LIMIT 1
  `);
  const order = rows[0];
  if (!order) {
    throw new PaymentReversalError("Order not found", "ORDER_NOT_FOUND", 404);
  }
  return order;
}

async function readLedgerEvents(
  client: PaymentSqlClient,
  orderId: string,
  lockCapture = false
): Promise<PaymentLedgerRow[]> {
  const locking = lockCapture ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  return client.$queryRaw<PaymentLedgerRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "orderId",
      "eventType"::text AS "eventType",
      "method"::text AS "method",
      "status"::text AS "status",
      "amountCents", "tenderedCents", "changeCents", "currency",
      "actorId", "actorName", "parentEventId", "reasonCode", "reason",
      "registerSessionId", "createdAt"
    FROM "PaymentEvent"
    WHERE "orderId" = ${orderId}
    ORDER BY "createdAt" ASC, "id" ASC
    ${locking}
  `);
}

function successfulCapture(events: readonly PaymentLedgerRow[]) {
  return events.find(
    (event) => event.eventType === "capture" && event.status === "succeeded"
  );
}

function successfulReversals(
  events: readonly PaymentLedgerRow[],
  captureId: string
) {
  return events.filter(
    (event) =>
      event.parentEventId === captureId &&
      event.status === "succeeded" &&
      (event.eventType === "refund" || event.eventType === "void")
  );
}

function eventDto(event: PaymentLedgerRow) {
  return {
    id: event.id,
    eventType: event.eventType,
    method: event.method,
    status: event.status,
    amount: centsToNumber(event.amountCents),
    tendered:
      event.tenderedCents === null ? null : centsToNumber(event.tenderedCents),
    change:
      event.changeCents === null ? null : centsToNumber(event.changeCents),
    currency: event.currency,
    actorId: event.actorId,
    actorName: event.actorName,
    originalPaymentEventId: event.parentEventId,
    reasonCode: event.reasonCode || null,
    reason: event.reason,
    registerSessionId: event.registerSessionId,
    createdAt: event.createdAt,
  };
}

function buildSummary(order: OrderLedgerRow, events: PaymentLedgerRow[]) {
  const capture = successfulCapture(events);
  const reversals = capture ? successfulReversals(events, capture.id) : [];
  const reversedCents = reversals.reduce(
    (sum, event) => sum + event.amountCents,
    0
  );
  const capturedCents = capture?.amountCents ?? 0;
  const remainingCents = Math.max(0, capturedCents - reversedCents);
  const hasVoid = reversals.some((event) => event.eventType === "void");

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: centsToNumber(safeCents(order.totalMinor, "Order total")),
      updatedAt: order.updatedAt,
    },
    capture: capture ? eventDto(capture) : null,
    reversals: reversals.map(eventDto),
    summary: {
      captured: centsToNumber(capturedCents),
      reversed: centsToNumber(reversedCents),
      remaining: centsToNumber(remainingCents),
      canRefund:
        Boolean(capture) &&
        remainingCents > 0 &&
        !hasVoid &&
        ["paid", "partially_refunded"].includes(order.paymentStatus),
      canVoid:
        Boolean(capture) &&
        reversedCents === 0 &&
        order.paymentStatus === "paid" &&
        order.status !== "completed",
    },
  };
}

export async function readPaymentLedgerSummary(
  client: PaymentSqlClient,
  orderId: string
) {
  const [order, events] = await Promise.all([
    readOrder(client, orderId),
    readLedgerEvents(client, orderId),
  ]);
  return buildSummary(order, events);
}

export async function reversePayment(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    action: PaymentReversalAction;
    amount?: number;
    reasonCode: PaymentReversalReasonCode;
    reason: string;
    idempotencyKey: string;
    identity: RegisterIdentity;
    actor: PaymentActor;
    context: AuditRequestContext;
  }
) {
  const order = await lockOrder(tx, input.orderId);
  const events = await readLedgerEvents(tx, input.orderId, true);

  const replay = events.find(
    (event) => event.idempotencyKey === input.idempotencyKey
  );
  if (replay) {
    if (replay.eventType !== input.action) {
      throw new PaymentReversalError(
        "That idempotency key was already used for another payment action",
        "IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return {
      ...buildSummary(order, events),
      reversal: eventDto(replay),
      replayed: true,
    };
  }

  const capture = successfulCapture(events);
  if (!capture) {
    throw new PaymentReversalError(
      "The order does not have a successful payment capture",
      "PAYMENT_NOT_CAPTURED",
      409
    );
  }
  if (capture.method !== "cash") {
    throw new PaymentReversalError(
      "This payment method requires its processor-specific reversal flow",
      "REVERSAL_METHOD_NOT_SUPPORTED",
      501,
      { method: capture.method }
    );
  }

  const reversals = successfulReversals(events, capture.id);
  const reversedCents = reversals.reduce(
    (sum, event) => sum + event.amountCents,
    0
  );
  const remainingCents = capture.amountCents - reversedCents;
  if (remainingCents <= 0 || reversals.some((event) => event.eventType === "void")) {
    throw new PaymentReversalError(
      "The payment has already been fully reversed",
      "PAYMENT_ALREADY_REVERSED",
      409
    );
  }

  let amountCents: number;
  if (input.action === "void") {
    if (order.status === "completed") {
      throw new PaymentReversalError(
        "Completed orders must be refunded rather than voided",
        "COMPLETED_ORDER_REQUIRES_REFUND",
        409
      );
    }
    if (reversedCents !== 0 || order.paymentStatus !== "paid") {
      throw new PaymentReversalError(
        "A void requires an untouched successful capture",
        "VOID_REQUIRES_UNTOUCHED_CAPTURE",
        409
      );
    }
    amountCents = capture.amountCents;
  } else {
    if (input.amount === undefined) {
      throw new PaymentReversalError(
        "Refund amount is required",
        "REFUND_AMOUNT_REQUIRED",
        400
      );
    }
    const amountMinor = parseCurrencyInputToMinor(input.amount);
    amountCents = safeCents(amountMinor, "Refund amount");
    if (amountCents <= 0) {
      throw new PaymentReversalError(
        "Refund amount must be greater than zero",
        "REFUND_AMOUNT_REQUIRED",
        400
      );
    }
    if (amountCents > remainingCents) {
      throw new PaymentReversalError(
        "Refund exceeds the remaining captured amount",
        "REFUND_EXCEEDS_REMAINING",
        409,
        { remaining: centsToNumber(remainingCents) }
      );
    }
  }

  const registerContext = await lockOpenRegisterSession(tx, {
    identity: input.identity,
    actor: input.actor,
  });
  const amountMinor = BigInt(amountCents);
  const amount = centsToNumber(amountCents);
  const cashEntry = await tx.cashDrawerEntry.create({
    data: {
      type: "refund",
      amount,
      amountMinor,
      note: `${input.action === "void" ? "Void" : "Refund"} ${order.orderNumber}: ${input.reason}`,
      createdBy: input.actor.id,
      registerSessionId: registerContext.session.id,
    },
  });

  const reversalId = paymentEventId();
  const metadata = JSON.stringify({
    orderNumber: order.orderNumber,
    originalPaymentEventId: capture.id,
    cashDrawerEntryId: cashEntry.id,
    registerId: registerContext.register.id,
    registerSessionId: registerContext.session.id,
    reasonCode: input.reasonCode,
  });
  const inserted = await tx.$queryRaw<PaymentLedgerRow[]>(Prisma.sql`
    INSERT INTO "PaymentEvent" (
      "id", "idempotencyKey", "orderId", "eventType", "method", "status",
      "amountCents", "tenderedCents", "changeCents", "currency",
      "actorId", "actorName", "metadata", "registerSessionId",
      "parentEventId", "reasonCode", "reason"
    ) VALUES (
      ${reversalId}, ${input.idempotencyKey}, ${order.id},
      CAST(${input.action} AS "PaymentEventType"),
      CAST(${capture.method} AS "PaymentMethod"), 'succeeded',
      ${amountCents}, NULL, NULL, ${capture.currency},
      ${input.actor.id}, ${input.actor.name}, CAST(${metadata} AS jsonb),
      ${registerContext.session.id}, ${capture.id}, ${input.reasonCode}, ${input.reason}
    )
    RETURNING
      "id", "idempotencyKey", "orderId",
      "eventType"::text AS "eventType",
      "method"::text AS "method",
      "status"::text AS "status",
      "amountCents", "tenderedCents", "changeCents", "currency",
      "actorId", "actorName", "parentEventId", "reasonCode", "reason",
      "registerSessionId", "createdAt"
  `);
  const reversal = inserted[0];
  if (!reversal) {
    throw new PaymentReversalError(
      "Unable to append the payment reversal",
      "PAYMENT_REVERSAL_CREATE_FAILED",
      500
    );
  }

  const totalReversedCents = reversedCents + amountCents;
  const nextPaymentStatus =
    input.action === "void"
      ? "voided"
      : totalReversedCents === capture.amountCents
        ? "refunded"
        : "partially_refunded";

  const updatedOrder = await tx.order.update({
    where: { id: order.id },
    data: { paymentStatus: nextPaymentStatus },
    select: { updatedAt: true },
  });
  order.paymentStatus = nextPaymentStatus;
  order.updatedAt = updatedOrder.updatedAt;

  await writeAuditEvent(tx, {
    actor: input.actor,
    action: `payment.cash.${input.action}`,
    entityType: "PaymentEvent",
    entityId: reversal.id,
    context: input.context,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      originalPaymentEventId: capture.id,
      amountCents,
      totalReversedCents,
      remainingCents: capture.amountCents - totalReversedCents,
      paymentStatus: nextPaymentStatus,
      reasonCode: input.reasonCode,
      reason: input.reason,
      cashDrawerEntryId: cashEntry.id,
      registerId: registerContext.register.id,
      registerCode: registerContext.register.code,
      registerSessionId: registerContext.session.id,
    },
  });

  const finalEvents = [...events, reversal];
  return {
    ...buildSummary(order, finalEvents),
    reversal: eventDto(reversal),
    register: {
      id: registerContext.register.id,
      code: registerContext.register.code,
      name: registerContext.register.name,
    },
    registerSessionId: registerContext.session.id,
    replayed: false,
  };
}

export function paymentReversalErrorResponse(error: unknown) {
  if (error instanceof PaymentReversalError || error instanceof CashRegisterError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }
  return null;
}
