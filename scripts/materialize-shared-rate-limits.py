from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "prisma" / "schema.prisma"

MODEL = """

// ─── Shared, privacy-safe fixed-window rate-limit counters ───
model RateLimitCounter {
  key       String   @id
  scope     String
  count     Int      @default(1)
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([scope, expiresAt])
  @@index([expiresAt])
}
"""

schema = SCHEMA_PATH.read_text(encoding="utf-8")
if "model RateLimitCounter {" in schema:
    print("RateLimitCounter model is already present.")
else:
    SCHEMA_PATH.write_text(schema.rstrip() + MODEL + "\n", encoding="utf-8")
    print("Appended RateLimitCounter model to prisma/schema.prisma.")
