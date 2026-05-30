import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  try {
    const entries = await db.waitlistEntry.findMany({
      where: {
        status: { in: ["waiting", "notified"] },
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, partySize, notes } = body;

    if (!customerName || !customerPhone || !partySize) {
      return NextResponse.json(
        { error: "Missing required fields: customerName, customerPhone, partySize" },
        { status: 400 }
      );
    }

    // Look up existing customer by phone
    let customerId: string | undefined;
    const existingCustomer = await db.customer.findUnique({
      where: { phone: customerPhone },
    });
    if (existingCustomer) {
      customerId = existingCustomer.id;
    }

    // Calculate estimated wait based on current waitlist length
    const waitingCount = await db.waitlistEntry.count({
      where: { status: "waiting" },
    });
    const estimatedWait = Math.max(15, waitingCount * 10);

    const entry = await db.waitlistEntry.create({
      data: {
        customerName: sanitizeString(customerName),
        customerPhone,
        partySize,
        status: "waiting",
        estimatedWait,
        notes: notes ? sanitizeString(notes) : null,
        customerId: customerId || null,
      },
      include: {
        customer: true,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error joining waitlist:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}
