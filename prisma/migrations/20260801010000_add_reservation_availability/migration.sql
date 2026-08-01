-- P1 reservation availability: restaurant-local policy, weekly service,
-- closures, immutable occupancy snapshots, and database double-booking protection.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "ReservationSource" AS ENUM ('customer', 'staff', 'import');

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "reservationMinNoticeMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "reservationMaxAdvanceDays" INTEGER NOT NULL DEFAULT 365,
  ADD COLUMN "reservationDefaultDurationMinutes" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN "reservationTurnoverMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "reservationSlotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "reservationMinPartySize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reservationMaxPartySize" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "reservationCustomerCancelCutoffMinutes" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_reservation_notice_check"
    CHECK ("reservationMinNoticeMinutes" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "RestaurantSettings_reservation_horizon_check"
    CHECK ("reservationMaxAdvanceDays" BETWEEN 1 AND 730),
  ADD CONSTRAINT "RestaurantSettings_reservation_duration_check"
    CHECK ("reservationDefaultDurationMinutes" BETWEEN 15 AND 1440),
  ADD CONSTRAINT "RestaurantSettings_reservation_turnover_check"
    CHECK ("reservationTurnoverMinutes" BETWEEN 0 AND 480),
  ADD CONSTRAINT "RestaurantSettings_reservation_interval_check"
    CHECK ("reservationSlotIntervalMinutes" BETWEEN 5 AND 240),
  ADD CONSTRAINT "RestaurantSettings_reservation_party_check"
    CHECK (
      "reservationMinPartySize" BETWEEN 1 AND 100
      AND "reservationMaxPartySize" BETWEEN "reservationMinPartySize" AND 100
    ),
  ADD CONSTRAINT "RestaurantSettings_reservation_cancel_cutoff_check"
    CHECK ("reservationCustomerCancelCutoffMinutes" BETWEEN 0 AND 10080);

CREATE TABLE "ReservationServicePeriod" (
  "id" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "opensAtMinute" INTEGER NOT NULL,
  "closesAtMinute" INTEGER NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReservationServicePeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationServicePeriod_day_check"
    CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  CONSTRAINT "ReservationServicePeriod_open_check"
    CHECK ("opensAtMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "ReservationServicePeriod_close_check"
    CHECK ("closesAtMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "ReservationServicePeriod_not_zero_length_check"
    CHECK ("opensAtMinute" <> "closesAtMinute")
);

CREATE UNIQUE INDEX "ReservationServicePeriod_unique_window_idx"
  ON "ReservationServicePeriod" ("dayOfWeek", "opensAtMinute", "closesAtMinute");
CREATE INDEX "ReservationServicePeriod_active_day_idx"
  ON "ReservationServicePeriod" ("dayOfWeek", "isActive", "opensAtMinute");

CREATE TABLE "ReservationClosure" (
  "id" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdByName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReservationClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationClosure_range_check" CHECK ("endsAt" > "startsAt")
);

CREATE INDEX "ReservationClosure_range_idx"
  ON "ReservationClosure" ("startsAt", "endsAt");

ALTER TABLE "Reservation"
  ALTER COLUMN "dateTime" TYPE TIMESTAMPTZ(3)
  USING "dateTime" AT TIME ZONE 'UTC';

ALTER TABLE "Reservation"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "turnoverMinutes" INTEGER,
  ADD COLUMN "endsAt" TIMESTAMPTZ(3),
  ADD COLUMN "releaseAt" TIMESTAMPTZ(3),
  ADD COLUMN "source" "ReservationSource" NOT NULL DEFAULT 'customer',
  ADD COLUMN "seatedAt" TIMESTAMPTZ(3),
  ADD COLUMN "completedAt" TIMESTAMPTZ(3),
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
  ADD COLUMN "noShowAt" TIMESTAMPTZ(3);

UPDATE "Reservation" AS reservation
SET
  "durationMinutes" = settings."reservationDefaultDurationMinutes",
  "turnoverMinutes" = settings."reservationTurnoverMinutes",
  "endsAt" = reservation."dateTime" +
    make_interval(mins => settings."reservationDefaultDurationMinutes"),
  "releaseAt" = reservation."dateTime" +
    make_interval(
      mins => settings."reservationDefaultDurationMinutes" +
        settings."reservationTurnoverMinutes"
    ),
  "source" = 'import'::"ReservationSource",
  "seatedAt" = CASE
    WHEN reservation."status" = 'seated' THEN reservation."dateTime"
    ELSE NULL
  END,
  "completedAt" = CASE
    WHEN reservation."status" = 'completed' THEN reservation."updatedAt" AT TIME ZONE 'UTC'
    ELSE NULL
  END,
  "cancelledAt" = CASE
    WHEN reservation."status" = 'cancelled' THEN reservation."updatedAt" AT TIME ZONE 'UTC'
    ELSE NULL
  END,
  "noShowAt" = CASE
    WHEN reservation."status" = 'no_show' THEN reservation."updatedAt" AT TIME ZONE 'UTC'
    ELSE NULL
  END
FROM "RestaurantSettings" AS settings
WHERE settings."id" = '1';

ALTER TABLE "Reservation"
  ALTER COLUMN "durationMinutes" SET NOT NULL,
  ALTER COLUMN "durationMinutes" SET DEFAULT 90,
  ALTER COLUMN "turnoverMinutes" SET NOT NULL,
  ALTER COLUMN "turnoverMinutes" SET DEFAULT 15,
  ALTER COLUMN "endsAt" SET NOT NULL,
  ALTER COLUMN "releaseAt" SET NOT NULL;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_duration_check"
    CHECK ("durationMinutes" BETWEEN 15 AND 1440),
  ADD CONSTRAINT "Reservation_turnover_check"
    CHECK ("turnoverMinutes" BETWEEN 0 AND 480),
  ADD CONSTRAINT "Reservation_time_range_check"
    CHECK (
      "endsAt" > "dateTime"
      AND "releaseAt" >= "endsAt"
    );

CREATE UNIQUE INDEX "Reservation_idempotencyKey_key"
  ON "Reservation" ("idempotencyKey");
CREATE INDEX "Reservation_status_start_idx"
  ON "Reservation" ("status", "dateTime");
CREATE INDEX "Reservation_table_range_idx"
  ON "Reservation" ("tableId", "dateTime", "releaseAt");
CREATE INDEX "Reservation_phone_start_idx"
  ON "Reservation" ("customerPhone", "dateTime");

-- Preserve the legacy all-days display schedule as the initial reservation
-- service schedule. The seed later recreates the same periods from its settings.
INSERT INTO "ReservationServicePeriod" (
  "id", "dayOfWeek", "opensAtMinute", "closesAtMinute", "label", "isActive"
)
SELECT
  'reservation_service_' || day::text,
  day,
  split_part(settings."openTime", ':', 1)::integer * 60 +
    split_part(settings."openTime", ':', 2)::integer,
  split_part(settings."closeTime", ':', 1)::integer * 60 +
    split_part(settings."closeTime", ':', 2)::integer,
  'Legacy restaurant hours',
  true
FROM "RestaurantSettings" AS settings
CROSS JOIN generate_series(0, 6) AS day
WHERE settings."id" = '1'
  AND settings."openTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND settings."closeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  AND settings."openTime" <> settings."closeTime";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Reservation" AS first_reservation
    JOIN "Reservation" AS second_reservation
      ON second_reservation."tableId" = first_reservation."tableId"
      AND second_reservation."id" > first_reservation."id"
    WHERE first_reservation."tableId" IS NOT NULL
      AND first_reservation."status" IN ('confirmed', 'seated')
      AND second_reservation."status" IN ('confirmed', 'seated')
      AND tstzrange(
        first_reservation."dateTime",
        first_reservation."releaseAt",
        '[)'
      ) && tstzrange(
        second_reservation."dateTime",
        second_reservation."releaseAt",
        '[)'
      )
  ) THEN
    RAISE EXCEPTION
      'Existing active reservations double-book a table; resolve overlaps before migration';
  END IF;
END
$$;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_active_table_no_overlap"
  EXCLUDE USING gist (
    "tableId" WITH =,
    tstzrange("dateTime", "releaseAt", '[)') WITH &&
  )
  WHERE (
    "tableId" IS NOT NULL
    AND "status" IN ('confirmed', 'seated')
  );
