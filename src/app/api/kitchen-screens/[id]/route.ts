import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { broadcastKds } from "@/lib/kds/broadcast";

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const stationFilterSchema = z
  .string()
  .trim()
  .max(1_000)
  .refine(
    (value) =>
      value === "" ||
      value
        .split(",")
        .filter(Boolean)
        .every((slug) => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)),
    "Station filter contains an invalid slug"
  );
const screenUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(1_000).optional(),
    stationFilter: stationFilterSchema.optional(),
    screenType: z.enum(["prep", "expo", "all"]).optional(),
    layoutType: z.enum(["grid", "compact"]).optional(),
    autoRefreshSec: z.number().int().min(3).max(300).optional(),
    showCompleted: z.boolean().optional(),
    maxOrders: z.number().int().min(0).max(200).optional(),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

async function stationFilterExists(stationFilter: string): Promise<boolean> {
  const slugs = Array.from(
    new Set(stationFilter.split(",").map((slug) => slug.trim()).filter(Boolean))
  );
  if (slugs.length === 0) return true;

  const count = await db.kitchenStation.count({ where: { slug: { in: slugs } } });
  return count === slugs.length;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = screenUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid kitchen screen update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (
      parsed.data.stationFilter !== undefined &&
      !(await stationFilterExists(parsed.data.stationFilter))
    ) {
      return NextResponse.json(
        { error: "Station filter references an unknown station", code: "UNKNOWN_STATION" },
        { status: 400 }
      );
    }

    const screen = await db.kitchenScreen.update({
      where: { id },
      data: parsed.data,
    });
    await broadcastKds({
      type: "screen:update",
      screenSlugs: [screen.slug],
      payload: { screenId: screen.id },
    });

    return NextResponse.json({ screen });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That kitchen screen slug already exists", code: "SLUG_IN_USE" },
        { status: 409 }
      );
    }

    console.error("[kitchen-screens] Failed to update screen", error);
    return NextResponse.json(
      { error: "Unable to update kitchen screen", code: "KDS_SCREEN_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const screen = await db.kitchenScreen.delete({
      where: { id },
      select: { id: true, slug: true },
    });
    await broadcastKds({
      type: "screen:update",
      screenSlugs: [screen.slug],
      payload: { screenId: screen.id, deleted: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[kitchen-screens] Failed to delete screen", error);
    return NextResponse.json(
      { error: "Unable to delete kitchen screen", code: "KDS_SCREEN_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
