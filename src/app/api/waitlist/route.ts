import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
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

const waitlistCreateSchema = z
  .object({
    customerName: z.string().trim().min(1).max(160),
    customerPhone: z.string().trim().min(5).max(40),
    partySize: z.number().int().min(1).max(50),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

const WAITLIST_WINDOW_MS = 60_000;
const MAX_JOINS_PER_WINDOW = 10;
type WaitlistBucket = { count: number; resetAt: number };
const globalForWaitlistLimit = globalThis as unknown as {
  restaurantWaitlistRateLimits?: Map<string, WaitlistBucket>;
};
const waitlistRateLimits =
  globalForWaitlistLimit.restaurantWaitlistRateLimits ??
  new Map<string, WaitlistBucket>();
if (!globalForWaitlistLimit.restaurantWaitlistRateLimits) {
  globalForWaitlistLimit.restaurantWaitlistRateLimits = waitlistRateLimits;
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function consumeWaitlistLimit(key: string): number | null {
  const now = Date.now();
  const existing = waitlistRateLimits.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + WAITLIST_WINDOW_MS };
  bucket.count += 1;
  waitlistRateLimits.set(key, bucket);
  if (bucket.count <= MAX_JOINS_PER_WINDOW) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get("admin") === "true";
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  try {
    if (admin) {
      const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
      if ("response" in auth) return auth.response;

      const entries = await db.waitlistEntry.findMany({
        where: { status: { in: ["waiting", "notified"] } },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(
        { entries, waitingCount: entries.length },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const waitingCount = await db.waitlistEntry.count({
      where: { status: { in: ["waiting", "notified"] } },
    });

    if (!id || !token) {
      return NextResponse.json(
        { entry: null, position: 0, waitingCount },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const entry = await db.waitlistEntry.findUnique({
      where: { id },
      select: {
        id: true,
        customerName: true,
        partySize: true,
        status: true,
        estimatedWait: true,
        seatedAt: true,
        notifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (
      !entry ||
      !verifyCustomerAccessToken("waitlist", entry.id, token)
    ) {
      return NextResponse.json(
        { entry: null, position: 0, waitingCount },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const position = ["waiting", "notified"].includes(entry.status)
      ? (await db.waitlistEntry.count({
          where: {
            status: { in: ["waiting", "notified"] },
            createdAt: { lt: entry.createdAt },
          },
        })) + 1
      : 0;

    return NextResponse.json(
      { entry, position, waitingCount },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        { error: "Waitlist access is not configured", code: "CUSTOMER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[waitlist] Failed to load waitlist", error);
    return NextResponse.json(
      { error: "Unable to load waitlist", code: "WAITLIST_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let waitlistLimit;
  try {
    waitlistLimit = await consumeRateLimit({
      scope: "waitlist-create",
      identifier: getRequestSource(req),
      limit: MAX_JOINS_PER_WINDOW,
      windowMs: WAITLIST_WINDOW_MS,
    });
  } catch (error) {
    console.error("[waitlist] Shared rate limiter failed", error);
    return NextResponse.json(
      { error: "The waitlist is temporarily unavailable", code: "RATE_LIMIT_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!waitlistLimit.allowed) {
    return NextResponse.json(
      { error: "Too many waitlist attempts", code: "WAITLIST_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(waitlistLimit) }
    );
  }

  try {
    const parsed = waitlistCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid waitlist entry",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await db.waitlistEntry.findFirst({
      where: {
        customerPhone: parsed.data.customerPhone,
        status: { in: ["waiting", "notified"] },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This phone number is already on the active waitlist", code: "DUPLICATE_WAITLIST_ENTRY" },
        { status: 409 }
      );
    }

    const ahead = await db.waitlistEntry.count({
      where: { status: { in: ["waiting", "notified"] } },
    });
    const estimatedWait = Math.min(180, 15 + ahead * 12);

    const entry = await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: parsed.data.customerPhone },
        update: { name: parsed.data.customerName },
        create: {
          name: parsed.data.customerName,
          phone: parsed.data.customerPhone,
        },
        select: { id: true },
      });

      return tx.waitlistEntry.create({
        data: {
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          partySize: parsed.data.partySize,
          notes: parsed.data.notes || null,
          estimatedWait,
          customerId: customer.id,
        },
        select: {
          id: true,
          customerName: true,
          partySize: true,
          status: true,
          estimatedWait: true,
          seatedAt: true,
          notifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json(
      {
        entry,
        position: ahead + 1,
        waitingCount: ahead + 1,
        accessToken: createCustomerAccessToken("waitlist", entry.id),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        { error: "Waitlist access is not configured", code: "CUSTOMER_ACCESS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    console.error("[waitlist] Failed to create waitlist entry", error);
    return NextResponse.json(
      { error: "Unable to join the waitlist", code: "WAITLIST_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
