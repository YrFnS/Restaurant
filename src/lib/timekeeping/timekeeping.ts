import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MAX_BACKDATE_MS = 31 * 24 * 60 * 60 * 1_000;
const MAX_FUTURE_MS = 5 * 60 * 1_000;

export const TIME_ACTIONS = [
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
] as const;

export type TimeAction = (typeof TIME_ACTIONS)[number];
export type TimeEventSource = "kiosk" | "manager" | "import" | "system";

export type TimekeepingClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

export type TimekeepingActor = {
  id: string;
  name: string;
  role: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  hourlyWage: number;
  hourlyWageMinor: bigint;
  clockedIn: boolean;
  lastClockIn: Date | null;
  lastClockOut: Date | null;
};

type TimeEventRow = {
  id: string;
  idempotencyKey: string;
  employeeId: string;
  eventType: TimeAction;
  source: TimeEventSource;
  occurredAt: Date;
  operationalDate: Date;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  reasonCode: string;
  reason: string | null;
  createdAt: Date;
};

type ShiftRow = {
  id: string;
  employeeId: string;
  status: "open" | "closed";
  operationalDate: Date;
  startedAt: Date;
  endedAt: Date | null;
  clockInEventId: string;
  clockOutEventId: string | null;
  grossSeconds: number;
  breakSeconds: number;
  paidSeconds: number;
  hourlyWageMinor: bigint;
  baseLaborCostMinor: bigint;
  openedById: string | null;
  openedByName: string;
  closedById: string | null;
  closedByName: string | null;
  createdAt: Date;
  closedAt: Date | null;
};

type BreakRow = {
  id: string;
  shiftId: string;
  status: "open" | "closed";
  startedAt: Date;
  endedAt: Date | null;
  startEventId: string;
  endEventId: string | null;
  durationSeconds: number;
  openedById: string | null;
  openedByName: string;
  closedById: string | null;
  closedByName: string | null;
  createdAt: Date;
  closedAt: Date | null;
};

type ClockStatusRow = {
  id: string;
  name: string;
  role: string;
  hourlyWage: number;
  hourlyWageMinor: bigint;
  clockedIn: boolean;
  lastClockIn: Date | null;
  lastClockOut: Date | null;
  shiftId: string | null;
  shiftStartedAt: Date | null;
  operationalDate: Date | null;
  breakId: string | null;
  breakStartedAt: Date | null;
  elapsedSeconds: number;
  breakSeconds: number;
  paidSeconds: number;
  laborCostMinor: bigint;
};

type TimesheetRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  status: "open" | "closed";
  operationalDate: Date;
  startedAt: Date;
  endedAt: Date | null;
  grossSeconds: number;
  breakSeconds: number;
  paidSeconds: number;
  adjustmentSeconds: number;
  effectivePaidSeconds: number;
  hourlyWageMinor: bigint;
  baseLaborCostMinor: bigint;
  adjustmentCostMinor: bigint;
  effectiveLaborCostMinor: bigint;
  adjustmentCount: number;
};

type AdjustmentRow = {
  id: string;
  idempotencyKey: string;
  shiftId: string;
  paidSecondsDelta: number;
  laborCostDeltaMinor: bigint;
  reasonCode: string;
  reason: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  createdAt: Date;
};

export class TimekeepingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "TimekeepingError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function boundedText(value: string | null | undefined, maximum: number): string {
  return (value || "").trim().slice(0, maximum);
}

function minorToNumber(value: bigint): number {
  if (value < -MAX_SAFE_BIGINT || value > MAX_SAFE_BIGINT) {
    throw new TimekeepingError(
      "Stored labor amount cannot be represented safely",
      "UNSAFE_LABOR_AMOUNT",
      500
    );
  }
  return Number(value) / 100;
}

function secondsToHours(value: number): number {
  return Math.round((value / 3600) * 100) / 100;
}

function laborCostForSeconds(seconds: number, hourlyWageMinor: bigint): bigint {
  const absolute = BigInt(Math.abs(seconds));
  const amount = (absolute * hourlyWageMinor + 1800n) / 3600n;
  return seconds < 0 ? -amount : amount;
}

