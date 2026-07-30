import { NextRequest, NextResponse } from "next/server";
import {
  AuthConfigurationError,
  setStaffSession,
} from "@/lib/auth/session";
import { authenticateEmployeePin } from "@/lib/auth/employee-pin";
import { PinConfigurationError } from "@/lib/auth/pin";
import { db } from "@/lib/db";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

const PIN_PATTERN = /^\d{4,8}$/;
const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type AttemptBucket = {
  failures: number;
  resetAt: number;
  blockedUntil: number;
};

const globalForLoginLimit = globalThis as unknown as {
  restaurantLoginAttempts?: Map<string, AttemptBucket>;
};

const loginAttempts =
  globalForLoginLimit.restaurantLoginAttempts ?? new Map<string, AttemptBucket>();

if (!globalForLoginLimit.restaurantLoginAttempts) {
  globalForLoginLimit.restaurantLoginAttempts = loginAttempts;
}

function getClientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function getActiveBucket(key: string): AttemptBucket | null {
  const bucket = loginAttempts.get(key);
  if (!bucket) return null;

  const now = Date.now();
  if (bucket.resetAt <= now && bucket.blockedUntil <= now) {
    loginAttempts.delete(key);
    return null;
  }

  return bucket;
}

function recordFailure(key: string): AttemptBucket {
  const now = Date.now();
  const existing = getActiveBucket(key);
  const bucket: AttemptBucket = existing ?? {
    failures: 0,
    resetAt: now + WINDOW_MS,
    blockedUntil: 0,
  };

  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.blockedUntil = now + BLOCK_MS;
  }
  loginAttempts.set(key, bucket);
  return bucket;
}

function invalidCredentials(status = 401, retryAfterSeconds?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);

  return NextResponse.json(
    {
      error: status === 429 ? "Too many login attempts" : "Invalid credentials",
      code: status === 429 ? "LOGIN_RATE_LIMITED" : "INVALID_CREDENTIALS",
    },
    { status, headers }
  );
}

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const bucket = getActiveBucket(clientKey);
  const now = Date.now();

  if (bucket?.blockedUntil && bucket.blockedUntil > now) {
    return invalidCredentials(429, Math.ceil((bucket.blockedUntil - now) / 1000));
  }

  let pin = "";
  try {
    const body = await req.json();
    pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  } catch {
    return invalidCredentials();
  }

  if (!PIN_PATTERN.test(pin)) {
    recordFailure(clientKey);
    return invalidCredentials();
  }

  try {
    const employee = await authenticateEmployeePin(pin);

    if (!employee) {
      recordFailure(clientKey);
      return invalidCredentials();
    }

    await writeAuditEvent(db, {
      actor: employee,
      action: "auth.login.success",
      entityType: "Employee",
      entityId: employee.id,
      context: auditContextFromRequest(req),
      metadata: {
        role: employee.role,
      },
    });
    await setStaffSession(employee.id);
    loginAttempts.delete(clientKey);

    return NextResponse.json(
      {
        user: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (
      error instanceof AuthConfigurationError ||
      error instanceof PinConfigurationError
    ) {
      return NextResponse.json(
        { error: "Authentication is not configured", code: "AUTH_NOT_CONFIGURED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("[auth/login] Login failed", error);
    return NextResponse.json(
      { error: "Unable to sign in", code: "LOGIN_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}