import "server-only";

import { NextResponse } from "next/server";
import {
  AuthConfigurationError,
  getStaffSession,
  type StaffSession,
} from "@/lib/auth/session";

export {
  CASH_MANAGEMENT_ROLES,
  INVENTORY_MANAGEMENT_ROLES,
  KITCHEN_OPERATION_ROLES,
  MENU_MANAGEMENT_ROLES,
  ORDER_MANAGEMENT_ROLES,
  REPORTING_ROLES,
  RESERVATION_MANAGEMENT_ROLES,
  SETTINGS_MANAGEMENT_ROLES,
  STAFF_ADMIN_ROLES,
  STAFF_ROLES,
  TABLE_OPERATION_ROLES,
  roleIsAllowed,
  type StaffRole,
} from "@/lib/auth/roles";

export type StaffGuardResult =
  | { session: StaffSession; response?: never }
  | { session?: never; response: NextResponse };

export async function requireStaffSession(
  allowedRoles?: readonly string[]
): Promise<StaffGuardResult> {
  try {
    const session = await getStaffSession();

    if (!session) {
      return {
        response: NextResponse.json(
          { error: "Authentication required", code: "AUTH_REQUIRED" },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }

    if (allowedRoles && !allowedRoles.includes(session.role)) {
      return {
        response: NextResponse.json(
          { error: "Permission denied", code: "PERMISSION_DENIED" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }

    return { session };
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return {
        response: NextResponse.json(
          { error: "Authentication is not configured", code: "AUTH_NOT_CONFIGURED" },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        ),
      };
    }

    console.error("[auth] Failed to validate staff session", error);
    return {
      response: NextResponse.json(
        { error: "Unable to validate session", code: "AUTH_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
}
