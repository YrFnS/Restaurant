import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  LOYALTY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest } from "@/lib/audit";
import {
  GIFT_CARD_ADJUSTMENT_REASON_CODES,
  LoyaltyLedgerError,
  loyaltyLedgerErrorResponse,
  mutateGiftCard,
  parseSignedMoneyToMinor,
} from "@/lib/loyalty/ledger";

const mutationSchema = z
  .object({
    action: z.enum(["adjust", "void"]),
    amount: z.number().finite().min(-1_000_000).max(1_000_000).optional(),
    reasonCode: z.enum(GIFT_CARD_ADJUSTMENT_REASON_CODES),
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "adjust" && (!value.amount || value.amount === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "A non-zero adjustment amount is required",
      });
    }
    if (value.action === "void" && value.amount !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "A void always removes the full remaining balance",
      });
    }
  });

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,191}$/;

type ExistingMutationRow = {
  giftCardId: string;
  transactionType: "adjustment" | "void";
  amountMinor: bigint;
  reasonCode: string;
  reason: string | null;
};

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function assertMutationReplayMatches(
  tx: Prisma.TransactionClient,
  key: string,
  cardId: string,
  input: z.infer<typeof mutationSchema>
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`gift-card-mutation:${key}`}, 0)
    )
  `);

  const rows = await tx.$queryRaw<ExistingMutationRow[]>(Prisma.sql`
    SELECT
      "giftCardId",
      "transactionType"::text AS "transactionType",
      "amountMinor",
      "reasonCode",
      "reason"
    FROM "GiftCardTransaction"
    WHERE "idempotencyKey" = ${key}
    LIMIT 1
    FOR UPDATE
  `);
  const existing = rows[0];
  if (!existing) return;

  const expectedType = input.action === "void" ? "void" : "adjustment";
  const amountMatches =
    input.action === "void" ||
    existing.amountMinor === parseSignedMoneyToMinor(input.amount ?? 0);

  if (
    existing.giftCardId !== cardId ||
    existing.transactionType !== expectedType ||
    !amountMatches ||
    existing.reasonCode !== input.reasonCode ||
    existing.reason !== input.reason.trim().slice(0, 2_000)
  ) {
    throw new LoyaltyLedgerError(
      "That idempotency key was used for another gift-card action payload",
      "GIFT_CARD_IDEMPOTENCY_CONFLICT",
      409
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(LOYALTY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  let parsed: z.infer<typeof mutationSchema>;
  try {
    const result = mutationSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid gift-card operation",
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

  const key = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return noStore(
      {
        error: "A valid Idempotency-Key header is required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
      400
    );
  }

  try {
    const { id } = await params;
    const result = await db.$transaction(async (tx) => {
      await assertMutationReplayMatches(tx, key, id, parsed);
      return mutateGiftCard(tx, {
        cardId: id,
        ...parsed,
        idempotencyKey: key,
        actor: auth.session,
        context: auditContextFromRequest(req),
      });
    });
    return noStore(result, result.replayed ? 200 : 201);
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) return noStore(known.body, known.status);
    console.error("[gift-cards/:id] Gift-card operation failed", error);
    return noStore(
      { error: "Unable to update gift card", code: "GIFT_CARD_UPDATE_FAILED" },
      500
    );
  }
}
