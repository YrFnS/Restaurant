import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ valid: false });
  const promo = await db.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo || !promo.isActive) return NextResponse.json({ valid: false });
  const now = new Date();
  if (promo.validFrom && now < promo.validFrom) return NextResponse.json({ valid: false });
  if (promo.validUntil && now > promo.validUntil) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, discount: promo.discountPercent, code: promo.code });
}
