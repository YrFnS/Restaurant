import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const where: any = { status: { in: ["waiting", "notified"] } };
  if (phone) where.customerPhone = phone;
  const entries = await db.waitlistEntry.findMany({
    where: phone ? { customerPhone: phone } : { status: { in: ["waiting", "notified"] } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // estimate wait based on queue length
    const ahead = await db.waitlistEntry.count({ where: { status: { in: ["waiting", "notified"] } } });
    const estimatedWait = Math.min(90, 15 + ahead * 12);
    const entry = await db.waitlistEntry.create({
      data: {
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        partySize: body.partySize,
        notes: body.notes || null,
        estimatedWait,
      },
    });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
