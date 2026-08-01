-- P1 immutable employee timekeeping.
-- Clock and break events are append-only. Closed shift summaries are immutable,
-- while manager corrections are signed adjustment rows rather than rewrites.

CREATE TYPE "TimeEventType" AS ENUM (
  'clock_in',
  'clock_out',
  'break_start',
  'break_end'
);

CREATE TYPE "TimeEventSource" AS ENUM (
  'kiosk',
  'manager',
  'import',
  'system'
);

CREATE TYPE "TimeShiftStatus" AS ENUM ('open', 'closed');

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "operationalDayStartMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantSettings"
  ADD CONSTRAINT "RestaurantSettings_timekeeping_bounds" CHECK (
    char_length(btrim("timezone")) BETWEEN 1 AND 80 AND
    "operationalDayStartMinutes" BETWEEN 0 AND 1439
  ) NOT VALID;

ALTER TABLE "RestaurantSettings"
  VALIDATE CONSTRAINT "RestaurantSettings_timekeeping_bounds";

CREATE FUNCTION "validate_restaurant_timezone"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_timezone_names WHERE name = NEW."timezone"
  ) THEN
    RAISE EXCEPTION 'Unknown restaurant timezone: %', NEW."timezone"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "RestaurantSettings_validate_timezone_insert"
BEFORE INSERT ON "RestaurantSettings"
FOR EACH ROW EXECUTE FUNCTION "validate_restaurant_timezone"();

CREATE TRIGGER "RestaurantSettings_validate_timezone_update"
BEFORE UPDATE OF "timezone", "operationalDayStartMinutes"
ON "RestaurantSettings"
FOR EACH ROW EXECUTE FUNCTION "validate_restaurant_timezone"();

CREATE TABLE "EmployeeTimeEvent" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eventType" "TimeEventType" NOT NULL,
  "source" "TimeEventSource" NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "operationalDate" DATE NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT '',
  "actorRole" TEXT NOT NULL DEFAULT '',
  "reasonCode" TEXT NOT NULL DEFAULT '',
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeTimeEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeTimeEvent_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeTimeEvent_shape" CHECK (
    char_length("idempotencyKey") BETWEEN 1 AND 191 AND
    char_length("actorName") <= 160 AND
    char_length("actorRole") <= 80 AND
    char_length("reasonCode") <= 80 AND
    char_length(COALESCE("reason", '')) <= 2000
  )
);

CREATE UNIQUE INDEX "EmployeeTimeEvent_idempotencyKey_key"
  ON "EmployeeTimeEvent"("idempotencyKey");
CREATE INDEX "EmployeeTimeEvent_employee_occurredAt_idx"
  ON "EmployeeTimeEvent"("employeeId", "occurredAt" DESC);
CREATE INDEX "EmployeeTimeEvent_operationalDate_idx"
  ON "EmployeeTimeEvent"("operationalDate", "occurredAt");
CREATE INDEX "EmployeeTimeEvent_type_createdAt_idx"
  ON "EmployeeTimeEvent"("eventType", "createdAt" DESC);

