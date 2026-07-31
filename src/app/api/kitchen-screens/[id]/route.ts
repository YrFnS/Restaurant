import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, STAFF_ADMIN_ROLES } from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  flushKdsOutboxBestEffort,
  queueKdsEvent,
} from "@/lib/kds/outbox";

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

    const existing = await db.kitchenScreen.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Kitchen screen not found", code: "KDS_SCREEN_NOT_FOUND" },
        { status: 404 }
      );
    }

    const context = auditContextFromRequest(req);
    const screen = await db.$transaction(async (tx) => {
      const updated = await tx.kitchenScreen.update({
        where: { id },
        data: parsed.data,
      });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "kds.screen.update",
        entityType: "KitchenScreen",
        entityId: id,
        context,
        metadata: {
          changedFields: Object.keys(parsed.data),
          before: {
            name: existing.name,
            slug: existing.slug,
            stationFilter: existing.stationFilter,
            screenType: existing.screenType,
            layoutType: existing.layoutType,
            autoRefreshSec: existing.autoRefreshSec,
            showCompleted: existing.showCompleted,
            maxOrders: existing.maxOrders,
            sortOrder: existing.sortOrder,
            isActive: existing.isActive,
          },
          after: {
            name: updated.name,
            slug: updated.slug,
            stationFilter: updated.stationFilter,
            screenType: updated.screenType,
            layoutType: updated.layoutType,
            autoRefreshSec: updated.autoRefreshSec,
            showCompleted: updated.showCompleted,
            maxOrders: updated.maxOrders,
            sortOrder: updated.sortOrder,
            isActive: updated.isActive,
          },
        },
      });

      await queueKdsEvent(tx, {
        type: "screen:update",
        screenSlugs: [existing.slug, updated.slug],
        payload: { screenId: updated.id },
      });

      return updated;
    });

    await flushKdsOutboxBestEffort(10);
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const context = auditContextFromRequest(req);
    await db.$transaction(async (tx) => {
      const existing = await tx.kitchenScreen.findUnique({ where: { id } });
      if (!existing) throw new Error("KDS_SCREEN_NOT_FOUND");

      await tx.kitchenScreen.delete({ where: { id } });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "kds.screen.delete",
        entityType: "KitchenScreen",
        entityId: id,
        context,
        metadata: {
          name: existing.name,
          slug: existing.slug,
          stationFilter: existing.stationFilter,
          screenType: existing.screenType,
          isActive: existing.isActive,
        },
      });
      await queueKdsEvent(tx, {
        type: "screen:update",
        screenSlugs: [existing.slug],
        payload: { screenId: id, deleted: true },
      });
    });

    await flushKdsOutboxBestEffort(10);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "KDS_SCREEN_NOT_FOUND") {
      return NextResponse.json(
        { error: "Kitchen screen not found", code: "KDS_SCREEN_NOT_FOUND" },
        { status: 404 }
      );
    }

    console.error("[kitchen-screens] Failed to delete screen", error);
    return NextResponse.json(
      { error: "Unable to delete kitchen screen", code: "KDS_SCREEN_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
