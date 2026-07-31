import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  MENU_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const pricingRuleSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160).optional(),
    type: z.enum(["happy_hour", "lunch_special", "surge"]).default("happy_hour"),
    multiplier: z.number().positive().max(10).default(1),
    dayOfWeek: z.number().int().min(-1).max(6).default(-1),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (value) => Boolean(value.startTime) === Boolean(value.endTime),
    {
      message: "Start and end time must be provided together",
      path: ["endTime"],
    }
  );

function isRuleActive(
  rule: { dayOfWeek: number | null; startTime: string | null; endTime: string | null },
  now: Date
): boolean {
  if (
    rule.dayOfWeek !== null &&
    rule.dayOfWeek !== -1 &&
    rule.dayOfWeek !== now.getDay()
  ) {
    return false;
  }

  if (!rule.startTime || !rule.endTime) return true;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  if (rule.startTime <= rule.endTime) {
    return hhmm >= rule.startTime && hhmm < rule.endTime;
  }
  return hhmm >= rule.startTime || hhmm < rule.endTime;
}

export async function GET(req: NextRequest) {
  const activeOnly = new URL(req.url).searchParams.get("active") === "true";

  if (!activeOnly) {
    const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
    if ("response" in auth) return auth.response;
  }

  try {
    const rules = await db.dynamicPricing.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        type: true,
        multiplier: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = activeOnly
      ? rules.filter((rule) => isRuleActive(rule, new Date()))
      : rules;
    return NextResponse.json(
      { rules: result },
      {
        headers: {
          "Cache-Control": activeOnly ? "public, max-age=30" : "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[dynamic-pricing] Failed to load rules", error);
    return NextResponse.json(
      { error: "Unable to load pricing rules", code: "PRICING_RULES_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = pricingRuleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid pricing rule",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const rule = await db.$transaction(async (tx) => {
      const created = await tx.dynamicPricing.create({
        data: {
          ...parsed.data,
          nameAr: parsed.data.nameAr || parsed.data.nameEn,
          startTime: parsed.data.startTime || null,
          endTime: parsed.data.endTime || null,
        },
      });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "dynamic-pricing.create",
        entityType: "DynamicPricing",
        entityId: created.id,
        context,
        metadata: {
          nameEn: created.nameEn,
          type: created.type,
          multiplier: created.multiplier,
          dayOfWeek: created.dayOfWeek,
          startTime: created.startTime,
          endTime: created.endTime,
          isActive: created.isActive,
        },
      });

      return created;
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("[dynamic-pricing] Failed to create rule", error);
    return NextResponse.json(
      { error: "Unable to create pricing rule", code: "PRICING_RULE_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
