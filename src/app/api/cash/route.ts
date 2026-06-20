import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const entries = await db.cashDrawerEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const balance = entries.reduce((s, e) => s + (e.type === "refund" || e.type === "payout" || e.type === "drop" ? -e.amount : e.amount), 0);
  return NextResponse.json({ entries, balance });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await db.cashDrawerEntry.create({
      data: {
        type: body.type || "payin",
        amount: body.amount || 0,
        note: body.note || null,
        createdBy: body.createdBy || null,
      },
    });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
