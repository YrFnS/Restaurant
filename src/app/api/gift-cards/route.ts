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
  issueGiftCard,
  loyaltyLedgerErrorResponse,
  readGiftCardAccount,
  searchGiftCards,
} from "@/lib/loyalty/ledger";

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
    const result = await db.$transaction((tx) =>
      issueGiftCard(tx, {
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        idempotencyKey: key,
        actor: auth.session,
        context: auditContextFromRequest(req),
      })
    );
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
