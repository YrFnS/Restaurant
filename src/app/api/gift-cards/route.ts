import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  LOYALTY_MANAGEMENT_ROLES,
  LOYALTY_READ_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest } from "@/lib/audit";
import {
  LoyaltyLedgerError,
  issueGiftCard,
  loyaltyLedgerErrorResponse,
  parseMoneyToMinor,
  readGiftCardAccount,
  searchGiftCards,
} from "@/lib/loyalty/ledger";
import { withSafeLoyaltyRawQueries } from "@/lib/loyalty/safe-transaction";

const querySchema = z
  .object({
    cardId: z.string().trim().min(1).max(191).optional(),
    q: z.string().trim().max(200).default(""),
    limit: z.coerce.number().int().min(1).max(300).default(100),
  })
  .strict();

const issueSchema = z
  .object({
    amount: z.number().finite().positive().max(1_000_000),
    purchaserName: z.string().trim().min(1).max(200),
    recipientName: z.string().trim().min(1).max(200),
    message: z.string().trim().max(2_000).nullable().optional(),
    template: z.string().trim().min(1).max(80).default("classic"),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,191}$/;

type ExistingIssueRow = {
  giftCardId: string;
  amountMinor: bigint;
  purchaserName: string;
  recipientName: string;
  message: string | null;
  template: string;
  expiresAt: Date | null;
};

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function readIdempotencyKey(req: NextRequest): string | null {
  const key = req.headers.get("idempotency-key")?.trim() || "";
  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

async function assertIssueReplayMatches(
  tx: Prisma.TransactionClient,
  key: string,
  input: z.infer<typeof issueSchema>
): Promise<string | null> {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`gift-card-issue:${key}`}, 0)
    )
  `);

  const rows = await tx.$queryRaw<ExistingIssueRow[]>(Prisma.sql`
    SELECT
      ledger_tx."giftCardId",
      ledger_tx."amountMinor",
      card."purchaserName",
      card."recipientName",
      card."message",
      card."template",
      card."expiresAt"
    FROM "GiftCardTransaction" AS ledger_tx
    JOIN "GiftCard" AS card ON card."id" = ledger_tx."giftCardId"
    WHERE ledger_tx."idempotencyKey" = ${key}
    LIMIT 1
    FOR UPDATE OF ledger_tx, card
  `);
  const existing = rows[0];
  if (!existing) return null;

  const expectedMessage = input.message?.trim().slice(0, 2_000) || null;
  const expectedTemplate = input.template.trim().slice(0, 80);
  const explicitExpiry = input.expiresAt ? new Date(input.expiresAt) : null;
  const expiryMatches =
    !input.expiresAt ||
    (existing.expiresAt !== null &&
      explicitExpiry !== null &&
      existing.expiresAt.getTime() === explicitExpiry.getTime());

  if (
    existing.amountMinor !== parseMoneyToMinor(input.amount) ||
    existing.purchaserName !== input.purchaserName.trim().slice(0, 200) ||
    existing.recipientName !== input.recipientName.trim().slice(0, 200) ||
    existing.message !== expectedMessage ||
    existing.template !== expectedTemplate ||
    !expiryMatches
  ) {
    throw new LoyaltyLedgerError(
      "That idempotency key was used for another gift-card issuance payload",
      "GIFT_CARD_IDEMPOTENCY_CONFLICT",
      409
    );
  }

  return existing.giftCardId;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(LOYALTY_READ_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return noStore(
      {
        error: "Invalid gift-card query",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      400
    );
  }

  try {
    if (parsed.data.cardId) {
      return noStore(
        await readGiftCardAccount(db, parsed.data.cardId, parsed.data.limit)
      );
    }
    return noStore({
      cards: await searchGiftCards(db, parsed.data.q, parsed.data.limit),
    });
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) return noStore(known.body, known.status);
    console.error("[gift-cards] Failed to load gift cards", error);
    return noStore(
      { error: "Unable to load gift cards", code: "GIFT_CARDS_LOAD_FAILED" },
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(LOYALTY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  let parsed: z.infer<typeof issueSchema>;
  try {
    const result = issueSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid gift-card issue request",
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

  const key = readIdempotencyKey(req);
  if (!key) {
    return noStore(
      {
        error: "A valid Idempotency-Key header is required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
      400
    );
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const safeTx = withSafeLoyaltyRawQueries(tx);
      const replayCardId = await assertIssueReplayMatches(safeTx, key, parsed);
      const issued = await issueGiftCard(safeTx, {
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        idempotencyKey: key,
        actor: auth.session,
        context: auditContextFromRequest(req),
      });

      if (issued.replayed && replayCardId) {
        return {
          ...issued,
          card: { ...issued.card, id: replayCardId },
        };
      }
      return issued;
    });
    return noStore(result, result.replayed ? 200 : 201);
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) return noStore(known.body, known.status);
    console.error("[gift-cards] Failed to issue gift card", error);
    return noStore(
      { error: "Unable to issue gift card", code: "GIFT_CARD_ISSUE_FAILED" },
      500
    );
  }
}
