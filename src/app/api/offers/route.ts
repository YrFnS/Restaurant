import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const offers = await db.specialOffer.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  const promos = await db.promoCode.findMany({ where: { isActive: true } });
  return NextResponse.json({ offers, promos });
}
