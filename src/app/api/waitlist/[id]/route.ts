import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest } from "@/lib/audit";
import {
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";
import {
  closeWaitlistEntry,
  confirmWaitlistEntry,
  notifyWaitlistEntry,
  seatWaitlistEntry,
  serializeWaitlistForCustomer,
  serializeWaitlistForStaff,
  waitlistErrorFromDatabase,
  WaitlistOperationsError,
} from "@/lib/waitlist/operations";

const waitlistMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("notify") }).strict(),
  z.object({ action: z.literal("confirm") }).strict(),
  z.object({ action: z.literal("seat") }).strict(),
  z
    .object({
      action: z.literal("cancel"),
      reason: z.string().trim().max(2_000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("no_show"),
      reason: z.string().trim().max(2_000).nullable().optional(),
    })
    .strict(),
]);

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

function accessToken(req: NextRequest): string | null {
  const queryToken = new URL(req.url).searchParams.get("token");
  if (queryToken) return queryToken;
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerAuthorized = verifyCustomerAccessToken(
      "waitlist",
      id,
      accessToken(req)
    );
    const staffAuth = customerAuthorized
      ? null
      : await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
    if (staffAuth && "response" in staffAuth) return staffAuth.response;

    const parsed = waitlistMutationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid waitlist update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        noStore(400)
      );
    }

    if (
      customerAuthorized &&
      !["confirm", "cancel"].includes(parsed.data.action)
    ) {
      return NextResponse.json(
        {
          error: "This waitlist action requires staff authorization",
          code: "CUSTOMER_WAITLIST_CHANGE_DENIED",
        },
        noStore(403)
      );
    }

    const actor = staffAuth && !("response" in staffAuth)
      ? staffAuth.session
      : null;
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      async (tx) => {
        switch (parsed.data.action) {
          case "notify":
            if (!actor) {
              throw new WaitlistOperationsError(
                "Staff authorization is required",
                "AUTH_REQUIRED",
                401
              );
            }
            return {
              kind: "active" as const,
              ...(await notifyWaitlistEntry(tx, { id, actor, context })),
            };
          case "confirm":
            return {
              kind: "entry" as const,
              ...(await confirmWaitlistEntry(tx, { id, actor, context })),
            };
          case "seat":
            if (!actor) {
              throw new WaitlistOperationsError(
                "Staff authorization is required",
                "AUTH_REQUIRED",
                401
              );
            }
            return {
              kind: "active" as const,
              ...(await seatWaitlistEntry(tx, { id, actor, context })),
            };
          case "cancel":
            return {
              kind: "active" as const,
              ...(await closeWaitlistEntry(tx, {
                id,
                outcome: "cancelled",
                actor,
                context,
                reason: parsed.data.reason,
              })),
            };
          case "no_show":
            if (!actor) {
              throw new WaitlistOperationsError(
                "Staff authorization is required",
                "AUTH_REQUIRED",
                401
              );
            }
            return {
              kind: "active" as const,
              ...(await closeWaitlistEntry(tx, {
                id,
                outcome: "no_show",
                actor,
                context,
                reason: parsed.data.reason,
              })),
            };
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const entry = customerAuthorized
      ? serializeWaitlistForCustomer(result.entry)
      : serializeWaitlistForStaff(result.entry);
    return NextResponse.json(
      {
        entry,
        replayed: "replayed" in result ? result.replayed : false,
        activeCount: result.kind === "active" ? result.active.length : undefined,
      },
      noStore()
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Waitlist access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        noStore(503)
      );
    }
    if (error instanceof WaitlistOperationsError) return errorResponse(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);

    console.error("[waitlist] Failed to update waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to update waitlist entry", code: "WAITLIST_UPDATE_FAILED" },
      noStore(500)
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      (tx) =>
        closeWaitlistEntry(tx, {
          id,
          outcome: "cancelled",
          actor: auth.session,
          context,
          reason: "Cancelled from the staff waitlist console",
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(
      { entry: serializeWaitlistForStaff(result.entry), replayed: result.replayed },
      noStore()
    );
  } catch (error) {
    if (error instanceof WaitlistOperationsError) return errorResponse(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[waitlist] Failed to cancel waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to cancel waitlist entry", code: "WAITLIST_CANCEL_FAILED" },
      noStore(500)
    );
  }
}
