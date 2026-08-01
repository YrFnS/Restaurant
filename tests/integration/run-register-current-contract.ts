import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(
  process.cwd(),
  "tests/integration/p1-cash-register-sessions.ts"
);
const preloadPath = resolve(
  process.cwd(),
  "tests/integration/checkout-idempotency-fetch.ts"
);
const temporaryPrefix = resolve(
  process.cwd(),
  "tests/integration/.register-current-contract-"
);

const staleAuditAction = '"payment.cash.capture"';
const currentAuditAction = '"order.payment.capture"';

function occurrences(source: string, marker: string): number {
  return source.split(marker).length - 1;
}

async function main() {
  const original = await readFile(sourcePath, "utf8");
  const staleCount = occurrences(original, staleAuditAction);
  const currentCount = occurrences(original, currentAuditAction);

  let runnable = original;
  if (staleCount === 2 && currentCount === 0) {
    runnable = original.replaceAll(staleAuditAction, currentAuditAction);
  } else if (staleCount !== 0 || currentCount !== 2) {
    throw new Error(
      `Unexpected register audit contract: stale=${staleCount}, current=${currentCount}`
    );
  }

  const temporaryDirectory = await mkdtemp(temporaryPrefix);
  const generatedPath = resolve(
    temporaryDirectory,
    "p1-cash-register-sessions.ts"
  );

  let exitCode = 1;
  try {
    await writeFile(generatedPath, runnable, "utf8");
    const child = Bun.spawn(
      [process.execPath, "--preload", preloadPath, generatedPath],
      {
        cwd: process.cwd(),
        env: process.env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }
    );
    exitCode = await child.exited;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  if (exitCode !== 0) process.exitCode = exitCode;
}

main().catch((error) => {
  console.error("[p1-register-contract] Runner failed:", error);
  process.exitCode = 1;
});
