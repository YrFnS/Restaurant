import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const tables = await db.restaurantTable.findMany({
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: { in: ["confirmed", "preparing", "ready"] } },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return NextResponse.json({ tables });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type === "update") {
      const t = await db.restaurantTable.update({
        where: { id: body.id },
        data: {
          status: body.status,
          serverName: body.serverName,
          seatedAt: body.seatedAt ? new Date(body.seatedAt) : body.status === "seated" ? new Date() : null,
        },
      });
      return NextResponse.json({ table: t });
    }
    const t = await db.restaurantTable.create({
      data: {
        number: body.number,
        capacity: body.capacity || 4,
        section: body.section || "main",
        shape: body.shape || "square",
        x: body.x || 0, y: body.y || 0,
        width: body.width || 90, height: body.height || 90,
        status: "open",
      },
    });
    return NextResponse.json({ table: t });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const t = await db.restaurantTable.update({
      where: { id: body.id },
      data: body,
    });
    return NextResponse.json({ table: t });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
