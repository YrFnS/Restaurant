-- Waitlist lifecycle writes use reviewed raw SQL so queue locking, estimates,
-- audit events, and table holds commit in one transaction. Preserve Prisma's
-- create-time behavior at the database boundary for those inserts.
ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
