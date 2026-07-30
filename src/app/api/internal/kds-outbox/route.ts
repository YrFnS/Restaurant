import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { flushKdsOutbox } from "@/lib/kds/outbox";

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(25),
  })
  .strict();

function configuredSecret(): string | null {
  const secret = process.env.KDS_OUTBOX_SECRET || process.env.CRON_SECRET;
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

async function processOutbox(request: NextRequest) {
  const expectedSecret = configuredSecret();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "KDS outbox worker is not configured", code: "OUTBOX_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!secretsMatch(suppliedSecret(request), expectedSecret)) {
    return NextResponse.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid outbox request", code: "VALIDATION_ERROR" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await flushKdsOutbox(parsed.data.limit);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[internal/kds-outbox] Worker failed", error);
    return NextResponse.json(
      { error: "Unable to process KDS outbox", code: "OUTBOX_PROCESS_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(request: NextRequest) {
  return processOutbox(request);
}

export async function POST(request: NextRequest) {
  return processOutbox(request);
}