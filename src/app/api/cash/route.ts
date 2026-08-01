import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CASH_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

const cashEntrySchema = z
  .object({
    type: z.enum(["payin", "payout", "drop", "sale", "refund"]),
    amount: z.number().positive().max(1_000_000_000),
    note: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict();

const OUTFLOW_TYPES = new Set(["refund", "payout", "drop"]);

export async function GET() {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const [entries, totals] = await Promise.all([
    db.cashDrawerEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.cashDrawerEntry.groupBy({
      by: ["type"],
      _sum: { amount: true },
    }),
  ]);

  const balance = totals.reduce((sum, row) => {
    const amount = row._sum.amount ?? 0;
    return sum + (OUTFLOW_TYPES.has(row.type) ? -amount : amount);
  }, 0);

  return NextResponse.json(
    { entries, balance },
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

    const context = auditContextFromRequest(req);
    const entry = await db.$transaction(async (tx) => {
      const created = await tx.cashDrawerEntry.create({
        data: {
          ...parsed.data,
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
          amount: created.amount,
          note: created.note,
        },
      });

      return created;
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