import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const STAFF_SESSION_COOKIE = "restaurant_staff_session";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEFAULT_SESSION_IDLE_SECONDS = 30 * 60;
const SESSION_TOUCH_INTERVAL_SECONDS = 60;
const SESSION_RETENTION_SECONDS = 30 * 24 * 60 * 60;
const SESSION_VERSION = 2;

interface SessionTokenPayload {
  v: number;
  sid: string;
  sub: string;
  iat: number;
  exp: number;
}

export interface StaffSession {
  id: string;
  sessionId: string;
  name: string;
  role: string;
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function getSessionTtlSeconds(): number {
  const configured = Number(process.env.AUTH_SESSION_TTL_SECONDS);
  if (
    Number.isFinite(configured) &&
    configured >= 300 &&
    configured <= 7 * 24 * 60 * 60
  ) {
    return Math.floor(configured);
  }
  return DEFAULT_SESSION_TTL_SECONDS;
}

function getSessionIdleSeconds(): number {
  const ttl = getSessionTtlSeconds();
  const configured = Number(process.env.AUTH_SESSION_IDLE_SECONDS);
  if (Number.isFinite(configured) && configured >= 60 && configured <= ttl) {
    return Math.floor(configured);
  }
  return Math.min(DEFAULT_SESSION_IDLE_SECONDS, ttl);
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new AuthConfigurationError("Staff authentication secret is not configured");
    }
    return "restaurant-development-secret-change-before-production";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new AuthConfigurationError(
      "Staff authentication secret must be at least 32 characters"
    );
  }

  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function constantTimeMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionToken(
  employeeId: string,
  sessionId: string,
  issuedAt: number,
  expiresAt: number
): string {
  const payload: SessionTokenPayload = {
    v: SESSION_VERSION,
    sid: sessionId,
    sub: employeeId,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = sign(encodedPayload);
  if (!constantTimeMatch(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionTokenPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.v !== SESSION_VERSION ||
      typeof payload.sid !== "string" ||
      payload.sid.length < 16 ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp <= now ||
      payload.iat > now + 60
    ) {
      return null;
    }

    return payload as SessionTokenPayload;
  } catch {
    return null;
  }
}

async function revokeToken(token: string, revokedAt = new Date()): Promise<void> {
  const payload = verifySessionToken(token);
  if (!payload) return;

  await db.staffSession.updateMany({
    where: {
      id: payload.sid,
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: { revokedAt },
  });
}

export async function setStaffSession(
  employeeId: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const cookieStore = await cookies();
  const priorToken = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + getSessionTtlSeconds();
  const issuedAt = new Date(issuedAtSeconds * 1_000);
  const expiresAt = new Date(expiresAtSeconds * 1_000);
  const sessionId = randomBytes(24).toString("base64url");
  const token = createSessionToken(
    employeeId,
    sessionId,
    issuedAtSeconds,
    expiresAtSeconds
  );
  const tokenHash = hashSessionToken(token);
  const retentionCutoff = new Date(
    issuedAt.getTime() - SESSION_RETENTION_SECONDS * 1_000
  );

  await db.$transaction(async (tx) => {
    if (priorToken) {
      const priorPayload = verifySessionToken(priorToken);
      if (priorPayload) {
        await tx.staffSession.updateMany({
          where: {
            id: priorPayload.sid,
            tokenHash: hashSessionToken(priorToken),
            revokedAt: null,
          },
          data: { revokedAt: issuedAt },
        });
      }
    }

    await tx.staffSession.create({
      data: {
        id: sessionId,
        employeeId,
        tokenHash,
        expiresAt,
        lastSeenAt: issuedAt,
      },
    });

    await tx.staffSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: retentionCutoff } },
          { revokedAt: { lt: retentionCutoff } },
        ],
      },
    });
  });

  cookieStore.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return { sessionId, expiresAt };
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  let revokeError: unknown;

  try {
    if (token) await revokeToken(token);
  } catch (error) {
    revokeError = error;
  } finally {
    cookieStore.set(STAFF_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  if (revokeError) throw revokeError;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const stored = await db.staffSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      employeeId: true,
      tokenHash: true,
      expiresAt: true,
      lastSeenAt: true,
      revokedAt: true,
    },
  });
  if (
    !stored ||
    stored.employeeId !== payload.sub ||
    !constantTimeMatch(stored.tokenHash, hashSessionToken(token))
  ) {
    return null;
  }

  const now = new Date();
  const idleDeadline = new Date(
    stored.lastSeenAt.getTime() + getSessionIdleSeconds() * 1_000
  );
  if (stored.revokedAt || stored.expiresAt <= now || idleDeadline <= now) {
    if (!stored.revokedAt) {
      await db.staffSession.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    return null;
  }

  const employee = await db.employee.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!employee?.isActive) {
    await db.staffSession.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });
    return null;
  }

  const touchCutoff = new Date(
    now.getTime() - SESSION_TOUCH_INTERVAL_SECONDS * 1_000
  );
  if (stored.lastSeenAt <= touchCutoff) {
    await db.staffSession.updateMany({
      where: {
        id: stored.id,
        revokedAt: null,
        lastSeenAt: { lte: touchCutoff },
      },
      data: { lastSeenAt: now },
    });
  }

  return {
    id: employee.id,
    sessionId: stored.id,
    name: employee.name,
    role: employee.role,
  };
}