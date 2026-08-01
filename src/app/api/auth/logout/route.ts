import { NextRequest, NextResponse } from "next/server";
import {
  clearStaffSession,
  getStaffSession,
  type StaffSession,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  let session: StaffSession | null = null;

  try {
    session = await getStaffSession();
  } catch (error) {
    console.error("[auth/logout] Session lookup failed", error);
  }

  try {
    await clearStaffSession();
  } catch (error) {
    console.error("[auth/logout] Session revocation failed", error);
    return NextResponse.json(
      { error: "Unable to revoke session", code: "LOGOUT_FAILED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (session) {
    try {
      await writeAuditEvent(db, {
        actor: session,
        action: "auth.logout",
        entityType: "StaffSession",
        entityId: session.sessionId,
        context: auditContextFromRequest(req),
      });
    } catch (error) {
      console.error("[auth/logout] Logout audit failed", error);
    }
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}