import { describe, expect, test } from "bun:test";
import {
  CASH_MANAGEMENT_ROLES,
  INVENTORY_MANAGEMENT_ROLES,
  KITCHEN_OPERATION_ROLES,
  MENU_MANAGEMENT_ROLES,
  ORDER_MANAGEMENT_ROLES,
  REPORTING_ROLES,
  RESERVATION_MANAGEMENT_ROLES,
  SETTINGS_MANAGEMENT_ROLES,
  STAFF_ADMIN_ROLES,
  TABLE_OPERATION_ROLES,
  roleIsAllowed,
} from "../../src/lib/auth/roles";

const privilegedGroups = [
  STAFF_ADMIN_ROLES,
  MENU_MANAGEMENT_ROLES,
  SETTINGS_MANAGEMENT_ROLES,
  CASH_MANAGEMENT_ROLES,
  INVENTORY_MANAGEMENT_ROLES,
  REPORTING_ROLES,
  ORDER_MANAGEMENT_ROLES,
  KITCHEN_OPERATION_ROLES,
  RESERVATION_MANAGEMENT_ROLES,
  TABLE_OPERATION_ROLES,
] as const;

describe("staff role policy", () => {
  test("owner retains every privileged capability", () => {
    privilegedGroups.forEach((roles) => {
      expect(roleIsAllowed("owner", roles)).toBe(true);
    });
  });

  test("kitchen roles receive redacted kitchen access, not full order access", () => {
    expect(roleIsAllowed("cook", KITCHEN_OPERATION_ROLES)).toBe(true);
    expect(roleIsAllowed("bartender", KITCHEN_OPERATION_ROLES)).toBe(true);
    expect(roleIsAllowed("cook", ORDER_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("bartender", ORDER_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("cook", CASH_MANAGEMENT_ROLES)).toBe(false);
  });

  test("analysts can read reporting aggregates without operational records", () => {
    expect(roleIsAllowed("analyst", REPORTING_ROLES)).toBe(true);
    expect(roleIsAllowed("analyst", ORDER_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("analyst", SETTINGS_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("analyst", STAFF_ADMIN_ROLES)).toBe(false);
  });

  test("inventory managers cannot cross into cash or employee administration", () => {
    expect(roleIsAllowed("inventory_manager", INVENTORY_MANAGEMENT_ROLES)).toBe(true);
    expect(roleIsAllowed("inventory_manager", CASH_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("inventory_manager", STAFF_ADMIN_ROLES)).toBe(false);
  });

  test("hosts and servers receive only their operational surfaces", () => {
    expect(roleIsAllowed("host", RESERVATION_MANAGEMENT_ROLES)).toBe(true);
    expect(roleIsAllowed("host", TABLE_OPERATION_ROLES)).toBe(true);
    expect(roleIsAllowed("host", CASH_MANAGEMENT_ROLES)).toBe(false);

    expect(roleIsAllowed("server", ORDER_MANAGEMENT_ROLES)).toBe(true);
    expect(roleIsAllowed("server", TABLE_OPERATION_ROLES)).toBe(true);
    expect(roleIsAllowed("server", MENU_MANAGEMENT_ROLES)).toBe(false);
    expect(roleIsAllowed("server", STAFF_ADMIN_ROLES)).toBe(false);
  });
});
