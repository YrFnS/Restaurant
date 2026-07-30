import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const STAFF_SESSION_COOKIE = "restaurant_staff_session";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_VERSION = 1;

interface SessionTokenPayload {
  v: number;
  sub: string;
  iat: number;
  exp: number;
}

export interface StaffSession {
  id: string;
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
  if (Number.isFinite(configured) && configured >= 300 && configured <= 7 * 24 * 60 * 60) {
    return Math.floor(configured);
  }
  return DEFAULT_SESSION_TTL_SECONDS;
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
    throw new AuthConfigurationError("Staff authentication secret must be at least 32 characters");
  }

  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function createSessionToken(employeeId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    v: SESSION_VERSION,
    sub: employeeId,
    iat: issuedAt,
    exp: issuedAt + getSessionTtlSeconds(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  const expectedSignature = sign(encodedPayload);
  if (!signaturesMatch(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionTokenPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.v !== SESSION_VERSION ||
      typeof payload.sub !== "string" ||
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

export async function setStaffSession(employeeId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, createSessionToken(employeeId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const employee = await db.employee.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!employee?.isActive) return null;

  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
  };
}
