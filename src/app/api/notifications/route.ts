import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const notifications = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.markAllRead) {
      await db.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
      return NextResponse.json({ ok: true });
    }
    const n = await db.notification.update({ where: { id: body.id }, data: { isRead: true } });
    return NextResponse.json({ notification: n });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
