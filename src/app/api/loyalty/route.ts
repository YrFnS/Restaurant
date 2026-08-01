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
  LOYALTY_ADJUSTMENT_REASON_CODES,
  adjustLoyaltyPoints,
  loyaltyLedgerErrorResponse,
  readLoyaltyAccount,
} from "@/lib/loyalty/ledger";
import { withSafeLoyaltyRawQueries } from "@/lib/loyalty/safe-transaction";

const querySchema = z
  .object({
    customerId: z.string().trim().min(1).max(191).optional(),
    phone: z.string().trim().min(4).max(40).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict()
  .refine((value) => Boolean(value.customerId || value.phone), {
    message: "Customer ID or phone is required",
  });

const adjustmentSchema = z
  .object({
    customerId: z.string().trim().min(1).max(191),
    pointsDelta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
    reasonCode: z.enum(LOYALTY_ADJUSTMENT_REASON_CODES),
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,191}$/;

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function idempotencyKey(req: NextRequest): string {
  const value = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  return value;
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
        error: "Invalid loyalty query",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      400
    );
  }

  try {
    let customerId = parsed.data.customerId || null;
    if (!customerId && parsed.data.phone) {
      const customer = await db.customer.findUnique({
        where: { phone: parsed.data.phone },
        select: { id: true },
      });
      customerId = customer?.id || null;
    }
    if (!customerId) {
      return noStore(
        { error: "Customer not found", code: "CUSTOMER_NOT_FOUND" },
        404
      );
    }
    return noStore(await readLoyaltyAccount(db, customerId, parsed.data.limit));
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) return noStore(known.body, known.status);
    console.error("[loyalty] Failed to load loyalty account", error);
    return noStore(
      { error: "Unable to load loyalty account", code: "LOYALTY_LOAD_FAILED" },
      500
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(LOYALTY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  let parsed: z.infer<typeof adjustmentSchema>;
  try {
    const result = adjustmentSchema.safeParse(await req.json());
    if (!result.success) {
      return noStore(
        {
          error: "Invalid loyalty adjustment",
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

  let key: string;
  try {
    key = idempotencyKey(req);
  } catch {
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
      adjustLoyaltyPoints(withSafeLoyaltyRawQueries(tx), {
        ...parsed,
        idempotencyKey: key,
        actor: auth.session,
        context: auditContextFromRequest(req),
      })
    );
    return noStore(result, result.replayed ? 200 : 201);
  } catch (error) {
    const known = loyaltyLedgerErrorResponse(error);
    if (known) return noStore(known.body, known.status);
    console.error("[loyalty] Failed to adjust loyalty points", error);
    return noStore(
      { error: "Unable to adjust loyalty points", code: "LOYALTY_ADJUST_FAILED" },
      500
    );
  }
}
