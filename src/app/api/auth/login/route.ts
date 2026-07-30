import { NextRequest, NextResponse } from "next/server";
import {
  AuthConfigurationError,
  clearStaffSession,
  setStaffSession,
} from "@/lib/auth/session";
import { authenticateEmployeePin } from "@/lib/auth/employee-pin";
import { PinConfigurationError } from "@/lib/auth/pin";
import { db } from "@/lib/db";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
  resetRateLimit,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

const PIN_PATTERN = /^\d{4,8}$/;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const MAX_SOURCE_ATTEMPTS = 30;
const MAX_PIN_ATTEMPTS = 5;

function invalidCredentials(
  status = 401,
  rateLimit?: RateLimitResult
) {
  return NextResponse.json(
    {
      error: status === 429 ? "Too many login attempts" : "Invalid credentials",
      code: status === 429 ? "LOGIN_RATE_LIMITED" : "INVALID_CREDENTIALS",
    },
    {
      status,
      headers: rateLimit
        ? rateLimitHeaders(rateLimit)
        : { "Cache-Control": "no-store" },
    }
  );
}

function rateLimitUnavailable() {
  return NextResponse.json(
    {
      error: "Authentication is temporarily unavailable",
      code: "RATE_LIMIT_UNAVAILABLE",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const source = getRequestSource(req);
  let sourceLimit: RateLimitResult;

  try {
    sourceLimit = await consumeRateLimit({
      scope: "auth-login-source",
      identifier: source,
      limit: MAX_SOURCE_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    });
  } catch (error) {
    console.error("[auth/login] Shared source limiter failed", error);
    return rateLimitUnavailable();
  }

  if (!sourceLimit.allowed) {
    return invalidCredentials(429, sourceLimit);
  }

  let pin = "";
  try {
    const body = await req.json();
    pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  } catch {
    return invalidCredentials(401, sourceLimit);
  }

  if (!PIN_PATTERN.test(pin)) {
    return invalidCredentials(401, sourceLimit);
  }

  let pinLimit: RateLimitResult;
  try {
    pinLimit = await consumeRateLimit({
      scope: "auth-login-pin",
      identifier: pin,
      limit: MAX_PIN_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    });
  } catch (error) {
    console.error("[auth/login] Shared credential limiter failed", error);
    return rateLimitUnavailable();
  }

  if (!pinLimit.allowed) {
    return invalidCredentials(429, pinLimit);
  }

  try {
    const employee = await authenticateEmployeePin(pin);

    if (!employee) {
      return invalidCredentials(401, pinLimit);
    }

    const issuedSession = await setStaffSession(employee.id);
    try {
      await writeAuditEvent(db, {
        actor: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
          sessionId: issuedSession.sessionId,
        },
        action: "auth.login.success",
        entityType: "Employee",
        entityId: employee.id,
        context: auditContextFromRequest(req),
        metadata: {
          role: employee.role,
          expiresAt: issuedSession.expiresAt,
        },
      });
    } catch (auditError) {
      await clearStaffSession().catch(() => undefined);
      throw auditError;
    }

    await Promise.all([
      resetRateLimit({
        scope: "auth-login-source",
        identifier: source,
        windowMs: LOGIN_WINDOW_MS,
      }),
      resetRateLimit({
        scope: "auth-login-pin",
        identifier: pin,
        windowMs: LOGIN_WINDOW_MS,
      }),
    ]).catch((error) =>
      console.warn("[auth/login] Rate-limit reset failed after login", error)
    );

    return NextResponse.json(
      {
        user: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
        },
      },
      {
        headers: {
          ...rateLimitHeaders(sourceLimit),
          "Cache-Control": "no-store",
        },
      }
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