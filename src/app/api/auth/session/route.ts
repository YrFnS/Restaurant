import { NextResponse } from "next/server";
import {
  AuthConfigurationError,
  getStaffSession,
} from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getStaffSession();

    if (!session) {
      return NextResponse.json(
        { user: null },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: session.id,
          name: session.name,
          role: session.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured", code: "AUTH_NOT_CONFIGURED" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("[auth/session] Session lookup failed", error);
    return NextResponse.json(
      { error: "Unable to load session", code: "AUTH_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}