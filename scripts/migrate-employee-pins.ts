import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import {
  createPinVerifier,
  isSecurePinVerifier,
  isValidPin,
} from "../src/lib/auth/pin";

const db = new PrismaClient();

async function main() {
  const employees = await db.employee.findMany({
    select: { id: true, name: true, pin: true },
    orderBy: { createdAt: "asc" },
  });

  const legacyEmployees = employees.filter(
    (employee) => !isSecurePinVerifier(employee.pin)
  );

  if (legacyEmployees.length === 0) {
    console.log("All employee PINs already use secure verifiers.");
    return;
  }

  console.log(`Migrating ${legacyEmployees.length} employee PIN verifier(s)...`);

  for (const employee of legacyEmployees) {
    if (!isValidPin(employee.pin)) {
      throw new Error(
        `Employee ${employee.id} (${employee.name}) has an invalid legacy PIN and must be reset manually.`
      );
    }

    const pinVerifier = await createPinVerifier(employee.pin);
    await db.employee.update({
      where: { id: employee.id },
      data: { pin: pinVerifier },
      select: { id: true },
    });

    console.log(`  migrated ${employee.id} (${employee.name})`);
  }

  const remaining = await db.employee.findMany({
    select: { id: true, pin: true },
  });
  const insecure = remaining.filter(
    (employee) => !isSecurePinVerifier(employee.pin)
  );

  if (insecure.length > 0) {
    throw new Error(
      `PIN migration incomplete: ${insecure.length} employee record(s) remain insecure.`
    );
  }

  console.log("Employee PIN migration completed successfully.");
}

main()
  .catch((error) => {
    console.error("Employee PIN migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
