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
  createCustomerAccessToken,
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import {
  createWaitlistEntry,
  listWaitlistEntries,
  readWaitlistEntry,
  readWaitlistPolicy,
  refreshWaitlist,
  safeWaitlistPolicy,
  serializeWaitlistForCustomer,
  serializeWaitlistForStaff,
  waitlistErrorFromDatabase,
  WaitlistOperationsError,
  waitlistPosition,
} from "@/lib/waitlist/operations";

const waitlistCreateSchema = z
  .object({
    customerName: z.string().trim().min(1).max(160),
    customerPhone: z.string().trim().min(5).max(40),
    partySize: z.number().int().min(1).max(100),
    preference: z
      .enum(["any", "indoor", "outdoor", "bar", "private"])
      .nullable()
      .optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const adminQuerySchema = z
  .object({
    admin: z.literal("true"),
    scope: z.enum(["active", "recent", "all"]).default("active"),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  })
  .strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const WAITLIST_WINDOW_MS = 60_000;
const MAX_JOINS_PER_WINDOW = 10;
const MAX_READS_PER_WINDOW = 120;

function noStore(status = 200) {
  return {
    status,
    headers: { "Cache-Control": "no-store" },
  };
}

function waitlistError(error: WaitlistOperationsError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    noStore(error.status)
  );
}

function idempotencyKey(req: NextRequest): string {
  const key = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WaitlistOperationsError(
      "A valid Idempotency-Key header is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  return key;
}

async function publicLimit(req: NextRequest, scope: string, limit: number) {
  try {
    return await consumeRateLimit({
      scope,
      identifier: getRequestSource(req),
      limit,
      windowMs: WAITLIST_WINDOW_MS,
    });
  } catch (error) {
    console.error(`[waitlist] Shared ${scope} limiter failed`, error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const admin = searchParams.get("admin") === "true";
  const context = auditContextFromRequest(req);

  try {
    if (admin) {
      const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
      if ("response" in auth) return auth.response;

      const parsed = adminQuerySchema.safeParse(
        Object.fromEntries(searchParams.entries())
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid waitlist query", code: "VALIDATION_ERROR" },
          noStore(400)
        );
      }

      const result = await db.$transaction(async (tx) => {
        const refreshed = await refreshWaitlist(tx, context);
        const entries = await listWaitlistEntries(tx, {
          activeOnly: parsed.data.scope === "active",
          limit: parsed.data.limit,
        });
        const policy = await readWaitlistPolicy(tx);
        const active = refreshed.active;
        return {
          entries,
          active,
          policy,
          expiredCount: refreshed.expired.length,
        };
      });

      return NextResponse.json(
        {
          entries: result.entries.map(serializeWaitlistForStaff),
          activeCount: result.active.length,
          waitingCount: result.active.filter(
            (entry) => entry.status === "waiting"
          ).length,
          notifiedCount: result.active.filter(
            (entry) => entry.status === "notified"
          ).length,
          confirmedCount: result.active.filter(
            (entry) =>
              entry.status === "notified" &&
              entry.notificationConfirmedAt !== null
          ).length,
          expiredCount: result.expiredCount,
          policy: safeWaitlistPolicy(result.policy),
        },
        noStore()
      );
    }

    const limit = await publicLimit(
      req,
      "waitlist-read",
      MAX_READS_PER_WINDOW
    );
    if (!limit) {
      return NextResponse.json(
        {
          error: "The waitlist is temporarily unavailable",
          code: "RATE_LIMIT_UNAVAILABLE",
        },
        noStore(503)
      );
    }
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many waitlist requests", code: "WAITLIST_RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const id = searchParams.get("id");
    const token = searchParams.get("token");
    const tokenValid =
      id && token ? verifyCustomerAccessToken("waitlist", id, token) : false;

    const result = await db.$transaction(async (tx) => {
      const refreshed = await refreshWaitlist(tx, context);
      const policy = await readWaitlistPolicy(tx);
      const entry = id && tokenValid ? await readWaitlistEntry(tx, id) : null;
      return { active: refreshed.active, policy, entry };
    });
    const waitingCount = result.active.length;

    if (!id || !token) {
      return NextResponse.json(
        {
          entry: null,
          position: 0,
          waitingCount,
          policy: safeWaitlistPolicy(result.policy),
        },
        noStore()
      );
    }
    if (!tokenValid || !result.entry) {
      return NextResponse.json(
        {
          entry: null,
          position: 0,
          waitingCount,
          policy: safeWaitlistPolicy(result.policy),
        },
        noStore(404)
      );
    }

    return NextResponse.json(
      {
        entry: serializeWaitlistForCustomer(result.entry),
        position: ["waiting", "notified"].includes(result.entry.status)
          ? waitlistPosition(result.active, result.entry.id)
          : 0,
        waitingCount,
        policy: safeWaitlistPolicy(result.policy),
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
    if (error instanceof WaitlistOperationsError) return waitlistError(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return waitlistError(mapped);

    console.error("[waitlist] Failed to load waitlist", error);
    return NextResponse.json(
      { error: "Unable to load waitlist", code: "WAITLIST_LOAD_FAILED" },
      noStore(500)
    );
  }
}

export async function POST(req: NextRequest) {
  const limit = await publicLimit(
    req,
    "waitlist-create",
    MAX_JOINS_PER_WINDOW
  );
  if (!limit) {
    return NextResponse.json(
      {
        error: "The waitlist is temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      noStore(503)
    );
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many waitlist attempts", code: "WAITLIST_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  try {
    const key = idempotencyKey(req);
    const parsed = waitlistCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid waitlist entry",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        noStore(400)
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      (tx) =>
        createWaitlistEntry(tx, {
          idempotencyKey: key,
          ...parsed.data,
          source: "customer",
          actor: null,
          context,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      {
        entry: serializeWaitlistForCustomer(result.entry),
        position: waitlistPosition(result.active, result.entry.id),
        waitingCount: result.active.length,
        accessToken: createCustomerAccessToken("waitlist", result.entry.id),
        replayed: result.replayed,
      },
      noStore(result.replayed ? 200 : 201)
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
    if (error instanceof WaitlistOperationsError) return waitlistError(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return waitlistError(mapped);

    console.error("[waitlist] Failed to create waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to join the waitlist", code: "WAITLIST_CREATE_FAILED" },
      noStore(500)
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(
      (tx) => refreshWaitlist(tx, context),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(
      {
        entries: result.active.map(serializeWaitlistForStaff),
        activeCount: result.active.length,
        expiredCount: result.expired.length,
      },
      noStore()
    );
  } catch (error) {
    if (error instanceof WaitlistOperationsError) return waitlistError(error);
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) return waitlistError(mapped);
    console.error("[waitlist] Failed to refresh estimates", error);
    return NextResponse.json(
      { error: "Unable to refresh waitlist", code: "WAITLIST_REFRESH_FAILED" },
      noStore(500)
    );
  }
}
