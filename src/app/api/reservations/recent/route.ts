import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";

const credentialsSchema = z
  .object({
    reservations: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(191),
            accessToken: z.string().trim().min(20).max(200),
            createdAt: z.string().datetime().optional(),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const parsed = credentialsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reservation credentials", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const credentials = new Map(
      parsed.data.reservations.map((entry) => [entry.id, entry.accessToken])
    );
    const reservations = await db.reservation.findMany({
      where: { id: { in: Array.from(credentials.keys()) } },
      orderBy: { dateTime: "asc" },
      select: {
        id: true,
        customerName: true,
        partySize: true,
        dateTime: true,
        status: true,
        occasion: true,
        preference: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        table: {
          select: { id: true, number: true, section: true },
        },
      },
    });

    const authorizedReservations = reservations.filter((reservation) =>
      verifyCustomerAccessToken(
        "reservation",
        reservation.id,
        credentials.get(reservation.id)
      )
    );

    return NextResponse.json(
      { reservations: authorizedReservations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        { error: "Reservation access is not configured", code: "CUSTOMER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[reservations/recent] Failed to load reservations", error);
    return NextResponse.json(
      { error: "Unable to load reservations", code: "RECENT_RESERVATIONS_FAILED" },
      { status: 500 }
    );
  }
}
