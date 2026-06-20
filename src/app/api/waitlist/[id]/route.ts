import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const update: any = { status: body.status };
    if (body.status === "seated") update.seatedAt = new Date();
    if (body.status === "notified") update.notifiedAt = new Date();
    const entry = await db.waitlistEntry.update({ where: { id }, data: update });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.waitlistEntry.update({ where: { id }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
