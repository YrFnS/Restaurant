import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const testimonials = await db.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        commentEn: true,
        commentAr: true,
        avatar: true,
        stars: true,
        sortOrder: true,
      },
    });

    return NextResponse.json(
      { testimonials },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (error) {
    console.error("[testimonials] Failed to load testimonials", error);
    return NextResponse.json(
      { error: "Unable to load testimonials", code: "TESTIMONIALS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}
