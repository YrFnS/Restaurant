import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { STAFF_ADMIN_ROLES } from "@/lib/auth/roles";

export default async function TimesheetLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/timesheet", STAFF_ADMIN_ROLES);
  return children;
}
