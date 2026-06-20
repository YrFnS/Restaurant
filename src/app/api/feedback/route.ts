import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const feedback = await db.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ feedback });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const f = await db.feedback.create({
      data: { name: body.name, email: body.email || null, rating: body.rating, comment: body.comment },
    });
    return NextResponse.json({ feedback: f });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
