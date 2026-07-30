from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "prisma" / "schema.prisma"

AUDIT_MODEL = """

// ─── Append-only security and financial audit trail ───
model AuditEvent {
  id          String   @id @default(cuid())
  actorId     String?
  actorName   String   @default("")
  actorRole   String   @default("")
  action      String
  entityType  String
  entityId    String?
  requestId   String?
  sourceHash  String   @default("")
  userAgent   String   @default("")
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}
"""

schema = SCHEMA_PATH.read_text(encoding="utf-8")
if "model AuditEvent {" in schema:
    print("AuditEvent model is already present.")
else:
    SCHEMA_PATH.write_text(schema.rstrip() + AUDIT_MODEL + "\n", encoding="utf-8")
    print("Appended AuditEvent model to prisma/schema.prisma.")
