import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const offers = await db.specialOffer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titleEn: true,
        titleAr: true,
        descriptionEn: true,
        descriptionAr: true,
        discountPercent: true,
        image: true,
        validFrom: true,
        validUntil: true,
      },
    });

    return NextResponse.json(
      { offers },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (error) {
    console.error("[offers] Failed to load offers", error);
    return NextResponse.json(
      { error: "Unable to load offers", code: "OFFERS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}
