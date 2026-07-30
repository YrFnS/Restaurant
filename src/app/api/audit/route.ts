import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth/guard";

const AUDIT_READ_ROLES = ["owner", "admin"] as const;
const auditQuerySchema = z
  .object({
    action: z.string().trim().max(160).optional(),
    entityType: z.string().trim().max(120).optional(),
    entityId: z.string().trim().max(191).optional(),
    actorId: z.string().trim().max(191).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(AUDIT_READ_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = auditQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid audit query",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const createdAt: Prisma.DateTimeFilter | undefined =
      parsed.data.from || parsed.data.to
        ? {
            ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
            ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
          }
        : undefined;
    const where: Prisma.AuditEventWhereInput = {
      ...(parsed.data.action
        ? { action: { startsWith: parsed.data.action } }
        : {}),
      ...(parsed.data.entityType
        ? { entityType: parsed.data.entityType }
        : {}),
      ...(parsed.data.entityId ? { entityId: parsed.data.entityId } : {}),
      ...(parsed.data.actorId ? { actorId: parsed.data.actorId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const events = await db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
    });

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[audit] Failed to load audit events", error);
    return NextResponse.json(
      { error: "Unable to load audit events", code: "AUDIT_LOAD_FAILED" },
      { status: 500 }
    );
  }
}