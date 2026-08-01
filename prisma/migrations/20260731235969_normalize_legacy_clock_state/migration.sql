-- Normalize inconsistent legacy clock-cache rows before the immutable
-- timekeeping migration imports them. A row that is not clocked in but has
-- only a clock-in timestamp is preserved as a zero-duration closed shift
-- instead of being imported as an impossible open/closed hybrid.

UPDATE "Employee"
SET "lastClockOut" = "lastClockIn"
WHERE NOT "clockedIn"
  AND "lastClockIn" IS NOT NULL
  AND "lastClockOut" IS NULL;
