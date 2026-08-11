import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { INVENTORY_MANAGEMENT_ROLES } from "@/lib/auth/roles";

export default async function InventoryLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage("/admin/inventory", INVENTORY_MANAGEMENT_ROLES);
  return children;
}
