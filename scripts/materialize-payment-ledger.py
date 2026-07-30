from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "prisma" / "schema.prisma"
SEED = ROOT / "prisma" / "seed.ts"

schema = SCHEMA.read_text(encoding="utf-8")

order_relation_old = """  items           OrderItem[]
  estimatedReady  DateTime?"""
order_relation_new = """  items           OrderItem[]
  paymentEvents   PaymentEvent[]
  estimatedReady  DateTime?"""

if "paymentEvents   PaymentEvent[]" not in schema:
    if order_relation_old not in schema:
        raise RuntimeError("Order relation insertion point was not found")
    schema = schema.replace(order_relation_old, order_relation_new, 1)

payment_model = """

// ─── Immutable payment event ledger ───
model PaymentEvent {
  id             String   @id @default(cuid())
  idempotencyKey String   @unique
  orderId        String
  order          Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  eventType      String
  method         String
  status         String   @default("succeeded")
  amountCents    Int
  tenderedCents  Int?
  changeCents    Int?
  currency       String   @default("USD")
  actorId        String?
  actorName      String   @default("")
  metadata       Json?
  createdAt      DateTime @default(now())

  @@index([orderId, createdAt])
  @@index([eventType, createdAt])
  @@index([createdAt])
}
"""

if "model PaymentEvent {" not in schema:
    schema = schema.rstrip() + payment_model + "\n"

SCHEMA.write_text(schema, encoding="utf-8")

seed = SEED.read_text(encoding="utf-8")
seed_old = """  const tables = [
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer","""
seed_new = """  const tables = [
    "PaymentEvent", "KdsOutboxEvent", "AuditEvent", "StaffSession", "RateLimitCounter",
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer","""

if '"PaymentEvent", "KdsOutboxEvent"' not in seed:
    if seed_old not in seed:
        raise RuntimeError("Seed cleanup insertion point was not found")
    seed = seed.replace(seed_old, seed_new, 1)

SEED.write_text(seed, encoding="utf-8")
print("Payment ledger schema and seed cleanup are materialized.")
