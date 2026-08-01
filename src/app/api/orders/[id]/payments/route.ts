import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/guard";
import { auditContextFromRequest } from "@/lib/audit";
import {
  idempotencyKeyFromRequest,
  registerIdentityFromRequest,
} from "@/lib/cash/register-session";
import {
  PAYMENT_LEDGER_READ_ROLES,
  PAYMENT_REVERSAL_ROLES,
  REVERSAL_REASON_CODES,
  paymentReversalErrorResponse,
  readPaymentLedgerSummary,
  reversePayment,
} from "@/lib/payments/reversals";

const reversalSchema = z
  .object({
    action: z.enum(["refund", "void"]),
    amount: z.number().finite().positive().max(1_000_000).optional(),
    reasonCode: z.enum(REVERSAL_REASON_CODES),
    reason: z.string().trim().min(3).max(1_000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "refund" && value.amount === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Refund amount is required",
      });
    }
    if (value.action === "void" && value.amount !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Void amount is always the full captured amount",
      });
    }
  });

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(PAYMENT_LEDGER_READ_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    return noStore(await readPaymentLedgerSummary(db, id));
  } catch (error) {
    const known = paymentReversalErrorResponse(error);
    if (known) return noStore(known.body, known.status);

    console.error("[orders/payments] Failed to load payment ledger", error);
    return noStore(
      { error: "Unable to load payment ledger", code: "PAYMENT_LEDGER_LOAD_FAILED" },
      500
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(PAYMENT_REVERSAL_ROLES);
  if ("response" in auth) return auth.response;

  let parsed: z.infer<typeof reversalSchema>;
  try {
    const result = reversalSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid payment reversal",
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

  try {
    const { id } = await params;
    const idempotencyKey = idempotencyKeyFromRequest(req);
    const identity = registerIdentityFromRequest(req);
    const context = auditContextFromRequest(req);

    const result = await db.$transaction((tx) =>
      reversePayment(tx, {
        orderId: id,
        action: parsed.action,
        amount: parsed.amount,
        reasonCode: parsed.reasonCode,
        reason: parsed.reason,
        idempotencyKey,
        identity,
        actor: auth.session,
        context,
      })
    );

    return noStore(result, result.replayed ? 200 : 201);
  } catch (error) {
    const known = paymentReversalErrorResponse(error);
    if (known) return noStore(known.body, known.status);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return noStore(
          {
            error: "That idempotency key was already used",
            code: "IDEMPOTENCY_CONFLICT",
          },
          409
        );
      }
      if (error.code === "P2010" || error.code === "P2004") {
        return noStore(
          {
            error: "The payment ledger changed before the reversal completed",
            code: "PAYMENT_REVERSAL_CONFLICT",
          },
          409
        );
      }
    }

    console.error("[orders/payments] Payment reversal failed", error);
    return noStore(
      { error: "Unable to reverse payment", code: "PAYMENT_REVERSAL_FAILED" },
      500
    );
  }
}
