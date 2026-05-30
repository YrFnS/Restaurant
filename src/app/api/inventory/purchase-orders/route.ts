import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const purchaseOrders = await db.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(purchaseOrders);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { supplier, notes, totalCost } = data;

    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        supplier: supplier || "",
        notes: notes || null,
        totalCost: totalCost || 0,
        status: "draft",
      },
    });

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
