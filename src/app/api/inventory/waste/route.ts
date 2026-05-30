import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const wasteLogs = await db.wasteLog.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(wasteLogs);
  } catch (error) {
    console.error("Error fetching waste logs:", error);
    return NextResponse.json({ error: "Failed to fetch waste logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { ingredientId, quantity, reason, notes, reportedBy } = data;

    // Get ingredient name
    let ingredientName = "";
    if (ingredientId) {
      const ingredient = await db.ingredient.findUnique({ where: { id: ingredientId } });
      if (ingredient) {
        ingredientName = ingredient.name;
        // Reduce ingredient stock
        await db.ingredient.update({
          where: { id: ingredientId },
          data: { quantity: { decrement: quantity || 0 } },
        });
      }
    }

    const wasteLog = await db.wasteLog.create({
      data: {
        ingredientId: ingredientId || null,
        ingredientName,
        quantity: quantity || 0,
        reason: reason || "other",
        notes: notes || null,
        reportedBy: reportedBy || null,
      },
    });

    return NextResponse.json(wasteLog);
  } catch (error) {
    console.error("Error logging waste:", error);
    return NextResponse.json({ error: "Failed to log waste" }, { status: 500 });
  }
}
