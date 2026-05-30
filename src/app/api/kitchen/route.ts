import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get all active orders (not completed or cancelled) with their items
    const orders = await db.order.findMany({
      where: {
        status: {
          in: ["pending", "confirmed", "preparing", "ready"],
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        table: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching kitchen orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch kitchen orders" },
      { status: 500 }
    );
  }
}
