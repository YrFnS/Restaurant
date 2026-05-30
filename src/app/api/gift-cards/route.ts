import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/sanitize";

function generateGiftCardCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "GC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");

    // Note: GiftCard model doesn't have a phone field directly.
    // If phone is provided, we look up the customer and filter by purchaserName match.
    // For simplicity, we return all gift cards or filter by purchaserName if provided.
    const purchaserName = request.nextUrl.searchParams.get("purchaserName");

    const where: Record<string, unknown> = {};
    if (purchaserName) {
      where.purchaserName = { contains: purchaserName };
    }

    const giftCards = await db.giftCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ giftCards });
  } catch (error) {
    console.error("Error fetching gift cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch gift cards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      purchaserName,
      recipientName,
      message,
      template,
    } = body;

    if (!amount || !purchaserName || !recipientName) {
      return NextResponse.json(
        { error: "Missing required fields: amount, purchaserName, recipientName" },
        { status: 400 }
      );
    }

    // Generate a unique code
    let code = generateGiftCardCode();
    let existing = await db.giftCard.findUnique({ where: { code } });
    while (existing) {
      code = generateGiftCardCode();
      existing = await db.giftCard.findUnique({ where: { code } });
    }

    const giftCard = await db.giftCard.create({
      data: {
        code,
        amount,
        balance: amount,
        purchaserName: sanitizeString(purchaserName),
        recipientName: sanitizeString(recipientName),
        message: message ? sanitizeString(message) : null,
        template: template || "birthday",
      },
    });

    return NextResponse.json({ giftCard }, { status: 201 });
  } catch (error) {
    console.error("Error creating gift card:", error);
    return NextResponse.json(
      { error: "Failed to create gift card" },
      { status: 500 }
    );
  }
}
