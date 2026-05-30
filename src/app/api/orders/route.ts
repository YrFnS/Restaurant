import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");

    const where = phone ? { customerPhone: phone } : {};

    const orders = await db.order.findMany({
      where,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        table: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { success, remaining } = rateLimit(`orders:${ip}`, 10, 60 * 1000);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }
    const {
      customerName,
      customerPhone,
      type,
      deliveryAddress,
      notes,
      items,
      subtotal,
      taxAmount,
      deliveryFee,
      discountAmount,
      tipAmount,
      total,
      paymentMethod,
      paymentStatus,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    // Validate no negative prices
    if (typeof subtotal === "number" && subtotal < 0) {
      return NextResponse.json(
        { error: "Subtotal cannot be negative" },
        { status: 400 }
      );
    }
    if (typeof total === "number" && total < 0) {
      return NextResponse.json(
        { error: "Total cannot be negative" },
        { status: 400 }
      );
    }
    for (const item of items) {
      if (typeof item.unitPrice === "number" && item.unitPrice < 0) {
        return NextResponse.json(
          { error: "Item prices cannot be negative" },
          { status: 400 }
        );
      }
    }

    // Look up existing customer by phone
    let customerId: string | undefined;
    if (customerPhone) {
      const existingCustomer = await db.customer.findUnique({
        where: { phone: customerPhone },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    // Create the order with retry on orderNumber collision (concurrent-safe)
    const orderItemData = items.map((item: {
      menuItemId: string;
      quantity: number;
      modifiers?: string;
      notes?: string;
      unitPrice: number;
      totalPrice: number;
    }) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity || 1,
      modifiers: item.modifiers || "[]",
      notes: item.notes ? sanitizeString(item.notes) : null,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    let order;
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Generate sequential order number — find the MAX order number to avoid collisions
      const allOrderNumbers = await db.order.findMany({
        select: { orderNumber: true },
      });
      let maxNum = 0;
      for (const o of allOrderNumbers) {
        const num = parseInt(o.orderNumber.replace("ORD-", ""), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      const orderNumber = `ORD-${String(maxNum + 1).padStart(3, "0")}`;

      try {
        order = await db.order.create({
          data: {
            orderNumber,
            type: type || "dine_in",
            status: "pending",
            customerName: customerName ? sanitizeString(customerName) : "",
            customerPhone: customerPhone ? sanitizeString(customerPhone) : "",
            deliveryAddress: deliveryAddress ? sanitizeString(deliveryAddress) : null,
            notes: notes ? sanitizeString(notes) : null,
            subtotal: subtotal || 0,
            taxAmount: taxAmount || 0,
            deliveryFee: deliveryFee || 0,
            discountAmount: discountAmount || 0,
            tipAmount: tipAmount || 0,
            total: total || 0,
            paymentMethod: paymentMethod || "cash",
            paymentStatus: paymentStatus || "unpaid",
            customerId: customerId || null,
            items: { create: orderItemData },
          },
          include: {
            items: {
              include: {
                menuItem: true,
              },
            },
          },
        });
        break; // success
      } catch (createError: unknown) {
        // If unique constraint violation on orderNumber, retry with next number
        const isUniqueViolation =
          createError &&
          typeof createError === "object" &&
          "code" in createError &&
          (createError as { code: string }).code === "P2002";
        if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
          continue; // retry
        }
        throw createError; // re-throw non-retryable errors
      }
    }

    // Update customer stats if customer exists
    if (customerId) {
      await db.customer.update({
        where: { id: customerId },
        data: {
          totalSpent: { increment: total || 0 },
          visits: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
