import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { SETTINGS_MANAGEMENT_ROLES } from "@/lib/auth/roles";

export default async function ReservationSettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage(
    "/admin/reservation-settings",
    SETTINGS_MANAGEMENT_ROLES
  );
  return children;
}
