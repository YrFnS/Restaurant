import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const screen = await db.kitchenScreen.findUnique({ where: { slug } });
    if (!screen) return NextResponse.json({ screen: null }, { status: 404 });
    const stationSlugs = screen.stationFilter ? screen.stationFilter.split(",") : [];
    const stations = await db.kitchenStation.findMany({
      where: stationSlugs.length ? { slug: { in: stationSlugs } } : undefined,
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ screen, stations });
  }

  const screens = await db.kitchenScreen.findMany({ orderBy: { sortOrder: "asc" } });
  const stations = await db.kitchenStation.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ screens, stations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const screen = await db.kitchenScreen.create({
      data: {
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: body.description || "",
        stationFilter: body.stationFilter || "",
        screenType: body.screenType || "prep",
        layoutType: body.layoutType || "grid",
        autoRefreshSec: body.autoRefreshSec || 10,
        showCompleted: !!body.showCompleted,
        maxOrders: body.maxOrders || 0,
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ screen });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
