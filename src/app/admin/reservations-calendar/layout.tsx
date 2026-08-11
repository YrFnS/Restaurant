import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { RESERVATION_MANAGEMENT_ROLES } from "@/lib/auth/roles";

export default async function ReservationsCalendarLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireStaffPage(
    "/admin/reservations-calendar",
    RESERVATION_MANAGEMENT_ROLES
  );
  return children;
}
