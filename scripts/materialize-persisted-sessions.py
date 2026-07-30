from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "prisma" / "schema.prisma"

STAFF_SESSION_MODEL = """

// ─── Persisted, revocable staff sessions ───
model StaffSession {
  id         String    @id
  employeeId String
  tokenHash  String    @unique
  expiresAt  DateTime
  lastSeenAt DateTime  @default(now())
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([employeeId, revokedAt, expiresAt])
  @@index([expiresAt])
  @@index([revokedAt])
}
"""

schema = SCHEMA_PATH.read_text(encoding="utf-8")
changed = False

if "model AuditEvent {" not in schema:
    raise RuntimeError("AuditEvent model is missing from prisma/schema.prisma")

audit_start = schema.index("model AuditEvent {")
audit_end = schema.index("\n}", audit_start) + 2
audit_block = schema[audit_start:audit_end]

if "  sessionId" not in audit_block:
    marker = '  actorRole   String   @default("")\n'
    if marker not in audit_block:
        raise RuntimeError("Unable to locate AuditEvent actorRole field")
    audit_block = audit_block.replace(
        marker,
        marker + "  sessionId   String?\n",
        1,
    )
    changed = True

if "@@index([sessionId, createdAt])" not in audit_block:
    marker = "  @@index([actorId, createdAt])\n"
    if marker not in audit_block:
        raise RuntimeError("Unable to locate AuditEvent actor index")
    audit_block = audit_block.replace(
        marker,
        marker + "  @@index([sessionId, createdAt])\n",
        1,
    )
    changed = True

schema = schema[:audit_start] + audit_block + schema[audit_end:]

if "model StaffSession {" not in schema:
    schema = schema.rstrip() + STAFF_SESSION_MODEL + "\n"
    changed = True

if changed:
    SCHEMA_PATH.write_text(schema, encoding="utf-8")
    print("Materialized persisted staff-session schema.")
else:
    print("Persisted staff-session schema is already current.")
