import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { MENU_MANAGEMENT_ROLES } from "@/lib/auth/roles";

export default async function FeaturedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/featured", MENU_MANAGEMENT_ROLES);
  return children;
}
