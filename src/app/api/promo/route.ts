import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Code parameter is required" },
        { status: 400 }
      );
    }

    const promo = await db.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired promo code" },
        { status: 404 }
      );
    }

    const now = new Date();
    if (promo.validFrom && promo.validFrom > now) {
      return NextResponse.json(
        { valid: false, error: "Promo code not yet active" },
        { status: 400 }
      );
    }
    if (promo.validUntil && promo.validUntil < now) {
      return NextResponse.json(
        { valid: false, error: "Promo code expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}
