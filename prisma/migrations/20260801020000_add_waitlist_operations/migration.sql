-- P1 waitlist operations: capacity-derived estimates, temporary table holds,
-- customer confirmation, expiry, lifecycle timestamps, and concurrency indexes.

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "waitlistAverageTurnoverMinutes" INTEGER NOT NULL DEFAULT 75,
  ADD COLUMN "waitlistNotificationExpiryMinutes" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "waitlistEstimatePaddingMinutes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "waitlistMaxQuoteMinutes" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "waitlistRequireConfirmation" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_waitlist_turnover_check"
    CHECK ("waitlistAverageTurnoverMinutes" BETWEEN 15 AND 480),
  ADD CONSTRAINT "RestaurantSettings_waitlist_expiry_check"
    CHECK ("waitlistNotificationExpiryMinutes" BETWEEN 1 AND 120),
  ADD CONSTRAINT "RestaurantSettings_waitlist_padding_check"
    CHECK ("waitlistEstimatePaddingMinutes" BETWEEN 0 AND 120),
  ADD CONSTRAINT "RestaurantSettings_waitlist_quote_check"
    CHECK ("waitlistMaxQuoteMinutes" BETWEEN 15 AND 1440);

ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "seatedAt" TYPE TIMESTAMPTZ(3)
    USING "seatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "notifiedAt" TYPE TIMESTAMPTZ(3)
    USING "notifiedAt" AT TIME ZONE 'UTC';

ALTER TABLE "WaitlistEntry"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "source" "ReservationSource" NOT NULL DEFAULT 'customer',
  ADD COLUMN "preference" TEXT,
  ADD COLUMN "tableId" TEXT,
  ADD COLUMN "estimatedSeatAt" TIMESTAMPTZ(3),
  ADD COLUMN "estimateCalculatedAt" TIMESTAMPTZ(3),
  ADD COLUMN "notificationExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "notificationConfirmedAt" TIMESTAMPTZ(3),
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "noShowAt" TIMESTAMPTZ(3);

-- The legacy model did not store table holds. A legacy `notified` row is
-- therefore returned to `waiting` and recalculated rather than inventing a
-- physical table assignment during migration.
UPDATE "WaitlistEntry" AS entry
SET
  "status" = CASE
    WHEN entry."status" = 'notified'
      THEN 'waiting'::"WaitlistStatus"
    ELSE entry."status"
  END,
  "source" = 'import'::"ReservationSource",
  "estimatedSeatAt" =
    entry."createdAt" AT TIME ZONE 'UTC' +
    make_interval(mins => GREATEST(entry."estimatedWait", 0)),
  "estimateCalculatedAt" = entry."updatedAt" AT TIME ZONE 'UTC',
  "seatedAt" = CASE
    WHEN entry."status" = 'seated'
      THEN COALESCE(entry."seatedAt", entry."updatedAt" AT TIME ZONE 'UTC')
    ELSE entry."seatedAt"
  END,
  "notifiedAt" = CASE
    WHEN entry."status" = 'notified' THEN NULL
    ELSE entry."notifiedAt"
  END,
  "notificationExpiresAt" = NULL,
  "notificationConfirmedAt" = NULL,
  "cancelledAt" = CASE
    WHEN entry."status" = 'cancelled'
      THEN entry."updatedAt" AT TIME ZONE 'UTC'
    ELSE NULL
  END,
  "noShowAt" = CASE
    WHEN entry."status" = 'no_show'
      THEN entry."updatedAt" AT TIME ZONE 'UTC'
    ELSE NULL
  END
FROM "RestaurantSettings" AS settings
WHERE settings."id" = '1';

ALTER TABLE "WaitlistEntry"
  ADD CONSTRAINT "WaitlistEntry_tableId_fkey"
    FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WaitlistEntry_estimate_bounds"
    CHECK ("estimatedWait" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "WaitlistEntry_notification_range"
    CHECK (
      "notificationExpiresAt" IS NULL
      OR (
        "notifiedAt" IS NOT NULL
        AND "notificationExpiresAt" > "notifiedAt"
      )
    ),
  ADD CONSTRAINT "WaitlistEntry_confirmation_range"
    CHECK (
      "notificationConfirmedAt" IS NULL
      OR (
        "notifiedAt" IS NOT NULL
        AND "notificationConfirmedAt" >= "notifiedAt"
        AND (
          "notificationExpiresAt" IS NULL
          OR "notificationConfirmedAt" <= "notificationExpiresAt"
        )
      )
    ),
  ADD CONSTRAINT "WaitlistEntry_lifecycle_shape"
    CHECK (
      (
        "status" <> 'waiting'
        OR (
          "tableId" IS NULL
          AND "notifiedAt" IS NULL
          AND "notificationExpiresAt" IS NULL
          AND "notificationConfirmedAt" IS NULL
        )
      )
      AND (
        "status" <> 'notified'
        OR (
          "tableId" IS NOT NULL
          AND "notifiedAt" IS NOT NULL
          AND "notificationExpiresAt" IS NOT NULL
        )
      )
      AND (
        "status" <> 'seated'
        OR (
          "seatedAt" IS NOT NULL
          AND ("tableId" IS NOT NULL OR "source" = 'import')
        )
      )
      AND ("status" <> 'cancelled' OR "cancelledAt" IS NOT NULL)
      AND ("status" <> 'no_show' OR "noShowAt" IS NOT NULL)
      AND (
        "status" NOT IN ('waiting', 'notified')
        OR (
          "estimatedSeatAt" IS NOT NULL
          AND "estimateCalculatedAt" IS NOT NULL
        )
      )
    );

CREATE UNIQUE INDEX "WaitlistEntry_idempotencyKey_key"
  ON "WaitlistEntry" ("idempotencyKey");

CREATE UNIQUE INDEX "WaitlistEntry_one_active_table_hold_idx"
  ON "WaitlistEntry" ("tableId")
  WHERE "tableId" IS NOT NULL AND "status" = 'notified';

CREATE INDEX "WaitlistEntry_status_estimatedSeatAt_idx"
  ON "WaitlistEntry" ("status", "estimatedSeatAt", "createdAt");

CREATE INDEX "WaitlistEntry_table_status_idx"
  ON "WaitlistEntry" ("tableId", "status", "notificationExpiresAt");

CREATE INDEX "WaitlistEntry_notification_expiry_idx"
  ON "WaitlistEntry" ("notificationExpiresAt")
  WHERE "status" = 'notified';

CREATE INDEX "WaitlistEntry_customer_createdAt_idx"
  ON "WaitlistEntry" ("customerId", "createdAt" DESC);
