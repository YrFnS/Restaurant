import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const where: any = {};
  if (phone) where.customerPhone = phone;
  const reservations = await db.reservation.findMany({
    where,
    orderBy: { dateTime: "asc" },
    include: { table: true },
  });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const r = await db.reservation.create({
      data: {
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail || null,
        partySize: body.partySize,
        tableId: body.tableId || null,
        customerId: body.customerId || null,
        dateTime: new Date(body.dateTime),
        status: "confirmed",
        occasion: body.occasion || null,
        preference: body.preference || null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ reservation: r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