function normalizeOccurredAt(
  value: Date | string | null | undefined,
  source: TimeEventSource
): Date {
  const now = new Date();
  const occurredAt =
    value === null || value === undefined || value === ""
      ? now
      : value instanceof Date
        ? value
        : new Date(value);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new TimekeepingError(
      "A valid clock time is required",
      "INVALID_CLOCK_TIME",
      400
    );
  }
  if (occurredAt.getTime() > now.getTime() + MAX_FUTURE_MS) {
    throw new TimekeepingError(
      "Clock time cannot be in the future",
      "CLOCK_TIME_IN_FUTURE",
      400
    );
  }
  if (
    source !== "import" &&
    occurredAt.getTime() < now.getTime() - MAX_BACKDATE_MS
  ) {
    throw new TimekeepingError(
      "Backdated clock events are limited to 31 days",
      "CLOCK_TIME_TOO_OLD",
      400
    );
  }
  return occurredAt;
}

async function lockKey(
  client: TimekeepingClient,
  namespace: string,
  key: string
): Promise<void> {
  await client.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
    WITH timekeeping_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${namespace}:${key}`}, 0)
      )
    )
    SELECT 1::integer AS "locked"
    FROM timekeeping_lock
  `);
}

async function operationalDate(
  client: TimekeepingClient,
  occurredAt: Date
): Promise<Date> {
  const rows = await client.$queryRaw<Array<{ operationalDate: Date }>>(
    Prisma.sql`
      SELECT (
        ((${occurredAt}::timestamptz AT TIME ZONE settings."timezone") -
        make_interval(mins => settings."operationalDayStartMinutes"))::date
      ) AS "operationalDate"
      FROM "RestaurantSettings" AS settings
      WHERE settings."id" = '1'
    `
  );
  if (!rows[0]) {
    throw new TimekeepingError(
      "Restaurant timekeeping settings are missing",
      "TIMEKEEPING_SETTINGS_MISSING",
      500
    );
  }
  return rows[0].operationalDate;
}

async function lockedEmployee(
  client: TimekeepingClient,
  employeeId: string
): Promise<EmployeeRow> {
  const rows = await client.$queryRaw<EmployeeRow[]>(Prisma.sql`
    SELECT
      "id", "name", "role"::text AS "role", "isActive",
      "hourlyWage", "hourlyWageMinor", "clockedIn",
      "lastClockIn", "lastClockOut"
    FROM "Employee"
    WHERE "id" = ${employeeId}
    FOR UPDATE
  `);
  const employee = rows[0];
  if (!employee || !employee.isActive) {
    throw new TimekeepingError(
      "Employee is not available for timekeeping",
      "EMPLOYEE_NOT_AVAILABLE",
      404
    );
  }
  return employee;
}

