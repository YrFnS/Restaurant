import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const stations = await db.kitchenStation.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ stations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const station = await db.kitchenStation.create({
      data: {
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        icon: body.icon || "ChefHat",
        color: body.color || "#f59e0b",
        targetPrepMin: body.targetPrepMin || 15,
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ station });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
