import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { broadcastKds } from "@/lib/kds/broadcast";

const stationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).optional(),
    icon: z.string().trim().min(1).max(64).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    targetPrepMin: z.number().int().min(1).max(1_440).optional(),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

function includesExactSlug(csv: string, slug: string): boolean {
  return csv.split(",").map((value) => value.trim()).filter(Boolean).includes(slug);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = stationUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid kitchen station update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await db.kitchenStation.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Kitchen station not found", code: "STATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const station = await db.$transaction(async (tx) => {
      const updated = await tx.kitchenStation.update({
        where: { id },
        data: parsed.data,
      });

      if (parsed.data.slug && parsed.data.slug !== existing.slug) {
        const [screens, categories] = await Promise.all([
          tx.kitchenScreen.findMany({
            where: { stationFilter: { contains: existing.slug } },
            select: { id: true, stationFilter: true },
          }),
          tx.menuCategory.findMany({
            where: { stationSlugs: { contains: existing.slug } },
            select: { id: true, stationSlugs: true },
          }),
        ]);

        for (const screen of screens) {
          if (!includesExactSlug(screen.stationFilter, existing.slug)) continue;
          const stationFilter = screen.stationFilter
            .split(",")
            .map((slug) => slug.trim())
            .filter(Boolean)
            .map((slug) => (slug === existing.slug ? parsed.data.slug! : slug))
            .join(",");
          await tx.kitchenScreen.update({
            where: { id: screen.id },
            data: { stationFilter },
          });
        }

        for (const category of categories) {
          if (!includesExactSlug(category.stationSlugs, existing.slug)) continue;
          const stationSlugs = category.stationSlugs
            .split(",")
            .map((slug) => slug.trim())
            .filter(Boolean)
            .map((slug) => (slug === existing.slug ? parsed.data.slug! : slug))
            .join(",");
          await tx.menuCategory.update({
            where: { id: category.id },
            data: { stationSlugs },
          });
        }
      }

      return updated;
    });

    await broadcastKds({
      type: "screen:update",
      payload: { stationId: station.id },
    });
    return NextResponse.json({ station });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That station slug already exists", code: "SLUG_IN_USE" },
        { status: 409 }
      );
    }

    console.error("[stations] Failed to update station", error);
    return NextResponse.json(
      { error: "Unable to update kitchen station", code: "STATION_UPDATE_FAILED" },
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
    const station = await db.kitchenStation.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!station) {
      return NextResponse.json(
        { error: "Kitchen station not found", code: "STATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const [screens, categories] = await Promise.all([
      db.kitchenScreen.findMany({
        where: { stationFilter: { contains: station.slug } },
        select: { stationFilter: true },
      }),
      db.menuCategory.findMany({
        where: { stationSlugs: { contains: station.slug } },
        select: { stationSlugs: true },
      }),
    ]);
    const screenReferences = screens.filter((screen) =>
      includesExactSlug(screen.stationFilter, station.slug)
    ).length;
    const categoryReferences = categories.filter((category) =>
      includesExactSlug(category.stationSlugs, station.slug)
    ).length;

    if (screenReferences > 0 || categoryReferences > 0) {
      return NextResponse.json(
        {
          error: "Reassign this station from screens and menu categories before deleting it",
          code: "STATION_IN_USE",
          references: {
            screens: screenReferences,
            categories: categoryReferences,
          },
        },
        { status: 409 }
      );
    }

    await db.kitchenStation.delete({ where: { id } });
    await broadcastKds({
      type: "screen:update",
      payload: { stationId: id, deleted: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stations] Failed to delete station", error);
    return NextResponse.json(
      { error: "Unable to delete kitchen station", code: "STATION_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
