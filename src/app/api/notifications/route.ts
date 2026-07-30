import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/guard";

const notificationPatchSchema = z.union([
  z.object({ markAllRead: z.literal(true) }).strict(),
  z.object({ id: z.string().trim().min(1).max(191) }).strict(),
]);

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession();
  if ("response" in auth) return auth.response;

  const requestedLimit = Number(
    new URL(req.url).searchParams.get("limit") || "50"
  );
  if (
    !Number.isInteger(requestedLimit) ||
    requestedLimit < 1 ||
    requestedLimit > 100
  ) {
    return NextResponse.json(
      { error: "Limit must be between 1 and 100", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: requestedLimit,
    });
    return NextResponse.json(
      { notifications },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[notifications] Failed to load notifications", error);
    return NextResponse.json(
      { error: "Unable to load notifications", code: "NOTIFICATIONS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession();
  if ("response" in auth) return auth.response;

  try {
    const parsed = notificationPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid notification update", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if ("markAllRead" in parsed.data) {
      await db.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ ok: true });
    }

    const notification = await db.notification.update({
      where: { id: parsed.data.id },
      data: { isRead: true },
    });
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("[notifications] Failed to update notification", error);
    return NextResponse.json(
      { error: "Unable to update notification", code: "NOTIFICATION_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
