import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  readWaitlistPolicy,
  recalculateWaitlistEstimates,
  safeWaitlistPolicy,
  waitlistErrorFromDatabase,
  WaitlistOperationsError,
} from "@/lib/waitlist/operations";

const policySchema = z
  .object({
    enabled: z.boolean(),
    averageTurnoverMinutes: z.number().int().min(15).max(480),
    notificationExpiryMinutes: z.number().int().min(1).max(120),
    estimatePaddingMinutes: z.number().int().min(0).max(120),
    maxQuoteMinutes: z.number().int().min(15).max(1440),
    requireConfirmation: z.boolean(),
  })
  .strict();

function noStore(status = 200) {
  return {
    status,
    headers: { "Cache-Control": "no-store" },
  };
}

function errorResponse(error: WaitlistOperationsError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    noStore(error.status)
  );
}

export async function GET() {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const policy = await db.$transaction((tx) => readWaitlistPolicy(tx));
    return NextResponse.json(
      { policy: safeWaitlistPolicy(policy) },
      noStore()
    );
  } catch (error) {
    if (error instanceof WaitlistOperationsError) return errorResponse(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[waitlist/settings] Failed to load policy", error);
    return NextResponse.json(
      { error: "Unable to load waitlist policy", code: "WAITLIST_POLICY_LOAD_FAILED" },
      noStore(500)
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = policySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid waitlist policy",
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      },
      noStore(400)
    );
  }

  try {
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      async (tx) => {
        const before = await readWaitlistPolicy(tx);
        await tx.$executeRaw(Prisma.sql`
          UPDATE "RestaurantSettings"
          SET
            "waitlistEnabled" = ${parsed.data.enabled},
            "waitlistAverageTurnoverMinutes" = ${parsed.data.averageTurnoverMinutes},
            "waitlistNotificationExpiryMinutes" = ${parsed.data.notificationExpiryMinutes},
            "waitlistEstimatePaddingMinutes" = ${parsed.data.estimatePaddingMinutes},
            "waitlistMaxQuoteMinutes" = ${parsed.data.maxQuoteMinutes},
            "waitlistRequireConfirmation" = ${parsed.data.requireConfirmation},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = '1'
        `);
        const after = await readWaitlistPolicy(tx);
        await recalculateWaitlistEstimates(tx);
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "waitlist.policy.update",
          entityType: "RestaurantSettings",
          entityId: "1",
          context,
          metadata: {
            before: safeWaitlistPolicy(before),
            after: safeWaitlistPolicy(after),
          },
        });
        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      { policy: safeWaitlistPolicy(result) },
      noStore()
    );
  } catch (error) {
    if (error instanceof WaitlistOperationsError) return errorResponse(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[waitlist/settings] Failed to update policy", error);
    return NextResponse.json(
      { error: "Unable to update waitlist policy", code: "WAITLIST_POLICY_UPDATE_FAILED" },
      noStore(500)
    );
  }
}
