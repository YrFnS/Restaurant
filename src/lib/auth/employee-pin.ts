import "server-only";

import { db } from "@/lib/db";
import { createPinVerifier } from "@/lib/auth/pin";

const authenticatedEmployeeSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
  clockedIn: true,
  lastClockIn: true,
  lastClockOut: true,
} as const;

/**
 * Authenticate a staff PIN without storing or returning the raw PIN.
 *
 * The existing database column remains named `pin` for a zero-downtime rollout,
 * but secure rows contain a memory-hard verifier rather than plaintext. The
 * second lookup is a temporary bridge for databases that have not run the PIN
 * migration yet. A successful legacy login immediately upgrades that row.
 */
export async function authenticateEmployeePin(pin: string) {
  const pinVerifier = await createPinVerifier(pin);

  const secureEmployee = await db.employee.findUnique({
    where: { pin: pinVerifier },
    select: authenticatedEmployeeSelect,
  });

  if (secureEmployee) {
    return secureEmployee.isActive ? secureEmployee : null;
  }

  const legacyEmployee = await db.employee.findUnique({
    where: { pin },
    select: authenticatedEmployeeSelect,
  });

  if (!legacyEmployee?.isActive) return null;

  return db.employee.update({
    where: { id: legacyEmployee.id },
    data: { pin: pinVerifier },
    select: authenticatedEmployeeSelect,
  });
}

export async function replaceEmployeePin(employeeId: string, pin: string) {
  const pinVerifier = await createPinVerifier(pin);
  return db.employee.update({
    where: { id: employeeId },
    data: { pin: pinVerifier },
    select: authenticatedEmployeeSelect,
  });
}
