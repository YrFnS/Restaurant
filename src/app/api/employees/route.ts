import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const employees = await db.employee.findMany({ orderBy: { name: "asc" }, include: { schedules: true } });
  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emp = await db.employee.create({
      data: {
        name: body.name, pin: body.pin, role: body.role || "staff",
        hourlyWage: body.hourlyWage || 12, email: body.email || null, phone: body.phone || null,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ employee: emp });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
