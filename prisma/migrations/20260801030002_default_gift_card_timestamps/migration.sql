-- Keep reviewed raw-SQL gift-card issuance aligned with Prisma's timestamp
-- contract. Existing rows are unchanged; future inserts receive database-side
-- timestamps even when a service intentionally bypasses Prisma model writes.

ALTER TABLE "GiftCard"
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
