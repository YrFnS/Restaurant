import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cats = await db.menuCategory.count();
    const items = await db.menuItem.count();
    const offers = await db.specialOffer.count();
    return NextResponse.json({
      ok: true,
      data: { categories: cats, items, offers },
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message, hasDbUrl: !!process.env.DATABASE_URL },
      { status: 500 }
    );
  }
}
