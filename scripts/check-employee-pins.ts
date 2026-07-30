import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { isSecurePinVerifier } from "../src/lib/auth/pin";

const db = new PrismaClient();

async function main() {
  const employees = await db.employee.findMany({
    select: { id: true, name: true, pin: true },
  });
  const insecure = employees.filter(
    (employee) => !isSecurePinVerifier(employee.pin)
  );

  if (insecure.length > 0) {
    const affected = insecure
      .map((employee) => `${employee.id} (${employee.name})`)
      .join(", ");
    throw new Error(
      `Plaintext or invalid employee PIN verifier detected for: ${affected}. Run bun run auth:migrate-pins before enabling production traffic.`
    );
  }

  console.log(`Verified ${employees.length} secure employee PIN verifier(s).`);
}

main()
  .catch((error) => {
    console.error("Employee PIN security check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
