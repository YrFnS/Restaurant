from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "prisma" / "schema.prisma"

MODEL = """

// ─── Durable KDS transactional outbox ───
model KdsOutboxEvent {
  id            String    @id @default(cuid())
  eventType     String
  screenSlugs   Json
  payload       Json?
  attempts      Int       @default(0)
  nextAttemptAt DateTime  @default(now())
  lockedAt      DateTime?
  lockToken     String?
  deliveredAt   DateTime?
  lastError     String    @default("")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([deliveredAt, nextAttemptAt])
  @@index([lockedAt])
  @@index([createdAt])
}
"""

schema = SCHEMA_PATH.read_text(encoding="utf-8")
if "model KdsOutboxEvent {" in schema:
    print("KdsOutboxEvent model is already present.")
else:
    SCHEMA_PATH.write_text(schema.rstrip() + MODEL + "\n", encoding="utf-8")
    print("Appended KdsOutboxEvent model to prisma/schema.prisma.")