CREATE TABLE "EmployeeShift" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "TimeShiftStatus" NOT NULL DEFAULT 'open',
  "operationalDate" DATE NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "endedAt" TIMESTAMPTZ(3),
  "clockInEventId" TEXT NOT NULL,
  "clockOutEventId" TEXT,
  "grossSeconds" INTEGER NOT NULL DEFAULT 0,
  "breakSeconds" INTEGER NOT NULL DEFAULT 0,
  "paidSeconds" INTEGER NOT NULL DEFAULT 0,
  "hourlyWageMinor" BIGINT NOT NULL,
  "baseLaborCostMinor" BIGINT NOT NULL DEFAULT 0,
  "openedById" TEXT,
  "openedByName" TEXT NOT NULL DEFAULT '',
  "closedById" TEXT,
  "closedByName" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3),

  CONSTRAINT "EmployeeShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeShift_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeShift_clockInEventId_fkey"
    FOREIGN KEY ("clockInEventId") REFERENCES "EmployeeTimeEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeShift_clockOutEventId_fkey"
    FOREIGN KEY ("clockOutEventId") REFERENCES "EmployeeTimeEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeShift_state_shape" CHECK (
    "hourlyWageMinor" BETWEEN 0 AND 9007199254740991 AND
    "baseLaborCostMinor" BETWEEN 0 AND 9007199254740991 AND
    (
      "status" = 'open' AND
      "endedAt" IS NULL AND
      "clockOutEventId" IS NULL AND
      "grossSeconds" = 0 AND
      "breakSeconds" = 0 AND
      "paidSeconds" = 0 AND
      "baseLaborCostMinor" = 0 AND
      "closedAt" IS NULL
    ) OR (
      "status" = 'closed' AND
      "endedAt" IS NOT NULL AND
      "clockOutEventId" IS NOT NULL AND
      "endedAt" >= "startedAt" AND
      "grossSeconds" BETWEEN 0 AND 1209600 AND
      "breakSeconds" BETWEEN 0 AND "grossSeconds" AND
      "paidSeconds" = "grossSeconds" - "breakSeconds" AND
      "closedAt" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "EmployeeShift_clockInEventId_key"
  ON "EmployeeShift"("clockInEventId");
CREATE UNIQUE INDEX "EmployeeShift_clockOutEventId_key"
  ON "EmployeeShift"("clockOutEventId") WHERE "clockOutEventId" IS NOT NULL;
CREATE UNIQUE INDEX "EmployeeShift_one_open_employee_idx"
  ON "EmployeeShift"("employeeId") WHERE "status" = 'open';
CREATE INDEX "EmployeeShift_employee_operationalDate_idx"
  ON "EmployeeShift"("employeeId", "operationalDate" DESC, "startedAt" DESC);
CREATE INDEX "EmployeeShift_status_startedAt_idx"
  ON "EmployeeShift"("status", "startedAt");

CREATE TABLE "EmployeeBreak" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "status" "TimeShiftStatus" NOT NULL DEFAULT 'open',
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "endedAt" TIMESTAMPTZ(3),
  "startEventId" TEXT NOT NULL,
  "endEventId" TEXT,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "openedById" TEXT,
  "openedByName" TEXT NOT NULL DEFAULT '',
  "closedById" TEXT,
  "closedByName" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(3),

  CONSTRAINT "EmployeeBreak_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeBreak_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "EmployeeShift"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeBreak_startEventId_fkey"
    FOREIGN KEY ("startEventId") REFERENCES "EmployeeTimeEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeBreak_endEventId_fkey"
    FOREIGN KEY ("endEventId") REFERENCES "EmployeeTimeEvent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeBreak_state_shape" CHECK (
    (
      "status" = 'open' AND
      "endedAt" IS NULL AND
      "endEventId" IS NULL AND
      "durationSeconds" = 0 AND
      "closedAt" IS NULL
    ) OR (
      "status" = 'closed' AND
      "endedAt" IS NOT NULL AND
      "endEventId" IS NOT NULL AND
      "endedAt" >= "startedAt" AND
      "durationSeconds" BETWEEN 0 AND 604800 AND
      "closedAt" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "EmployeeBreak_startEventId_key"
  ON "EmployeeBreak"("startEventId");
CREATE UNIQUE INDEX "EmployeeBreak_endEventId_key"
  ON "EmployeeBreak"("endEventId") WHERE "endEventId" IS NOT NULL;
CREATE UNIQUE INDEX "EmployeeBreak_one_open_shift_idx"
  ON "EmployeeBreak"("shiftId") WHERE "status" = 'open';
CREATE INDEX "EmployeeBreak_shift_startedAt_idx"
  ON "EmployeeBreak"("shiftId", "startedAt");

CREATE TABLE "EmployeeTimeAdjustment" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "paidSecondsDelta" INTEGER NOT NULL,
  "laborCostDeltaMinor" BIGINT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeTimeAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeTimeAdjustment_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "EmployeeShift"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EmployeeTimeAdjustment_shape" CHECK (
    "paidSecondsDelta" BETWEEN -604800 AND 604800 AND
    "paidSecondsDelta" <> 0 AND
    "laborCostDeltaMinor" BETWEEN -9007199254740991 AND 9007199254740991 AND
    char_length(btrim("reasonCode")) BETWEEN 1 AND 80 AND
    char_length(btrim("reason")) BETWEEN 3 AND 2000 AND
    char_length(btrim("actorId")) BETWEEN 1 AND 191 AND
    char_length(btrim("actorName")) BETWEEN 1 AND 160 AND
    char_length(btrim("actorRole")) BETWEEN 1 AND 80
  )
);

CREATE UNIQUE INDEX "EmployeeTimeAdjustment_idempotencyKey_key"
  ON "EmployeeTimeAdjustment"("idempotencyKey");
CREATE INDEX "EmployeeTimeAdjustment_shift_createdAt_idx"
  ON "EmployeeTimeAdjustment"("shiftId", "createdAt");
CREATE INDEX "EmployeeTimeAdjustment_actor_createdAt_idx"
  ON "EmployeeTimeAdjustment"("actorId", "createdAt" DESC);

CREATE FUNCTION "protect_employee_time_event"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Employee time events are immutable; append a new event or adjustment'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "EmployeeTimeEvent_immutable_update"
BEFORE UPDATE ON "EmployeeTimeEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_time_event"();
CREATE TRIGGER "EmployeeTimeEvent_immutable_delete"
BEFORE DELETE ON "EmployeeTimeEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_time_event"();

CREATE FUNCTION "protect_employee_shift"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Employee shifts are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."status" = 'closed' THEN
    RAISE EXCEPTION 'Closed employee shifts are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."status" <> 'closed' OR
     NEW."id" IS DISTINCT FROM OLD."id" OR
     NEW."employeeId" IS DISTINCT FROM OLD."employeeId" OR
     NEW."operationalDate" IS DISTINCT FROM OLD."operationalDate" OR
     NEW."startedAt" IS DISTINCT FROM OLD."startedAt" OR
     NEW."clockInEventId" IS DISTINCT FROM OLD."clockInEventId" OR
     NEW."hourlyWageMinor" IS DISTINCT FROM OLD."hourlyWageMinor" OR
     NEW."openedById" IS DISTINCT FROM OLD."openedById" OR
     NEW."openedByName" IS DISTINCT FROM OLD."openedByName" OR
     NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Open employee shifts may only transition once to closed'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "EmployeeShift_protect_update"
BEFORE UPDATE ON "EmployeeShift"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_shift"();
CREATE TRIGGER "EmployeeShift_protect_delete"
BEFORE DELETE ON "EmployeeShift"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_shift"();

CREATE FUNCTION "protect_employee_break"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Employee breaks are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF OLD."status" = 'closed' THEN
    RAISE EXCEPTION 'Closed employee breaks are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."status" <> 'closed' OR
     NEW."id" IS DISTINCT FROM OLD."id" OR
     NEW."shiftId" IS DISTINCT FROM OLD."shiftId" OR
     NEW."startedAt" IS DISTINCT FROM OLD."startedAt" OR
     NEW."startEventId" IS DISTINCT FROM OLD."startEventId" OR
     NEW."openedById" IS DISTINCT FROM OLD."openedById" OR
     NEW."openedByName" IS DISTINCT FROM OLD."openedByName" OR
     NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Open employee breaks may only transition once to closed'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "EmployeeBreak_protect_update"
BEFORE UPDATE ON "EmployeeBreak"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_break"();
CREATE TRIGGER "EmployeeBreak_protect_delete"
BEFORE DELETE ON "EmployeeBreak"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_break"();

CREATE FUNCTION "protect_employee_time_adjustment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Employee time adjustments are immutable'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "EmployeeTimeAdjustment_immutable_update"
BEFORE UPDATE ON "EmployeeTimeAdjustment"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_time_adjustment"();
CREATE TRIGGER "EmployeeTimeAdjustment_immutable_delete"
BEFORE DELETE ON "EmployeeTimeAdjustment"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_time_adjustment"();

CREATE FUNCTION "validate_employee_time_adjustment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  shift_paid INTEGER;
  shift_status "TimeShiftStatus";
  existing_delta BIGINT;
BEGIN
  SELECT "paidSeconds", "status"
    INTO shift_paid, shift_status
  FROM "EmployeeShift"
  WHERE "id" = NEW."shiftId"
  FOR UPDATE;

  IF shift_status IS NULL THEN
    RAISE EXCEPTION 'Employee shift not found'
      USING ERRCODE = '23503';
  END IF;
  IF shift_status <> 'closed' THEN
    RAISE EXCEPTION 'Only closed shifts may receive time adjustments'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("paidSecondsDelta"), 0)
    INTO existing_delta
  FROM "EmployeeTimeAdjustment"
  WHERE "shiftId" = NEW."shiftId";

  IF shift_paid + existing_delta + NEW."paidSecondsDelta" < 0 THEN
    RAISE EXCEPTION 'Time adjustment would make paid shift duration negative'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "EmployeeTimeAdjustment_validate_insert"
BEFORE INSERT ON "EmployeeTimeAdjustment"
FOR EACH ROW EXECUTE FUNCTION "validate_employee_time_adjustment"();

CREATE FUNCTION "protect_employee_clock_cache"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.timekeeping_write', true) IS DISTINCT FROM 'on' AND (
    NEW."clockedIn" IS DISTINCT FROM OLD."clockedIn" OR
    NEW."lastClockIn" IS DISTINCT FROM OLD."lastClockIn" OR
    NEW."lastClockOut" IS DISTINCT FROM OLD."lastClockOut"
  ) THEN
    RAISE EXCEPTION 'Employee clock state is timekeeping-ledger controlled'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "Employee_clock_cache_guard"