async function openShift(
  client: TimekeepingClient,
  employeeId: string
): Promise<ShiftRow | null> {
  const rows = await client.$queryRaw<ShiftRow[]>(Prisma.sql`
    SELECT
      "id", "employeeId", "status"::text AS "status", "operationalDate",
      "startedAt", "endedAt", "clockInEventId", "clockOutEventId",
      "grossSeconds", "breakSeconds", "paidSeconds", "hourlyWageMinor",
      "baseLaborCostMinor", "openedById", "openedByName", "closedById",
      "closedByName", "createdAt", "closedAt"
    FROM "EmployeeShift"
    WHERE "employeeId" = ${employeeId} AND "status" = 'open'
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function openBreak(
  client: TimekeepingClient,
  shiftId: string
): Promise<BreakRow | null> {
  const rows = await client.$queryRaw<BreakRow[]>(Prisma.sql`
    SELECT
      "id", "shiftId", "status"::text AS "status", "startedAt",
      "endedAt", "startEventId", "endEventId", "durationSeconds",
      "openedById", "openedByName", "closedById", "closedByName",
      "createdAt", "closedAt"
    FROM "EmployeeBreak"
    WHERE "shiftId" = ${shiftId} AND "status" = 'open'
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

async function latestEventTime(
  client: TimekeepingClient,
  employeeId: string
): Promise<Date | null> {
  const rows = await client.$queryRaw<Array<{ occurredAt: Date }>>(Prisma.sql`
    SELECT "occurredAt"
    FROM "EmployeeTimeEvent"
    WHERE "employeeId" = ${employeeId}
    ORDER BY "occurredAt" DESC, "createdAt" DESC, "id" DESC
    LIMIT 1
  `);
  return rows[0]?.occurredAt ?? null;
}

async function eventByKey(
  client: TimekeepingClient,
  key: string
): Promise<TimeEventRow | null> {
  const rows = await client.$queryRaw<TimeEventRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "employeeId", "eventType"::text AS "eventType",
      "source"::text AS "source", "occurredAt", "operationalDate",
      "actorId", "actorName", "actorRole", "reasonCode", "reason",
      "createdAt"
    FROM "EmployeeTimeEvent"
    WHERE "idempotencyKey" = ${key}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function insertEvent(
  client: TimekeepingClient,
  input: {
    key: string;
    employeeId: string;
    action: TimeAction;
    source: TimeEventSource;
    occurredAt: Date;
    operationalDate: Date;
    actor: TimekeepingActor;
    reasonCode?: string;
    reason?: string | null;
    metadata?: unknown;
  }
): Promise<TimeEventRow> {
  const id = newId("time_event");
  const metadata =
    input.metadata === undefined ? null : JSON.stringify(input.metadata);
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "EmployeeTimeEvent" (
      "id", "idempotencyKey", "employeeId", "eventType", "source",
      "occurredAt", "operationalDate", "actorId", "actorName",
      "actorRole", "reasonCode", "reason", "metadata"
    ) VALUES (
      ${id}, ${input.key}, ${input.employeeId},
      CAST(${input.action} AS "TimeEventType"),
      CAST(${input.source} AS "TimeEventSource"),
      ${input.occurredAt}, ${input.operationalDate}, ${input.actor.id},
      ${boundedText(input.actor.name, 160)},
      ${boundedText(input.actor.role, 80)},
      ${boundedText(input.reasonCode, 80)},
      ${input.reason ? boundedText(input.reason, 2000) : null},
      CAST(${metadata} AS jsonb)
    )
  `);
  const created = await eventByKey(client, input.key);
  if (!created) {
    throw new TimekeepingError(
      "Unable to load the created time event",
      "TIME_EVENT_RESULT_MISSING",
      500
    );
  }
  return created;
}

async function setEmployeeClockCache(
  client: TimekeepingClient,
  input: {
    employeeId: string;
    clockedIn: boolean;
    lastClockIn?: Date;
    lastClockOut?: Date;
  }
): Promise<void> {
  await client.$executeRaw(Prisma.sql`
    SELECT set_config('app.timekeeping_write', 'on', true)
  `);
  await client.$executeRaw(Prisma.sql`
    UPDATE "Employee"
    SET
      "clockedIn" = ${input.clockedIn},
      "lastClockIn" = COALESCE(${input.lastClockIn || null}, "lastClockIn"),
      "lastClockOut" = COALESCE(${input.lastClockOut || null}, "lastClockOut"),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.employeeId}
  `);
}

async function readClockStatusForEmployee(
  client: TimekeepingClient,
  employeeId: string
): Promise<ReturnType<typeof serializeClockStatus> | null> {
  const rows = await clockStatusRows(client, employeeId);
  return rows[0] ? serializeClockStatus(rows[0]) : null;
}

function serializeClockStatus(row: ClockStatusRow) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    hourlyWage: row.hourlyWage,
    clockedIn: row.clockedIn,
    lastClockIn: row.lastClockIn,
    lastClockOut: row.lastClockOut,
    shiftId: row.shiftId,
    shiftStartedAt: row.shiftStartedAt,
    operationalDate: row.operationalDate,
    onBreak: Boolean(row.breakId),
    breakStartedAt: row.breakStartedAt,
    elapsedSeconds: row.elapsedSeconds,
    breakSeconds: row.breakSeconds,
    paidSeconds: row.paidSeconds,
    currentSessionHours: secondsToHours(row.paidSeconds),
    laborCost: minorToNumber(row.laborCostMinor),
  };
}

async function clockStatusRows(
  client: TimekeepingClient,
  employeeId?: string
): Promise<ClockStatusRow[]> {
  const filter = employeeId
    ? Prisma.sql`AND employee."id" = ${employeeId}`
    : Prisma.empty;
  return client.$queryRaw<ClockStatusRow[]>(Prisma.sql`
    SELECT
      employee."id", employee."name", employee."role"::text AS "role",
      employee."hourlyWage", employee."hourlyWageMinor",
      employee."clockedIn", employee."lastClockIn", employee."lastClockOut",
      shift."id" AS "shiftId", shift."startedAt" AS "shiftStartedAt",
      shift."operationalDate", active_break."id" AS "breakId",
      active_break."startedAt" AS "breakStartedAt",
      CASE
        WHEN shift."id" IS NULL THEN 0
        ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - shift."startedAt")))::integer)
      END AS "elapsedSeconds",
      CASE
        WHEN shift."id" IS NULL THEN 0
        ELSE COALESCE(closed_breaks."seconds", 0)::integer +
          CASE
            WHEN active_break."id" IS NULL THEN 0
            ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - active_break."startedAt")))::integer)
          END
      END AS "breakSeconds",
      CASE
        WHEN shift."id" IS NULL THEN 0
        ELSE GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - shift."startedAt")))::integer -
          COALESCE(closed_breaks."seconds", 0)::integer -
          CASE
            WHEN active_break."id" IS NULL THEN 0
            ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - active_break."startedAt")))::integer)
          END
        )
      END AS "paidSeconds",
      CASE
        WHEN shift."id" IS NULL THEN 0::bigint
        ELSE (
          GREATEST(
            0,
            FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - shift."startedAt")))::bigint -
            COALESCE(closed_breaks."seconds", 0)::bigint -
            CASE
              WHEN active_break."id" IS NULL THEN 0
              ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - active_break."startedAt")))::bigint)
            END
          ) * shift."hourlyWageMinor" + 1800
        ) / 3600
      END AS "laborCostMinor"
    FROM "Employee" AS employee
    LEFT JOIN "EmployeeShift" AS shift
      ON shift."employeeId" = employee."id" AND shift."status" = 'open'
    LEFT JOIN "EmployeeBreak" AS active_break
      ON active_break."shiftId" = shift."id" AND active_break."status" = 'open'
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM("durationSeconds"), 0)::bigint AS "seconds"
      FROM "EmployeeBreak"
      WHERE "shiftId" = shift."id" AND "status" = 'closed'
    ) AS closed_breaks ON true
    WHERE employee."isActive" = true
    ${filter}
    ORDER BY employee."name" ASC, employee."id" ASC
  `);
}

export async function clockEmployee(
  client: TimekeepingClient,
  input: {
    idempotencyKey: string;
    employeeId: string;
    action: TimeAction;
    source: TimeEventSource;
    actor: TimekeepingActor;
    occurredAt?: Date | string | null;
    reasonCode?: string;
    reason?: string | null;
  }
): Promise<{
  event: TimeEventRow;
  employee: NonNullable<ReturnType<typeof serializeClockStatus>>;
  replayed: boolean;
}> {
  const key = boundedText(input.idempotencyKey, 191);
  if (!key) {
    throw new TimekeepingError(
      "An idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  const submittedOccurredAt =
    input.occurredAt === null ||
    input.occurredAt === undefined ||
    input.occurredAt === ""
      ? null
      : input.occurredAt instanceof Date
        ? input.occurredAt
        : new Date(input.occurredAt);
  if (submittedOccurredAt && Number.isNaN(submittedOccurredAt.getTime())) {
    throw new TimekeepingError(
      "A valid clock time is required",
      "INVALID_CLOCK_TIME",
      400
    );
  }
  const reasonCode = boundedText(input.reasonCode, 80);
  const reason = boundedText(input.reason, 2000) || null;
  const actorName = boundedText(input.actor.name, 160);
  const actorRole = boundedText(input.actor.role, 80);

  await lockKey(client, "employee-time-event", key);
  const replay = await eventByKey(client, key);
  if (replay) {
    if (
      replay.employeeId !== input.employeeId ||
      replay.eventType !== input.action ||
      replay.source !== input.source ||
      replay.actorId !== input.actor.id ||
      replay.actorName !== actorName ||
      replay.actorRole !== actorRole ||
      replay.reasonCode !== reasonCode ||
      (replay.reason ?? null) !== reason ||
      (submittedOccurredAt !== null &&
        replay.occurredAt.getTime() !== submittedOccurredAt.getTime())
    ) {
      throw new TimekeepingError(
        "The timekeeping idempotency key was used for another event payload",
        "TIME_EVENT_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    const status = await readClockStatusForEmployee(client, input.employeeId);
    if (!status) {
      throw new TimekeepingError(
        "Unable to load replayed employee status",
        "TIMEKEEPING_STATUS_MISSING",
        500
      );
    }
    return { event: replay, employee: status, replayed: true };
  }

  const employee = await lockedEmployee(client, input.employeeId);
  const occurredAt = normalizeOccurredAt(input.occurredAt, input.source);
  const lastEvent = await latestEventTime(client, employee.id);
  if (lastEvent && occurredAt.getTime() < lastEvent.getTime()) {
    throw new TimekeepingError(
      "Clock events must be recorded in chronological order",
      "CLOCK_EVENT_OUT_OF_ORDER",
      409,
      { latestEventAt: lastEvent }
    );
  }
  const day = await operationalDate(client, occurredAt);
  const shift = await openShift(client, employee.id);
  const activeBreak = shift ? await openBreak(client, shift.id) : null;

  if (input.action === "clock_in" && shift) {
    throw new TimekeepingError(
      "Employee already has an open shift",
      "EMPLOYEE_ALREADY_CLOCKED_IN",
      409
    );
  }
  if (input.action !== "clock_in" && !shift) {
    throw new TimekeepingError(
      "Employee does not have an open shift",
      "EMPLOYEE_NOT_CLOCKED_IN",
      409
    );
  }
  if (input.action === "break_start" && activeBreak) {
    throw new TimekeepingError(
      "Employee already has an open break",
      "EMPLOYEE_ALREADY_ON_BREAK",
      409
    );
  }
  if (input.action === "break_end" && !activeBreak) {
    throw new TimekeepingError(
      "Employee does not have an open break",
      "EMPLOYEE_NOT_ON_BREAK",
      409
    );
  }
  if (input.action === "clock_out" && activeBreak) {
    throw new TimekeepingError(
      "End the active break before clocking out",
      "ACTIVE_BREAK_MUST_END",
      409
    );
  }
  if (shift && occurredAt.getTime() < shift.startedAt.getTime()) {
    throw new TimekeepingError(
      "Clock event cannot precede the shift start",
      "CLOCK_EVENT_BEFORE_SHIFT",
      409
    );
  }
  if (activeBreak && occurredAt.getTime() < activeBreak.startedAt.getTime()) {
    throw new TimekeepingError(
      "Break end cannot precede break start",
      "BREAK_END_BEFORE_START",
      409
    );
  }

  const event = await insertEvent(client, {
    key,
    employeeId: employee.id,
    action: input.action,
    source: input.source,
    occurredAt,
    operationalDate: day,
    actor: input.actor,
    reasonCode,
    reason,
    metadata: { employeeRole: employee.role },
  });

  if (input.action === "clock_in") {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "EmployeeShift" (
        "id", "employeeId", "operationalDate", "startedAt",
        "clockInEventId", "hourlyWageMinor", "openedById", "openedByName"
      ) VALUES (
        ${newId("employee_shift")}, ${employee.id}, ${day}, ${occurredAt},
        ${event.id}, ${employee.hourlyWageMinor}, ${input.actor.id},
        ${boundedText(input.actor.name, 160)}
      )
    `);
    await setEmployeeClockCache(client, {
      employeeId: employee.id,
      clockedIn: true,
      lastClockIn: occurredAt,
    });
  } else if (input.action === "break_start") {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "EmployeeBreak" (
        "id", "shiftId", "startedAt", "startEventId",
        "openedById", "openedByName"
      ) VALUES (
        ${newId("employee_break")}, ${shift!.id}, ${occurredAt}, ${event.id},
        ${input.actor.id}, ${boundedText(input.actor.name, 160)}
      )
    `);
  } else if (input.action === "break_end") {
    const durationSeconds = Math.max(
      0,
      Math.floor((occurredAt.getTime() - activeBreak!.startedAt.getTime()) / 1000)
    );
    await client.$executeRaw(Prisma.sql`
      UPDATE "EmployeeBreak"
      SET
        "status" = 'closed',
        "endedAt" = ${occurredAt},
        "endEventId" = ${event.id},
        "durationSeconds" = ${durationSeconds},
        "closedById" = ${input.actor.id},
        "closedByName" = ${boundedText(input.actor.name, 160)},
        "closedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${activeBreak!.id}
    `);
  } else {
    const breaks = await client.$queryRaw<Array<{ seconds: bigint }>>(Prisma.sql`
      SELECT COALESCE(SUM("durationSeconds"), 0)::bigint AS "seconds"
      FROM "EmployeeBreak"
      WHERE "shiftId" = ${shift!.id} AND "status" = 'closed'
    `);
    const grossSeconds = Math.max(
      0,
      Math.floor((occurredAt.getTime() - shift!.startedAt.getTime()) / 1000)
    );
    const breakSeconds = Number(breaks[0]?.seconds || 0n);
    const paidSeconds = Math.max(0, grossSeconds - breakSeconds);
    const laborCostMinor = laborCostForSeconds(
      paidSeconds,
      shift!.hourlyWageMinor
    );
    await client.$executeRaw(Prisma.sql`
      UPDATE "EmployeeShift"
      SET
        "status" = 'closed',
        "endedAt" = ${occurredAt},
        "clockOutEventId" = ${event.id},
        "grossSeconds" = ${grossSeconds},
        "breakSeconds" = ${breakSeconds},
        "paidSeconds" = ${paidSeconds},
        "baseLaborCostMinor" = ${laborCostMinor},
        "closedById" = ${input.actor.id},
        "closedByName" = ${boundedText(input.actor.name, 160)},
        "closedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${shift!.id}
    `);
    await setEmployeeClockCache(client, {
      employeeId: employee.id,
      clockedIn: false,
      lastClockOut: occurredAt,
    });
  }

  const status = await readClockStatusForEmployee(client, employee.id);
  if (!status) {
    throw new TimekeepingError(
      "Unable to load employee timekeeping status",
      "TIMEKEEPING_STATUS_MISSING",
      500
    );
  }
  return { event, employee: status, replayed: false };
}

export async function readClockStatuses(client: TimekeepingClient) {
  const rows = await clockStatusRows(client);
  const employees = rows.map(serializeClockStatus);
  const clockedInCount = employees.filter((entry) => entry.clockedIn).length;
  const onBreakCount = employees.filter((entry) => entry.onBreak).length;
  const currentPaidSeconds = employees.reduce(
    (total, entry) => total + entry.paidSeconds,
    0
  );
  const currentLaborCost = employees.reduce(
    (total, entry) => total + entry.laborCost,
    0
  );
  return {
    employees,
    clockedInCount,
    onBreakCount,
    currentPaidHours: secondsToHours(currentPaidSeconds),
    currentLaborCost: Math.round(currentLaborCost * 100) / 100,
  };
}

function serializeTimesheet(row: TimesheetRow) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeRole: row.employeeRole,
    status: row.status,
    operationalDate: row.operationalDate,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    grossSeconds: row.grossSeconds,
    breakSeconds: row.breakSeconds,
    paidSeconds: row.paidSeconds,
    adjustmentSeconds: row.adjustmentSeconds,
    effectivePaidSeconds: row.effectivePaidSeconds,
    grossHours: secondsToHours(row.grossSeconds),
    breakHours: secondsToHours(row.breakSeconds),
    paidHours: secondsToHours(row.effectivePaidSeconds),
    hourlyWage: minorToNumber(row.hourlyWageMinor),
    baseLaborCost: minorToNumber(row.baseLaborCostMinor),
    adjustmentCost: minorToNumber(row.adjustmentCostMinor),
    laborCost: minorToNumber(row.effectiveLaborCostMinor),
    adjustmentCount: row.adjustmentCount,
  };
}

export async function readTimesheet(
  client: TimekeepingClient,
  options: {
    from: string;
    to: string;
    employeeId?: string;
    limit?: number;
  }
) {
  const limit = Math.max(1, Math.min(options.limit || 500, 2_000));
  const employeeFilter = options.employeeId
    ? Prisma.sql`AND shift."employeeId" = ${options.employeeId}`
    : Prisma.empty;
  const rows = await client.$queryRaw<TimesheetRow[]>(Prisma.sql`
    SELECT
      shift."id", shift."employeeId", employee."name" AS "employeeName",
      employee."role"::text AS "employeeRole",
      shift."status"::text AS "status", shift."operationalDate",
      shift."startedAt", shift."endedAt", shift."grossSeconds",
      shift."breakSeconds", shift."paidSeconds",
      COALESCE(adjustment."seconds", 0)::integer AS "adjustmentSeconds",
      (shift."paidSeconds" + COALESCE(adjustment."seconds", 0))::integer
        AS "effectivePaidSeconds",
      shift."hourlyWageMinor", shift."baseLaborCostMinor",
      COALESCE(adjustment."cost", 0)::bigint AS "adjustmentCostMinor",
      (shift."baseLaborCostMinor" + COALESCE(adjustment."cost", 0))::bigint
        AS "effectiveLaborCostMinor",
      COALESCE(adjustment."count", 0)::integer AS "adjustmentCount"
    FROM "EmployeeShift" AS shift
    JOIN "Employee" AS employee ON employee."id" = shift."employeeId"
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM("paidSecondsDelta"), 0)::bigint AS "seconds",
        COALESCE(SUM("laborCostDeltaMinor"), 0)::bigint AS "cost",
        COUNT(*)::integer AS "count"
      FROM "EmployeeTimeAdjustment"
      WHERE "shiftId" = shift."id"
    ) AS adjustment ON true
    WHERE shift."operationalDate" BETWEEN ${options.from}::date AND ${options.to}::date
      AND shift."status" = 'closed'
      ${employeeFilter}
    ORDER BY shift."operationalDate" DESC, shift."startedAt" DESC, shift."id" DESC
    LIMIT ${limit}
  `);
  const shifts = rows.map(serializeTimesheet);
  const totalPaidSeconds = rows.reduce(
    (total, shift) => total + shift.effectivePaidSeconds,
    0
  );
  const totalBreakSeconds = rows.reduce(
    (total, shift) => total + shift.breakSeconds,
    0
  );
  const totalLaborCostMinor = rows.reduce(
    (total, shift) => total + shift.effectiveLaborCostMinor,
    0n
  );
  return {
    shifts,
    summary: {
      shiftCount: rows.length,
      paidHours: secondsToHours(totalPaidSeconds),
      breakHours: secondsToHours(totalBreakSeconds),
      laborCost: minorToNumber(totalLaborCostMinor),
      adjustmentCount: rows.reduce(
        (total, shift) => total + shift.adjustmentCount,
        0
      ),
    },
  };
}

async function adjustmentByKey(
  client: TimekeepingClient,
  key: string
): Promise<AdjustmentRow | null> {
  const rows = await client.$queryRaw<AdjustmentRow[]>(Prisma.sql`
    SELECT
      "id", "idempotencyKey", "shiftId", "paidSecondsDelta",
      "laborCostDeltaMinor", "reasonCode", "reason", "actorId",
      "actorName", "actorRole", "createdAt"
    FROM "EmployeeTimeAdjustment"
    WHERE "idempotencyKey" = ${key}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

