import { NextRequest, NextResponse } from "next/server";

const STAFF_SESSION_COOKIE = "restaurant_staff_session";
const SESSION_VERSION = 1;

interface SessionTokenPayload {
  v: number;
  sub: string;
  iat: number;
  exp: number;
}

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  if (process.env.NODE_ENV === "production" && secret.length < 32) return null;
  return secret;
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodePayload(value: string): SessionTokenPayload | null {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(bytes)
    ) as Partial<SessionTokenPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.v !== SESSION_VERSION ||
      typeof payload.sub !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.sub.length === 0 ||
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

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, encodedSignature] = parts;
  if (!decodePayload(encodedPayload)) return false;

  const signature = decodeBase64Url(encodedSignature);
  const secret = getSessionSecret();
  if (!signature || !secret) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(encodedPayload)
    );
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (await hasValidSession(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export const config = {
  matcher: ["/admin/:path+", "/kds/:path+"],
};
