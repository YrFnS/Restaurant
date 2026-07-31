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
  lockOpenRegisterSession,
  parseCurrencyInputToMinor,
  readCurrentRegisterSession,
  readSessionCashEntries,
  readSessionExpectedCashMinor,
  registerIdentityFromRequest,
  serializeRegister,
  serializeSession,
} from "@/lib/cash/register-session";
import {
  exactMinorToNumber,
  readExactCashBalanceMinor,
  readExactCashEntryAmounts,
} from "@/lib/money/exact-store";

const cashEntrySchema = z
  .object({
    type: z.enum(["payin", "payout", "drop", "sale", "refund"]),
    amount: z.number().finite().min(0.01).max(1_000_000_000),
    note: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict();

function errorResponse(error: CashRegisterError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const identity = registerIdentityFromRequest(req);
    if (identity.registerId || identity.deviceId) {
      if (!identity.registerId || !identity.deviceId) {
        throw new CashRegisterError(
          "Register and device headers are required",
          "REGISTER_IDENTITY_REQUIRED",
          400
        );
      }
      const current = await readCurrentRegisterSession(
        db,
        identity.registerId,
        identity.deviceId
      );
      if (!current.session) {
        throw new CashRegisterError(
          "Open the cash register before reading its live ledger",
          "REGISTER_SESSION_REQUIRED",
          409
        );
      }
      const [entries, expectedCashMinor] = await Promise.all([
        readSessionCashEntries(db, current.session.id),
        readSessionExpectedCashMinor(db, current.session),
      ]);
      return NextResponse.json(
        {
          register: serializeRegister(current.register),
          session: serializeSession(current.session),
          entries: entries.map((entry) => ({
            ...entry,
            amount: exactMinorToNumber(entry.amountMinor),
            amountMinor: undefined,
          })),
          balance: exactMinorToNumber(expectedCashMinor),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

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
  } catch (error) {
    if (error instanceof CashRegisterError) return errorResponse(error);
    console.error("[cash] Failed to load cash ledger", error);
    return NextResponse.json(
      { error: "Unable to load cash ledger", code: "CASH_LEDGER_LOAD_FAILED" },
      { status: 500 }
    );
  }
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

    const amountMinor = parseCurrencyInputToMinor(parsed.data.amount);
    const amount = exactMinorToNumber(amountMinor);
    const identity = registerIdentityFromRequest(req);
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const registerContext = await lockOpenRegisterSession(tx, {
        identity,
        actor: auth.session,
      });
      const created = await tx.cashDrawerEntry.create({
        data: {
          type: parsed.data.type,
          amount,
          amountMinor,
          note: parsed.data.note || null,
          createdBy: auth.session.id,
        },
      });
      await linkCashEntryToSession(tx, created.id, registerContext.session.id);

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
          registerId: registerContext.register.id,
          registerCode: registerContext.register.code,
          registerSessionId: registerContext.session.id,
        },
      });

      return {
        entry: {
          ...created,
          amount,
          registerSessionId: registerContext.session.id,
        },
        register: registerContext.register,
        session: registerContext.session,
      };
    });

    return NextResponse.json(
      {
        entry: result.entry,
        register: serializeRegister(result.register),
        session: serializeSession(result.session),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) return errorResponse(error);
    console.error("[cash] Failed to create cash entry", error);
    return NextResponse.json(
      { error: "Unable to create cash entry", code: "CASH_ENTRY_FAILED" },
      { status: 500 }
    );
  }
}
