import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import {
  loyaltyLedgerErrorResponse,
  lookupGiftCard,
} from "@/lib/loyalty/ledger";

const lookupSchema = z
  .object({
    code: z.string().trim().min(6).max(128),
  })
  .strict();

const LOOKUP_WINDOW_MS = 60_000;
const MAX_LOOKUPS_PER_WINDOW = 12;

function noStore(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: NextRequest) {
  let limit;
  try {
    limit = await consumeRateLimit({
      scope: "gift-card-lookup",
      identifier: getRequestSource(req),
      limit: MAX_LOOKUPS_PER_WINDOW,
      windowMs: LOOKUP_WINDOW_MS,
    });
  } catch (error) {
    console.error("[gift-cards/lookup] Shared limiter failed", error);
    return noStore(
      { error: "Gift-card lookup is temporarily unavailable", code: "RATE_LIMIT_UNAVAILABLE" },
      503
    );
  }
  if (!limit.allowed) {
    return noStore(
      { error: "Too many gift-card lookups", code: "GIFT_CARD_LOOKUP_RATE_LIMITED" },
      429,
      rateLimitHeaders(limit)
    );
  }

  let parsed: z.infer<typeof lookupSchema>;
  try {
    const result = lookupSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid gift-card lookup",
          code: "VALIDATION_ERROR",
          details: result.error.flatten().fieldErrors,
        },
        400,
        rateLimitHeaders(limit)
      );
    }
    parsed = result.data;
  } catch {
    return noStore(
      { error: "Invalid JSON body", code: "INVALID_JSON" },
      400,
      rateLimitHeaders(limit)
    );
  }

  try {
    const card = await lookupGiftCard(db, parsed.code);
    return noStore(
      {
        card: {
          reference: card.reference,
          codeLast4: card.codeLast4,
          maskedCode: card.maskedCode,
          balance: card.balance,
          status: card.status,
          currency: card.currency,
          expiresAt: card.expiresAt,
        },
      },
      200,
      rateLimitHeaders(limit)
    );
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) {
      const status = known.status === 404 ? 404 : known.status;
      return noStore(
        status === 404
          ? { error: "Gift card not found", code: "GIFT_CARD_NOT_FOUND" }
          : known.body,
        status,
        rateLimitHeaders(limit)
      );
    }
    console.error("[gift-cards/lookup] Lookup failed", error);
    return noStore(
      { error: "Unable to look up gift card", code: "GIFT_CARD_LOOKUP_FAILED" },
      500,
      rateLimitHeaders(limit)
    );
  }
}
