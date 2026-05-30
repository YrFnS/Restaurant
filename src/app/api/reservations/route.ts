import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");

    const where = phone ? { customerPhone: phone } : {};

    const reservations = await db.reservation.findMany({
      where,
      include: {
        table: true,
        customer: true,
      },
      orderBy: { dateTime: "asc" },
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      tableId,
      dateTime,
      occasion,
      preference,
      notes,
    } = body;

    if (!customerName || !customerPhone || !partySize || !dateTime) {
      return NextResponse.json(
        { error: "Missing required fields: customerName, customerPhone, partySize, dateTime" },
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

    const reservation = await db.reservation.create({
      data: {
        customerName: sanitizeString(customerName),
        customerPhone,
        customerEmail: customerEmail ? sanitizeString(customerEmail) : null,
        partySize,
        tableId: tableId || null,
        customerId: customerId || null,
        dateTime: new Date(dateTime),
        status: "confirmed",
        occasion: occasion ? sanitizeString(occasion) : null,
        preference: preference ? sanitizeString(preference) : null,
        notes: notes ? sanitizeString(notes) : null,
      },
      include: {
        table: true,
        customer: true,
      },
    });

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    console.error("Error creating reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
