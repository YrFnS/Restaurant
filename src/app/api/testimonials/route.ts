import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const testimonials = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ testimonials });
}
