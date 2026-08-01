import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const tiers = await db.rewardTier.findMany({
      where: { isActive: true },
      orderBy: { points: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        points: true,
        icon: true,
        tier: true,
        perkEn: true,
        perkAr: true,
        sortOrder: true,
      },
    });
    return NextResponse.json(
      { tiers },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (error) {
    console.error("[reward-tiers] Failed to load tiers", error);
    return NextResponse.json(
      { error: "Unable to load reward tiers", code: "REWARD_TIERS_FAILED" },
      { status: 500 }
    );
  }
}
