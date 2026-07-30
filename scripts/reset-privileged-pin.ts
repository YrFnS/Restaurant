import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createPinVerifier } from "../src/lib/auth/pin";
import { writeAuditEvent } from "../src/lib/audit";

const db = new PrismaClient();
const PRIVILEGED_ROLES = ["owner", "admin"] as const;
const PIN_PATTERN = /^\d{4,8}$/;

async function readHiddenPin(label: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;

  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("PIN recovery requires an interactive terminal");
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    };

    const finish = () => {
      cleanup();
      output.write("\n");
      resolve(value);
    };

    const cancel = () => {
      cleanup();
      output.write("\n");
      reject(new Error("PIN recovery cancelled"));
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\u0003" || character === "\u0004") {
          cancel();
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (/^\d$/.test(character) && value.length < 8) {
          value += character;
          output.write("•");
        }
      }
    };

    output.write(label);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function listEligibleAccounts() {
  const accounts = await db.employee.findMany({
    where: { role: { in: [...PRIVILEGED_ROLES] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      isActive: true,
    },
  });

  console.error("Eligible privileged accounts:");
  for (const account of accounts) {
    console.error(
      `  ${account.id} | ${account.role} | ${account.name} | ${
        account.email || "no email"
      } | ${account.isActive ? "active" : "inactive"}`
    );
  }
}

async function main() {
  const selector = process.argv[2]?.trim();
  if (!selector) {
    await listEligibleAccounts();
    throw new Error(
      "Usage: bun run auth:reset-privileged-pin -- <employee-id-or-exact-email>"
    );
  }

  const eligibleAccounts = await db.employee.findMany({
    where: { role: { in: [...PRIVILEGED_ROLES] } },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      isActive: true,
    },
  });
  const normalizedSelector = selector.toLowerCase();
  const matches = eligibleAccounts.filter(
    (account) =>
      account.id === selector || account.email?.toLowerCase() === normalizedSelector
  );

  if (matches.length === 0) {
    await listEligibleAccounts();
    throw new Error("No owner/admin account matched that ID or exact email");
  }
  if (matches.length > 1) {
    await listEligibleAccounts();
    throw new Error("The email is not unique; rerun with the exact employee ID");
  }

  const account = matches[0];
  if (!account.isActive) {
    throw new Error("The selected privileged account is inactive");
  }

  console.log(
    `Resetting the PIN for ${account.name} (${account.role}, ${account.id}).`
  );
  const firstPin = await readHiddenPin("New PIN (4-8 digits): ");
  const secondPin = await readHiddenPin("Confirm new PIN: ");

  if (!PIN_PATTERN.test(firstPin)) {
    throw new Error("PIN must contain 4-8 digits");
  }
  if (firstPin !== secondPin) {
    throw new Error("PIN confirmation did not match");
  }

  const pinVerifier = await createPinVerifier(firstPin);
  const now = new Date();
  const requestId = `local-recovery:${randomUUID()}`;

  const revokedSessions = await db.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: account.id },
      data: { pin: pinVerifier },
    });
    const revoked = await tx.staffSession.updateMany({
      where: {
        employeeId: account.id,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    await writeAuditEvent(tx, {
      actor: null,
      action: "auth.privileged_pin_recovery",
      entityType: "Employee",
      entityId: account.id,
      context: {
        requestId,
        sourceHash: "",
        userAgent: "local-cli",
      },
      metadata: {
        targetName: account.name,
        targetRole: account.role,
        sessionsRevoked: revoked.count,
        recoveryMethod: "interactive-local-cli",
      },
    });
    return revoked.count;
  });

  console.log(
    `PIN verifier replaced and ${revokedSessions} active session(s) revoked. Audit request: ${requestId}`
  );
}

main()
  .catch((error) => {
    console.error(`[auth:reset-privileged-pin] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
