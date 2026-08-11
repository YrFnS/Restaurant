import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { STAFF_ADMIN_ROLES } from "@/lib/auth/roles";

export default async function FeedbackLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/feedback", STAFF_ADMIN_ROLES);
  return children;
}
