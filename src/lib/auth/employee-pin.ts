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
 * The second lookup is a temporary zero-downtime bridge for databases whose
 * legacy `pin` column still contains plaintext. A successful legacy login
 * immediately replaces that value with the memory-hard verifier. The explicit
 * migration script should still be run during deployment so inactive and
 * rarely used accounts are migrated before production traffic is enabled.
 */
export async function authenticateEmployeePin(pin: string) {
  const pinVerifier = await createPinVerifier(pin);

  const secureEmployee = await db.employee.findUnique({
    where: { pinVerifier },
    select: authenticatedEmployeeSelect,
  });

  if (secureEmployee) {
    return secureEmployee.isActive ? secureEmployee : null;
  }

  const legacyEmployee = await db.employee.findUnique({
    where: { pinVerifier: pin },
    select: authenticatedEmployeeSelect,
  });

  if (!legacyEmployee?.isActive) return null;

  return db.employee.update({
    where: { id: legacyEmployee.id },
    data: { pinVerifier },
    select: authenticatedEmployeeSelect,
  });
}

export async function replaceEmployeePin(employeeId: string, pin: string) {
  const pinVerifier = await createPinVerifier(pin);
  return db.employee.update({
    where: { id: employeeId },
    data: { pinVerifier },
    select: authenticatedEmployeeSelect,
  });
}
