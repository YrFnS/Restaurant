import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auditContextFromRequest } from "@/lib/audit";
import {
  refreshWaitlist,
  waitlistErrorFromDatabase,
  WaitlistOperationsError,
} from "@/lib/waitlist/operations";

function configuredSecret(): string | null {
  const secret =
    process.env.WAITLIST_WORKER_SECRET ||
    process.env.CRON_SECRET ||
    process.env.KDS_OUTBOX_SECRET;
  if (!secret) return null;
  if (process.env.NODE_ENV === "production" && secret.length < 32) return null;
  return secret;
}

function suppliedSecret(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function noStore(status = 200) {
  return {
    status,
    headers: { "Cache-Control": "no-store" },
  };
}

async function processWaitlist(request: NextRequest) {
  const expectedSecret = configuredSecret();
  if (!expectedSecret) {
    return NextResponse.json(
      {
        error: "Waitlist worker is not configured",
        code: "WAITLIST_WORKER_NOT_CONFIGURED",
      },
      noStore(503)
    );
  }
  if (!secretsMatch(suppliedSecret(request), expectedSecret)) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      noStore(401)
    );
  }

  try {
    const context = auditContextFromRequest(request);
    const result = await db.$transaction(
      (tx) => refreshWaitlist(tx, context),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json(
      {
        expired: result.expired.length,
        active: result.active.length,
        processedAt: new Date().toISOString(),
      },
      noStore()
    );
  } catch (error) {
    if (error instanceof WaitlistOperationsError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        noStore(error.status)
      );
    }
    const mapped = waitlistErrorFromDatabase(error);
    if (mapped) {
      return NextResponse.json(
        { error: mapped.message, code: mapped.code, details: mapped.details },
        noStore(mapped.status)
      );
    }
    console.error("[internal/waitlist] Worker failed", error);
    return NextResponse.json(
      { error: "Unable to process waitlist", code: "WAITLIST_WORKER_FAILED" },
      noStore(500)
    );
  }
}

export async function GET(request: NextRequest) {
  return processWaitlist(request);
}

export async function POST(request: NextRequest) {
  return processWaitlist(request);
}
