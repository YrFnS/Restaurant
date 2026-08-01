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

const stationSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    icon: z.string().trim().min(1).max(64).default("ChefHat"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f59e0b"),
    targetPrepMin: z.number().int().min(1).max(1_440).default(15),
    sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export async function GET() {
  const auth = await requireStaffSession(KITCHEN_OPERATION_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const stations = await db.kitchenStation.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(
      { stations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[stations] Failed to load stations", error);
    return NextResponse.json(
      { error: "Unable to load kitchen stations", code: "STATIONS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(STAFF_ADMIN_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = stationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid kitchen station",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const station = await db.$transaction(async (tx) => {
      const created = await tx.kitchenStation.create({ data: parsed.data });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "kds.station.create",
        entityType: "KitchenStation",
        entityId: created.id,
        context,
        metadata: {
          name: created.name,
          slug: created.slug,
          targetPrepMin: created.targetPrepMin,
          sortOrder: created.sortOrder,
          isActive: created.isActive,
        },
      });

      await queueKdsEvent(tx, {
        type: "screen:update",
        screenSlugs: [],
        payload: { stationId: created.id, created: true },
      });

      return created;
    });

    await flushKdsOutboxBestEffort(10);
    return NextResponse.json({ station }, { status: 201 });
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

    console.error("[stations] Failed to create station", error);
    return NextResponse.json(
      { error: "Unable to create kitchen station", code: "STATION_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
