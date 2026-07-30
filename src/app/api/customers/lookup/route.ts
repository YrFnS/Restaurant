import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  STAFF_ADMIN_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import {
  OrderAccessConfigurationError,
  verifyOrderAccessToken,
} from "@/lib/orders/access";

const loyaltyCredentialsSchema = z
  .object({
    orders: z
      .array(
        z
          .object({
            orderNumber: z.string().trim().min(1).max(100),
            accessToken: z.string().trim().min(20).max(200),
            createdAt: z.string().datetime().optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

function normalizeOrderNumber(value: string): string {
  return `#${value.replace(/^#/, "").trim()}`;
}

function redemptionOptions(points: number) {
  return [
    { points: 100, value: 1, label: "$1 off" },
    { points: 250, value: 3, label: "$3 off" },
    { points: 500, value: 6, label: "$6 off" },
    { points: 1_000, value: 15, label: "$15 off" },
  ].filter((option) => points >= option.points);
}

// Staff-only lookup for customer management workflows.
export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  const phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone || phone.length > 40) {
    return NextResponse.json(
      { error: "A valid phone number is required", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const customer = await db.customer.findUnique({
    where: { phone },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      loyaltyPoints: true,
      totalSpent: true,
      visits: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      customer,
      redemptionOptions: customer
        ? redemptionOptions(customer.loyaltyPoints)
        : [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Customer loyalty access requires proof of ownership of a linked order.
export async function POST(req: NextRequest) {
  try {
    const parsed = loyaltyCredentialsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid loyalty credentials", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const credentials = new Map(
      parsed.data.orders.map((entry) => [
        normalizeOrderNumber(entry.orderNumber),
        entry.accessToken,
      ])
    );
    const orders = await db.order.findMany({
      where: {
        orderNumber: { in: Array.from(credentials.keys()) },
        customerId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true, customerId: true },
    });

    const authorizedOrder = orders.find((order) =>
      verifyOrderAccessToken(order.id, credentials.get(order.orderNumber))
    );
    if (!authorizedOrder?.customerId) {
      return NextResponse.json(
        { customer: null, redemptionOptions: [] },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const customer = await db.customer.findUnique({
      where: { id: authorizedOrder.customerId },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        totalSpent: true,
        visits: true,
      },
    });

    return NextResponse.json(
      {
        customer,
        redemptionOptions: customer
          ? redemptionOptions(customer.loyaltyPoints)
          : [],
        redemptionEnabled: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof OrderAccessConfigurationError) {
      return NextResponse.json(
        { error: "Loyalty access is not configured", code: "ORDER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[customers/lookup] Loyalty lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load loyalty account", code: "LOYALTY_LOOKUP_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Point redemption must be applied through a validated checkout transaction",
      code: "DIRECT_REDEMPTION_DISABLED",
    },
    { status: 405, headers: { Allow: "GET, POST" } }
  );
}
