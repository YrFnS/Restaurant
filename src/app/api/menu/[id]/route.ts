import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.type === "category") {
      const { type, ...data } = body;
      const cat = await db.menuCategory.update({ where: { id }, data });
      return NextResponse.json({ category: cat });
    }
    const { type, ...data } = body;
    const item = await db.menuItem.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(_req.url);
    const kind = searchParams.get("kind");
    if (kind === "category") {
      await db.menuCategory.delete({ where: { id } });
    } else {
      await db.menuItem.delete({ where: { id } });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
