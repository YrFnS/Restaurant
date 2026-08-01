-- Correct operator precedence in the initial shift-state check so the exact
-- wage and labor-cost bounds apply to both open and closed shifts.

ALTER TABLE "EmployeeShift"
  DROP CONSTRAINT "EmployeeShift_state_shape";

ALTER TABLE "EmployeeShift"
  ADD CONSTRAINT "EmployeeShift_state_shape" CHECK (
    "hourlyWageMinor" BETWEEN 0 AND 9007199254740991 AND
    "baseLaborCostMinor" BETWEEN 0 AND 9007199254740991 AND
    (
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
  ) NOT VALID;

ALTER TABLE "EmployeeShift"
  VALIDATE CONSTRAINT "EmployeeShift_state_shape";
