import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Look up a customer by phone and return their loyalty points + redemption options
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ customer: null });

  const customer = await db.customer.findUnique({
    where: { phone },
    select: { id: true, name: true, phone: true, loyaltyPoints: true, totalSpent: true, visits: true },
  });

  if (!customer) return NextResponse.json({ customer: null });

  // Redemption tiers: 100 pts = $1, 500 pts = $6, 1000 pts = $15
  const redemptionOptions = [
    { points: 100, value: 1, label: "$1 off" },
    { points: 250, value: 3, label: "$3 off" },
    { points: 500, value: 6, label: "$6 off" },
    { points: 1000, value: 15, label: "$15 off" },
  ].filter((r) => customer.loyaltyPoints >= r.points);

  return NextResponse.json({ customer, redemptionOptions });
}

// Redeem points (subtract from customer's balance)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, pointsToRedeem } = body;
    if (!phone || !pointsToRedeem) {
      return NextResponse.json({ error: "phone and pointsToRedeem required" }, { status: 400 });
    }
    const customer = await db.customer.findUnique({ where: { phone } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.loyaltyPoints < pointsToRedeem) {
      return NextResponse.json({ error: "Insufficient points" }, { status: 400 });
    }
    // Calculate discount value: 100 pts = $1
    const discountValue = pointsToRedeem / 100;
    const updated = await db.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: { decrement: pointsToRedeem } },
      select: { id: true, name: true, phone: true, loyaltyPoints: true },
    });
    return NextResponse.json({
      customer: updated,
      redeemedPoints: pointsToRedeem,
      discountValue: Math.round(discountValue * 100) / 100,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