function serializeAdjustment(row: AdjustmentRow) {
  return {
    id: row.id,
    shiftId: row.shiftId,
    paidSecondsDelta: row.paidSecondsDelta,
    paidHoursDelta: secondsToHours(row.paidSecondsDelta),
    laborCostDelta: minorToNumber(row.laborCostDeltaMinor),
    reasonCode: row.reasonCode,
    reason: row.reason,
    actorId: row.actorId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    createdAt: row.createdAt,
  };
}

export async function addTimeAdjustment(
  client: TimekeepingClient,
  input: {
    idempotencyKey: string;
    shiftId: string;
    paidMinutesDelta: number;
    reasonCode: string;
    reason: string;
    actor: TimekeepingActor;
  }
): Promise<{ adjustment: ReturnType<typeof serializeAdjustment>; replayed: boolean }> {
  const key = boundedText(input.idempotencyKey, 191);
  if (!key) {
    throw new TimekeepingError(
      "An idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  if (!Number.isFinite(input.paidMinutesDelta)) {
    throw new TimekeepingError(
      "A valid paid-time adjustment is required",
      "INVALID_TIME_ADJUSTMENT",
      400
    );
  }
  const paidSecondsDelta = Math.round(input.paidMinutesDelta * 60);
  if (paidSecondsDelta === 0 || Math.abs(paidSecondsDelta) > 604_800) {
    throw new TimekeepingError(
      "Adjustment must be non-zero and no larger than 168 hours",
      "INVALID_TIME_ADJUSTMENT",
      400
    );
  }
  const reasonCode = boundedText(input.reasonCode, 80);
  const reason = boundedText(input.reason, 2000);
  if (!reasonCode || reason.length < 3) {
    throw new TimekeepingError(
      "A reason code and explanation are required",
      "TIME_ADJUSTMENT_REASON_REQUIRED",
      400
    );
  }
  const actorName = boundedText(input.actor.name, 160);
  const actorRole = boundedText(input.actor.role, 80);

  await lockKey(client, "employee-time-adjustment", key);
  const replay = await adjustmentByKey(client, key);
  if (replay) {
    if (
      replay.shiftId !== input.shiftId ||
      replay.paidSecondsDelta !== paidSecondsDelta ||
      replay.reasonCode !== reasonCode ||
      replay.reason !== reason ||
      replay.actorId !== input.actor.id ||
      replay.actorName !== actorName ||
      replay.actorRole !== actorRole
    ) {
      throw new TimekeepingError(
        "The adjustment idempotency key was used for another payload",
        "TIME_ADJUSTMENT_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return { adjustment: serializeAdjustment(replay), replayed: true };
  }

  const shifts = await client.$queryRaw<ShiftRow[]>(Prisma.sql`
    SELECT
      "id", "employeeId", "status"::text AS "status", "operationalDate",
      "startedAt", "endedAt", "clockInEventId", "clockOutEventId",
      "grossSeconds", "breakSeconds", "paidSeconds", "hourlyWageMinor",
      "baseLaborCostMinor", "openedById", "openedByName", "closedById",
      "closedByName", "createdAt", "closedAt"
    FROM "EmployeeShift"
    WHERE "id" = ${input.shiftId}
    FOR UPDATE
  `);
  const shift = shifts[0];
  if (!shift) {
    throw new TimekeepingError("Shift not found", "SHIFT_NOT_FOUND", 404);
  }
  if (shift.status !== "closed") {
    throw new TimekeepingError(
      "Only closed shifts can be adjusted",
      "SHIFT_NOT_CLOSED",
      409
    );
  }

  const laborCostDeltaMinor = laborCostForSeconds(
    paidSecondsDelta,
    shift.hourlyWageMinor
  );
  const id = newId("time_adjustment");
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "EmployeeTimeAdjustment" (
      "id", "idempotencyKey", "shiftId", "paidSecondsDelta",
      "laborCostDeltaMinor", "reasonCode", "reason", "actorId",
      "actorName", "actorRole"
    ) VALUES (
      ${id}, ${key}, ${shift.id}, ${paidSecondsDelta},
      ${laborCostDeltaMinor}, ${reasonCode}, ${reason}, ${input.actor.id},
      ${actorName},
      ${actorRole}
    )
  `);
  const created = await adjustmentByKey(client, key);
  if (!created) {
    throw new TimekeepingError(
      "Unable to load the created adjustment",
      "TIME_ADJUSTMENT_RESULT_MISSING",
      500
    );
  }
  return { adjustment: serializeAdjustment(created), replayed: false };
}

function databaseErrorDetails(error: unknown): string {
  const values: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5 || value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number") {
      values.push(String(value));
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Error) {
      values.push(value.name, value.message);
      visit(value.cause, depth + 1);
    }
    const record = value as Record<string, unknown>;
    for (const key of ["code", "message", "meta", "cause", "constraint", "target", "detail"]) {
      visit(record[key], depth + 1);
    }
  };
  visit(error, 0);
  return values.join(" ");
}

export function timekeepingErrorFromDatabase(
  error: unknown
): TimekeepingError | null {
  const details = databaseErrorDetails(error);
  if (details.includes("EmployeeShift_one_open_employee_idx")) {
    return new TimekeepingError(
      "Employee already has an open shift",
      "EMPLOYEE_ALREADY_CLOCKED_IN",
      409
    );
  }
  if (details.includes("EmployeeBreak_one_open_shift_idx")) {
    return new TimekeepingError(
      "Employee already has an open break",
      "EMPLOYEE_ALREADY_ON_BREAK",
      409
    );
  }
  if (details.includes("EmployeeTimeEvent_idempotencyKey_key")) {
    return new TimekeepingError(
      "The clock-event idempotency key was already used",
      "TIME_EVENT_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (details.includes("EmployeeTimeAdjustment_idempotencyKey_key")) {
    return new TimekeepingError(
      "The time-adjustment idempotency key was already used",
      "TIME_ADJUSTMENT_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (details.includes("Time adjustment would make paid shift duration negative")) {
    return new TimekeepingError(
      "Adjustment would make paid shift duration negative",
      "NEGATIVE_EFFECTIVE_SHIFT",
      409
    );
  }
  if (details.includes("Employee clock state is timekeeping-ledger controlled")) {
    return new TimekeepingError(
      "Employee clock state is ledger-controlled",
      "DIRECT_CLOCK_STATE_EDIT_DISABLED",
      409
    );
  }
  if (
    details.includes("Employee time events are immutable") ||
    details.includes("Employee shifts are immutable") ||
    details.includes("Closed employee shifts are immutable") ||
    details.includes("Employee breaks are immutable") ||
    details.includes("Closed employee breaks are immutable") ||
    details.includes("Employee time adjustments are immutable")
  ) {
    return new TimekeepingError(
      "Timekeeping history is immutable; append a correction instead",
      "TIMEKEEPING_HISTORY_IMMUTABLE",
      409
    );
  }
  if (details.includes("Unknown restaurant timezone")) {
    return new TimekeepingError(
      "Unknown restaurant timezone",
      "INVALID_RESTAURANT_TIMEZONE",
      400
    );
  }
  return null;
}
