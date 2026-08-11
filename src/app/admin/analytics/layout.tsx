import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { REPORTING_ROLES } from "@/lib/auth/roles";

export default async function AnalyticsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/analytics", REPORTING_ROLES);
  return children;
}
