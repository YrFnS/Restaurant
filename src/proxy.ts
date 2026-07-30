import { NextRequest, NextResponse } from "next/server";
import {
  evaluateBrowserMutation,
  parseAllowedOrigins,
} from "@/lib/security/request-policy";

const STAFF_SESSION_COOKIE = "restaurant_staff_session";
const SESSION_VERSION = 2;
const MAX_REQUEST_ID_LENGTH = 128;

interface SessionTokenPayload {
  v: number;
  sid: string;
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

function decodeBase64Url(value: string): ArrayBuffer | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
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

function getRequestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && supplied.length <= MAX_REQUEST_ID_LENGTH) return supplied;
  return crypto.randomUUID();
}

function nextResponse(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

function validateApiMutation(request: NextRequest, requestId: string) {
  const decision = evaluateBrowserMutation({
    method: request.method,
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    contentType: request.headers.get("content-type"),
    hasBody: request.body !== null,
    allowedOrigins: parseAllowedOrigins(process.env.APP_ALLOWED_ORIGINS),
  });

  if (decision.allowed) return null;

  return NextResponse.json(
    {
      error: decision.message,
      code: decision.code,
      requestId,
    },
    {
      status: decision.status,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
        Vary: "Origin, Sec-Fetch-Site",
      },
    }
  );
}

export async function proxy(request: NextRequest) {
  const requestId = getRequestId(request);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const rejection = validateApiMutation(request, requestId);
    if (rejection) return rejection;
    return nextResponse(request, requestId);
  }

  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (await hasValidSession(token)) {
    return nextResponse(request, requestId);
  }

  const loginUrl = new URL("/admin", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("x-request-id", requestId);
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
  matcher: ["/admin/:path+", "/kds/:path+", "/api/:path*"],
};