import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { LOYALTY_READ_ROLES } from "@/lib/auth/roles";

export default async function LoyaltyLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/loyalty", LOYALTY_READ_ROLES);
  return children;
}
