export const STAFF_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "server",
  "cook",
  "bartender",
  "host",
  "inventory_manager",
  "analyst",
  "staff",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ADMIN_ROLES = ["owner", "admin", "manager"] as const;
export const MENU_MANAGEMENT_ROLES = ["owner", "admin", "manager"] as const;
export const SETTINGS_MANAGEMENT_ROLES = ["owner", "admin", "manager"] as const;
export const CASH_MANAGEMENT_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
] as const;
export const INVENTORY_MANAGEMENT_ROLES = [
  "owner",
  "admin",
  "manager",
  "inventory_manager",
] as const;
export const REPORTING_ROLES = [
  "owner",
  "admin",
  "manager",
  "analyst",
] as const;
export const ORDER_MANAGEMENT_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "server",
] as const;
export const KITCHEN_OPERATION_ROLES = [
  "owner",
  "admin",
  "manager",
  "server",
  "cook",
  "bartender",
] as const;
export const RESERVATION_MANAGEMENT_ROLES = [
  "owner",
  "admin",
  "manager",
  "host",
] as const;
export const TABLE_OPERATION_ROLES = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "server",
  "host",
] as const;

export function roleIsAllowed(
  role: string,
  allowedRoles: readonly string[]
): boolean {
  return allowedRoles.includes(role);
}
