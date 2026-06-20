import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const tiers = await db.rewardTier.findMany({ where: { isActive: true }, orderBy: { points: "asc" } });
  let customer = null;
  if (phone) {
    customer = await db.customer.findUnique({ where: { phone } });
  }
  return NextResponse.json({ tiers, customer });
}
