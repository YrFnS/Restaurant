import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Get active dynamic pricing rules, optionally filtered to "currently active" based on time
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";

  const rules = await db.dynamicPricing.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!activeOnly) {
    return NextResponse.json({ rules });
  }

  // Filter to rules that are currently active based on day/time
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const currentlyActive = rules.filter((r) => {
    // dayOfWeek: -1 or null means "every day"
    if (r.dayOfWeek != null && r.dayOfWeek !== -1 && r.dayOfWeek !== dayOfWeek) return false;
    if (r.startTime && r.endTime) {
      return hhmm >= r.startTime && hhmm < r.endTime;
    }
    return true;
  });

  return NextResponse.json({ rules: currentlyActive, allRules: rules });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rule = await db.dynamicPricing.create({
      data: {
        nameEn: body.nameEn,
        nameAr: body.nameAr || body.nameEn,
        type: body.type || "happy_hour",
        multiplier: body.multiplier ?? 1.0,
        dayOfWeek: body.dayOfWeek ?? -1,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ rule });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
