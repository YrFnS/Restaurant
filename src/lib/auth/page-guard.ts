import "server-only";

import { redirect } from "next/navigation";
import { roleIsAllowed } from "@/lib/auth/roles";
import { getStaffSession } from "@/lib/auth/session";

export async function requireStaffPage(
  path: string,
  allowedRoles: readonly string[]
) {
  const session = await getStaffSession();

  if (!session) {
    redirect(`/admin?next=${encodeURIComponent(path)}`);
  }

  if (!roleIsAllowed(session.role, allowedRoles)) {
    redirect(`/admin?error=access_denied&from=${encodeURIComponent(path)}`);
  }

  return session;
}
