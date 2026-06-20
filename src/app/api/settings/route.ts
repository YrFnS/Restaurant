import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.restaurantSettings.findFirst({ where: { id: "1" } });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await db.restaurantSettings.upsert({
      where: { id: "1" },
      update: body,
      create: { id: "1", ...body },
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
