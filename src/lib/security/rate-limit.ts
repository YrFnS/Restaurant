import "server-only";

import { db } from "@/lib/db";
import { createRateLimitDescriptor } from "./rate-limit-key";

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
  expiresAt: Date;
}

interface RateLimitRow {
  count: number;
  expiresAt: Date;
}

function getRateLimitSecret(): string {
  const secret =
    process.env.RATE_LIMIT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new RateLimitConfigurationError(
        "Shared rate limiting is not configured"
      );
    }
    return "restaurant-development-rate-limit-secret";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new RateLimitConfigurationError(
      "RATE_LIMIT_SECRET must be at least 32 characters"
    );
  }

  return secret;
}

export function getRequestSource(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const source = forwarded || request.headers.get("x-real-ip") || "unknown";
  return source.slice(0, 512);
}

export async function consumeRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
  now = new Date(),
}: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitResult> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000_000) {
    throw new RateLimitConfigurationError("Rate-limit threshold is invalid");
  }

  let descriptor;
  try {
    descriptor = createRateLimitDescriptor({
      secret: getRateLimitSecret(),
      scope,
      identifier,
      windowMs,
      now,
    });
  } catch (error) {
    throw new RateLimitConfigurationError(
      error instanceof Error ? error.message : "Rate-limit policy is invalid"
    );
  }

  const rows = await db.$queryRaw<RateLimitRow[]>`
    INSERT INTO "RateLimitCounter" (
      "key",
      "scope",
      "count",
      "expiresAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${descriptor.key},
      ${descriptor.scope},
      1,
      ${descriptor.expiresAt},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = "RateLimitCounter"."count" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0];
  if (!row) throw new Error("Rate-limit counter was not returned");

  const count = Number(row.count);
  const expiresAt = new Date(row.expiresAt);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000)
  );

  // Deterministic low-frequency cleanup keeps expired fixed-window rows bounded
  // without turning every public request into a table-wide delete.
  if (descriptor.key.endsWith("00")) {
    const cleanupBefore = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    await db.rateLimitCounter
      .deleteMany({ where: { expiresAt: { lt: cleanupBefore } } })
      .catch((error) =>
        console.warn("[rate-limit] Expired counter cleanup failed", error)
      );
  }

  return {
    allowed: count <= limit,
    limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds,
    expiresAt,
  };
}

export async function resetRateLimit({
  scope,
  identifier,
  windowMs,
  now = new Date(),
}: {
  scope: string;
  identifier: string;
  windowMs: number;
  now?: Date;
}): Promise<void> {
  const descriptor = createRateLimitDescriptor({
    secret: getRateLimitSecret(),
    scope,
    identifier,
    windowMs,
    now,
  });
  await db.rateLimitCounter.deleteMany({ where: { key: descriptor.key } });
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.expiresAt.getTime() / 1_000)),
    ...(result.allowed
      ? {}
      : { "Retry-After": String(result.retryAfterSeconds) }),
    "Cache-Control": "no-store",
  };
}
