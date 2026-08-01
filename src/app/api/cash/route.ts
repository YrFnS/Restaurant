import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CASH_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  exactMinorToNumber,
  readExactCashBalanceMinor,
  readExactCashEntryAmounts,
} from "@/lib/money/exact-store";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

const cashEntrySchema = z
  .object({
    type: z.enum(["payin", "payout", "drop", "sale", "refund"]),
    amount: z.number().finite().min(0.01).max(1_000_000_000),
    note: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict();

function inputToMinor(value: number): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    CURRENCY_MINOR_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export async function GET() {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const entries = await db.cashDrawerEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const [balanceMinor, exactAmounts] = await Promise.all([
    readExactCashBalanceMinor(db),
    readExactCashEntryAmounts(
      db,
      entries.map((entry) => entry.id)
    ),
  ]);

  const safeEntries = entries.map((entry) => {
    const amountMinor = exactAmounts.get(entry.id);
    if (amountMinor === undefined) {
      throw new Error(`Exact cash amount is missing for ${entry.id}`);
    }
    return { ...entry, amount: exactMinorToNumber(amountMinor) };
  });

  return NextResponse.json(
    {
      entries: safeEntries,
      balance: exactMinorToNumber(balanceMinor),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = cashEntrySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid cash drawer entry",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const amountMinor = inputToMinor(parsed.data.amount);
    const amount = exactMinorToNumber(amountMinor);
    const context = auditContextFromRequest(req);
    const entry = await db.$transaction(async (tx) => {
      const created = await tx.cashDrawerEntry.create({
        data: {
          type: parsed.data.type,
          amount,
          amountMinor,
          note: parsed.data.note || null,
          createdBy: auth.session.id,
        },
      });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: `cash.${created.type}`,
        entityType: "CashDrawerEntry",
        entityId: created.id,
        context,
        metadata: {
          amount,
          amountMinor: amountMinor.toString(),
          note: created.note,
        },
      });

      return { ...created, amount };
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("[cash] Failed to create cash entry", error);
    return NextResponse.json(
      { error: "Unable to create cash entry", code: "CASH_ENTRY_FAILED" },
      { status: 500 }
    );
  }
}
