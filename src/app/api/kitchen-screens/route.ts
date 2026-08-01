import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  KITCHEN_OPERATION_ROLES,
  STAFF_ADMIN_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
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
const screenSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    description: z.string().trim().max(1_000).default(""),
    stationFilter: stationFilterSchema.default(""),
    screenType: z.enum(["prep", "expo", "all"]).default("prep"),
    layoutType: z.enum(["grid", "compact"]).default("grid"),
    autoRefreshSec: z.number().int().min(3).max(300).default(10),
    showCompleted: z.boolean().default(false),
    maxOrders: z.number().int().min(0).max(200).default(0),
    sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

async function stationFilterExists(stationFilter: string): Promise<boolean> {
  const slugs = Array.from(
    new Set(stationFilter.split(",").map((slug) => slug.trim()).filter(Boolean))
  );
  if (slugs.length === 0) return true;

  const count = await db.kitchenStation.count({ where: { slug: { in: slugs } } });
  return count === slugs.length;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(KITCHEN_OPERATION_ROLES);
  if ("response" in auth) return auth.response;

  const slug = new URL(req.url).searchParams.get("slug");
  if (slug && !slugSchema.safeParse(slug).success) {
    return NextResponse.json(
      { error: "Invalid kitchen screen slug", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    if (slug) {
      const screen = await db.kitchenScreen.findUnique({ where: { slug } });
      if (!screen) {
        return NextResponse.json(
          { screen: null, code: "KDS_SCREEN_NOT_FOUND" },
          { status: 404 }
        );
      }

      const stationSlugs = screen.stationFilter
        ? screen.stationFilter.split(",").filter(Boolean)
        : [];
      const stations = await db.kitchenStation.findMany({
        where: stationSlugs.length ? { slug: { in: stationSlugs } } : undefined,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(
        { screen, stations },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const [screens, stations] = await Promise.all([
      db.kitchenScreen.findMany({ orderBy: { sortOrder: "asc" } }),
      db.kitchenStation.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return NextResponse.json(
      { screens, stations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[kitchen-screens] Failed to load configuration", error);
    return NextResponse.json(
      { error: "Unable to load kitchen screens", code: "KDS_SCREENS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = screenSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid kitchen screen",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (!(await stationFilterExists(parsed.data.stationFilter))) {
      return NextResponse.json(
        { error: "Station filter references an unknown station", code: "UNKNOWN_STATION" },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const screen = await db.$transaction(async (tx) => {
      const created = await tx.kitchenScreen.create({ data: parsed.data });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "kds.screen.create",
        entityType: "KitchenScreen",
        entityId: created.id,
        context,
        metadata: {
          slug: created.slug,
          screenType: created.screenType,
          layoutType: created.layoutType,
          stationFilter: created.stationFilter,
          isActive: created.isActive,
        },
      });

      await queueKdsEvent(tx, {
        type: "screen:update",
        screenSlugs: [created.slug],
        payload: { screenId: created.id, created: true },
      });

      return created;
    });

    await flushKdsOutboxBestEffort(10);
    return NextResponse.json({ screen }, { status: 201 });
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

    console.error("[kitchen-screens] Failed to create screen", error);
    return NextResponse.json(
      { error: "Unable to create kitchen screen", code: "KDS_SCREEN_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