BEFORE UPDATE OF "clockedIn", "lastClockIn", "lastClockOut"
ON "Employee"
FOR EACH ROW EXECUTE FUNCTION "protect_employee_clock_cache"();

-- Preserve the latest legacy clock state as an explicit imported event/shift.
INSERT INTO "EmployeeTimeEvent" (
  "id", "idempotencyKey", "employeeId", "eventType", "source",
  "occurredAt", "operationalDate", "actorName", "actorRole",
  "reasonCode", "reason", "metadata"
)
SELECT
  'time_event_in_' || md5(employee."id"),
  'legacy-clock-in:' || employee."id",
  employee."id",
  'clock_in'::"TimeEventType",
  'import'::"TimeEventSource",
  employee."lastClockIn" AT TIME ZONE 'UTC',
  (
    ((employee."lastClockIn" AT TIME ZONE 'UTC') AT TIME ZONE settings."timezone") -
    make_interval(mins => settings."operationalDayStartMinutes")
  )::date,
  'Migration',
  'system',
  'legacy_clock_state',
  'Imported from the legacy employee clock cache',
  jsonb_build_object('legacyClockedIn', employee."clockedIn")
FROM "Employee" AS employee
CROSS JOIN "RestaurantSettings" AS settings
WHERE settings."id" = '1'
  AND employee."lastClockIn" IS NOT NULL
  AND (
    employee."clockedIn" OR
    employee."lastClockOut" IS NULL OR
    employee."lastClockOut" >= employee."lastClockIn"
  );

