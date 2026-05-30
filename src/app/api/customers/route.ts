import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");

    if (phone) {
      const customer = await db.customer.findUnique({
        where: { phone },
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          reservations: {
            orderBy: { dateTime: "desc" },
            take: 5,
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ customer });
    }

    // If no phone, return all customers (with pagination limit)
    const customers = await db.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing required fields: name, phone" },
        { status: 400 }
      );
    }

    // Check if customer with this phone already exists
    const existingCustomer = await db.customer.findUnique({
      where: { phone },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this phone number already exists" },
        { status: 409 }
      );
    }

    const customer = await db.customer.create({
      data: {
        name: sanitizeString(name),
        phone,
        email: email ? sanitizeString(email) : null,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
