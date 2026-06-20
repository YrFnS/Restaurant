import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const items = await db.ingredient.findMany({ orderBy: { name: "asc" } });
  const waste = await db.wasteLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const pos = await db.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ items, waste, purchaseOrders: pos });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type === "waste") {
      const w = await db.wasteLog.create({
        data: {
          ingredientId: body.ingredientId || null,
          ingredientName: body.ingredientName || "",
          quantity: body.quantity || 0,
          reason: body.reason || "expired",
          notes: body.notes || null,
          reportedBy: body.reportedBy || null,
        },
      });
      if (body.ingredientId) {
        await db.ingredient.update({ where: { id: body.ingredientId }, data: { quantity: { decrement: body.quantity || 0 } } });
      }
      return NextResponse.json({ waste: w });
    }
    const item = await db.ingredient.create({
      data: {
        name: body.name, unit: body.unit || "pcs",
        quantity: body.quantity || 0, lowThreshold: body.lowThreshold || 10,
        costPerUnit: body.costPerUnit || 0, supplier: body.supplier || null, category: body.category || null,
      },
    });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (body._delete) {
      await db.ingredient.delete({ where: { id: body.id } });
      return NextResponse.json({ ok: true });
    }
    const { id: _id, ...data } = body;
    const item = await db.ingredient.update({ where: { id: body.id }, data });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