INSERT INTO "EmployeeTimeEvent" (
  "id", "idempotencyKey", "employeeId", "eventType", "source",
  "occurredAt", "operationalDate", "actorName", "actorRole",
  "reasonCode", "reason", "metadata"
)
SELECT
  'time_event_out_' || md5(employee."id"),
  'legacy-clock-out:' || employee."id",
  employee."id",
  'clock_out'::"TimeEventType",
  'import'::"TimeEventSource",
  employee."lastClockOut" AT TIME ZONE 'UTC',
  (
    ((employee."lastClockOut" AT TIME ZONE 'UTC') AT TIME ZONE settings."timezone") -
    make_interval(mins => settings."operationalDayStartMinutes")
  )::date,
  'Migration',
  'system',
  'legacy_clock_state',
  'Imported from the legacy employee clock cache',
  jsonb_build_object('legacyClockedIn', employee."clockedIn")
FROM "Employee" AS employee
CROSS JOIN "RestaurantSettings" AS settings
WHERE settings."id" = '1'
  AND NOT employee."clockedIn"
  AND employee."lastClockIn" IS NOT NULL
  AND employee."lastClockOut" IS NOT NULL
  AND employee."lastClockOut" >= employee."lastClockIn";

INSERT INTO "EmployeeShift" (
  "id", "employeeId", "status", "operationalDate", "startedAt",
  "endedAt", "clockInEventId", "clockOutEventId", "grossSeconds",
  "breakSeconds", "paidSeconds", "hourlyWageMinor",
  "baseLaborCostMinor", "openedByName", "closedByName", "closedAt"
)
SELECT
  'time_shift_' || md5(employee."id"),
  employee."id",
  CASE WHEN employee."clockedIn" THEN 'open' ELSE 'closed' END::"TimeShiftStatus",
  event_in."operationalDate",
  event_in."occurredAt",
  CASE WHEN employee."clockedIn" THEN NULL ELSE event_out."occurredAt" END,
  event_in."id",
  CASE WHEN employee."clockedIn" THEN NULL ELSE event_out."id" END,
  CASE
    WHEN employee."clockedIn" THEN 0
    ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (event_out."occurredAt" - event_in."occurredAt")))::integer)
  END,
  0,
  CASE
    WHEN employee."clockedIn" THEN 0
    ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (event_out."occurredAt" - event_in."occurredAt")))::integer)
  END,
  employee."hourlyWageMinor",
  CASE
    WHEN employee."clockedIn" THEN 0
    ELSE (
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (event_out."occurredAt" - event_in."occurredAt")))::bigint) *
      employee."hourlyWageMinor" + 1800
    ) / 3600
  END,
  'Migration',
  CASE WHEN employee."clockedIn" THEN NULL ELSE 'Migration' END,
  CASE WHEN employee."clockedIn" THEN NULL ELSE event_out."occurredAt" END
FROM "Employee" AS employee
JOIN "EmployeeTimeEvent" AS event_in
  ON event_in."idempotencyKey" = 'legacy-clock-in:' || employee."id"
LEFT JOIN "EmployeeTimeEvent" AS event_out
  ON event_out."idempotencyKey" = 'legacy-clock-out:' || employee."id";
