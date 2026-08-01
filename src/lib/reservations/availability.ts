import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ReservationClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

export interface ReservationPolicy {
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  defaultDurationMinutes: number;
  turnoverMinutes: number;
  slotIntervalMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  customerCancelCutoffMinutes: number;
  today: string;
  maximumDate: string;
}

export interface ReservationAvailabilitySlot {
  date: string;
  time: string;
  startsAt: Date;
  endsAt: Date;
  releaseAt: Date;
  availableTableCount: number;
  bestCapacity: number;
}

export interface ReservationAvailabilityResult {
  date: string;
  partySize: number;
  timezone: string;
  policy: Omit<ReservationPolicy, "today" | "maximumDate" | "timezone"> & {
    earliestDate: string;
    latestDate: string;
  };
  slots: ReservationAvailabilitySlot[];
}

export interface ReservationBookingInput {
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  partySize: number;
  date: string;
  time: string;
  occasion?: string | null;
  preference?: string | null;
  notes?: string | null;
  source: "customer" | "staff" | "import";
}

export interface LockedReservation {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  partySize: number;
  tableId: string | null;
  dateTime: Date;
  durationMinutes: number;
  turnoverMinutes: number;
  endsAt: Date;
  releaseAt: Date;
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  occasion: string | null;
  preference: string | null;
  notes: string | null;
  source: "customer" | "staff" | "import";
  seatedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  noShowAt: Date | null;
}

type PolicyRow = {
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  defaultDurationMinutes: number;
  turnoverMinutes: number;
  slotIntervalMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  customerCancelCutoffMinutes: number;
  today: string;
  maximumDate: string;
};

type AvailabilityRow = ReservationAvailabilitySlot & {
  date: string;
  time: string;
};

type CandidateTable = {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: string;
};

export class ReservationAvailabilityError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "ReservationAvailabilityError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function clean(value: string | null | undefined, maximum = 2_000): string {
  return (value || "").trim().slice(0, maximum);
}

function normalizedOptional(
  value: string | null | undefined,
  maximum: number
): string | null {
  const result = clean(value, maximum);
  return result || null;
}

function dateParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    localDate: `${map.get("year")}-${map.get("month")}-${map.get("day")}`,
    localTime: `${map.get("hour")}:${map.get("minute")}`,
  };
}

export function formatRestaurantInstant(value: Date, timezone: string) {
  return dateParts(value, timezone);
}

export function serializeReservationForCustomer(
  reservation: any,
  timezone: string
) {
  const start = dateParts(new Date(reservation.dateTime), timezone);
  const end = dateParts(new Date(reservation.endsAt), timezone);
  return {
    id: reservation.id,
    customerName: reservation.customerName,
    partySize: reservation.partySize,
    dateTime: reservation.dateTime,
    endsAt: reservation.endsAt,
    releaseAt: reservation.releaseAt,
    durationMinutes: reservation.durationMinutes,
    turnoverMinutes: reservation.turnoverMinutes,
    status: reservation.status,
    occasion: reservation.occasion,
    preference: reservation.preference,
    notes: reservation.notes,
    table: reservation.table
      ? {
          number: reservation.table.number,
          section: reservation.table.section,
        }
      : null,
    localDate: start.localDate,
    localTime: start.localTime,
    localEndDate: end.localDate,
    localEndTime: end.localTime,
    timezone,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

export function serializeReservationForStaff(
  reservation: any,
  timezone: string
) {
  return {
    ...reservation,
    ...serializeReservationForCustomer(reservation, timezone),
    customerPhone: reservation.customerPhone,
    customerEmail: reservation.customerEmail,
    customerId: reservation.customerId,
    source: reservation.source,
    seatedAt: reservation.seatedAt,
    completedAt: reservation.completedAt,
    cancelledAt: reservation.cancelledAt,
    noShowAt: reservation.noShowAt,
  };
}

export async function readReservationPolicy(
  client: ReservationClient = db
): Promise<ReservationPolicy> {
  const rows = await client.$queryRaw<PolicyRow[]>(Prisma.sql`
    SELECT
      settings."timezone",
      settings."reservationMinNoticeMinutes" AS "minNoticeMinutes",
      settings."reservationMaxAdvanceDays" AS "maxAdvanceDays",
      settings."reservationDefaultDurationMinutes" AS "defaultDurationMinutes",
      settings."reservationTurnoverMinutes" AS "turnoverMinutes",
      settings."reservationSlotIntervalMinutes" AS "slotIntervalMinutes",
      settings."reservationMinPartySize" AS "minPartySize",
      settings."reservationMaxPartySize" AS "maxPartySize",
      settings."reservationCustomerCancelCutoffMinutes" AS "customerCancelCutoffMinutes",
      to_char(
        (CURRENT_TIMESTAMP AT TIME ZONE settings."timezone")::date,
        'YYYY-MM-DD'
      ) AS "today",
      to_char(
        (CURRENT_TIMESTAMP AT TIME ZONE settings."timezone")::date +
          settings."reservationMaxAdvanceDays",
        'YYYY-MM-DD'
      ) AS "maximumDate"
    FROM "RestaurantSettings" AS settings
    WHERE settings."id" = '1'
  `);
  const policy = rows[0];
  if (!policy) {
    throw new ReservationAvailabilityError(
      "Reservation settings are missing",
      "RESERVATION_SETTINGS_MISSING",
      503
    );
  }
  return policy;
}

export async function restaurantLocalDateTimeToUtc(
  client: ReservationClient,
  date: string,
  time: string
): Promise<Date> {
  const rows = await client.$queryRaw<Array<{ instant: Date }>>(Prisma.sql`
    SELECT (
      (${date}::date + ${time}::time) AT TIME ZONE settings."timezone"
    ) AS "instant"
    FROM "RestaurantSettings" AS settings
    WHERE settings."id" = '1'
  `);
  const instant = rows[0]?.instant;
  if (!instant) {
    throw new ReservationAvailabilityError(
      "Unable to resolve restaurant-local time",
      "RESERVATION_TIME_RESOLUTION_FAILED",
      400
    );
  }
  return instant;
}

function validateDateAndParty(
  policy: ReservationPolicy,
  date: string,
  partySize: number
) {
  if (partySize < policy.minPartySize || partySize > policy.maxPartySize) {
    throw new ReservationAvailabilityError(
      `Party size must be between ${policy.minPartySize} and ${policy.maxPartySize}`,
      "RESERVATION_PARTY_SIZE_OUT_OF_RANGE",
      400,
      {
        minimum: policy.minPartySize,
        maximum: policy.maxPartySize,
      }
    );
  }
  if (date < policy.today || date > policy.maximumDate) {
    throw new ReservationAvailabilityError(
      "Reservation date is outside the available booking horizon",
      "RESERVATION_DATE_OUT_OF_RANGE",
      400,
      { earliestDate: policy.today, latestDate: policy.maximumDate }
    );
  }
}

export async function listReservationAvailability(input: {
  date: string;
  partySize: number;
  preference?: string | null;
  client?: ReservationClient;
}): Promise<ReservationAvailabilityResult> {
  const client = input.client || db;
  const policy = await readReservationPolicy(client);
  validateDateAndParty(policy, input.date, input.partySize);

  const rows = await client.$queryRaw<AvailabilityRow[]>(Prisma.sql`
    WITH policy AS (
      SELECT
        settings."timezone",
        settings."reservationMinNoticeMinutes" AS "minNoticeMinutes",
        settings."reservationMaxAdvanceDays" AS "maxAdvanceDays",
        settings."reservationDefaultDurationMinutes" AS "durationMinutes",
        settings."reservationTurnoverMinutes" AS "turnoverMinutes",
        settings."reservationSlotIntervalMinutes" AS "slotIntervalMinutes"
      FROM "RestaurantSettings" AS settings
      WHERE settings."id" = '1'
    ),
    requested AS (
      SELECT
        ${input.date}::date AS "localDate",
        EXTRACT(DOW FROM ${input.date}::date)::integer AS "weekday",
        EXTRACT(
          DOW FROM (${input.date}::date - INTERVAL '1 day')
        )::integer AS "previousWeekday"
    ),
    service_windows AS (
      SELECT
        requested."localDate",
        requested."localDate"::timestamp +
          make_interval(mins => period."opensAtMinute") AS "localStart",
        requested."localDate"::timestamp +
          CASE
            WHEN period."closesAtMinute" > period."opensAtMinute"
              THEN INTERVAL '0 day'
            ELSE INTERVAL '1 day'
          END +
          make_interval(mins => period."closesAtMinute") AS "localEnd"
      FROM requested
      JOIN "ReservationServicePeriod" AS period
        ON period."dayOfWeek" = requested."weekday"
        AND period."isActive" = true

      UNION ALL

      SELECT
        requested."localDate",
        requested."localDate"::timestamp AS "localStart",
        requested."localDate"::timestamp +
          make_interval(mins => period."closesAtMinute") AS "localEnd"
      FROM requested
      JOIN "ReservationServicePeriod" AS period
        ON period."dayOfWeek" = requested."previousWeekday"
        AND period."isActive" = true
        AND period."closesAtMinute" < period."opensAtMinute"
        AND period."closesAtMinute" > 0
    ),
    local_slots AS (
      SELECT DISTINCT
        generated."localStart",
        policy."timezone",
        policy."minNoticeMinutes",
        policy."maxAdvanceDays",
        policy."durationMinutes",
        policy."turnoverMinutes"
      FROM service_windows
      CROSS JOIN policy
      CROSS JOIN LATERAL generate_series(
        service_windows."localStart",
        service_windows."localEnd" - make_interval(
          mins => policy."durationMinutes" + policy."turnoverMinutes"
        ),
        make_interval(mins => policy."slotIntervalMinutes")
      ) AS generated("localStart")
      WHERE generated."localStart"::date = service_windows."localDate"
    ),
    utc_slots AS (
      SELECT
        local_slots."localStart",
        local_slots."localStart" AT TIME ZONE local_slots."timezone" AS "startsAt",
        (
          local_slots."localStart" +
          make_interval(mins => local_slots."durationMinutes")
        ) AT TIME ZONE local_slots."timezone" AS "endsAt",
        (
          local_slots."localStart" + make_interval(
            mins => local_slots."durationMinutes" +
              local_slots."turnoverMinutes"
          )
        ) AT TIME ZONE local_slots."timezone" AS "releaseAt",
        local_slots."minNoticeMinutes",
        local_slots."maxAdvanceDays"
      FROM local_slots
    ),
    bookable_slots AS (
      SELECT *
      FROM utc_slots
      WHERE "startsAt" >= CURRENT_TIMESTAMP +
        make_interval(mins => "minNoticeMinutes")
        AND "startsAt" <= CURRENT_TIMESTAMP +
          make_interval(days => "maxAdvanceDays")
        AND NOT EXISTS (
          SELECT 1
          FROM "ReservationClosure" AS closure
          WHERE tstzrange(closure."startsAt", closure."endsAt", '[)') &&
            tstzrange(utc_slots."startsAt", utc_slots."releaseAt", '[)')
        )
    )
    SELECT
      to_char(bookable_slots."localStart", 'YYYY-MM-DD') AS "date",
      to_char(bookable_slots."localStart", 'HH24:MI') AS "time",
      bookable_slots."startsAt",
      bookable_slots."endsAt",
      bookable_slots."releaseAt",
      capacity."availableTableCount",
      capacity."bestCapacity"
    FROM bookable_slots
    JOIN LATERAL (
      SELECT
        COUNT(*)::integer AS "availableTableCount",
        MIN(restaurant_table."capacity")::integer AS "bestCapacity"
      FROM "RestaurantTable" AS restaurant_table
      WHERE restaurant_table."capacity" >= ${input.partySize}
        AND NOT EXISTS (
          SELECT 1
          FROM "Reservation" AS reservation
          WHERE reservation."tableId" = restaurant_table."id"
            AND reservation."status" IN ('confirmed', 'seated')
            AND reservation."dateTime" < bookable_slots."releaseAt"
            AND reservation."releaseAt" > bookable_slots."startsAt"
        )
    ) AS capacity ON capacity."availableTableCount" > 0
    ORDER BY bookable_slots."startsAt" ASC
  `);

  return {
    date: input.date,
    partySize: input.partySize,
    timezone: policy.timezone,
    policy: {
      minNoticeMinutes: policy.minNoticeMinutes,
      maxAdvanceDays: policy.maxAdvanceDays,
      defaultDurationMinutes: policy.defaultDurationMinutes,
      turnoverMinutes: policy.turnoverMinutes,
      slotIntervalMinutes: policy.slotIntervalMinutes,
      minPartySize: policy.minPartySize,
      maxPartySize: policy.maxPartySize,
      customerCancelCutoffMinutes: policy.customerCancelCutoffMinutes,
      earliestDate: policy.today,
      latestDate: policy.maximumDate,
    },
    slots: rows,
  };
}

async function advisoryLock(
  client: Prisma.TransactionClient,
  namespace: string,
  value: string
) {
  await client.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
    WITH reservation_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${namespace}:${value}`}, 0)
      )
    )
    SELECT 1::integer AS "locked" FROM reservation_lock
  `);
}

function sameNullable(left: string | null | undefined, right: string | null) {
  return normalizedOptional(left, 2_000) === (right || null);
}

export async function createReservationBooking(
  tx: Prisma.TransactionClient,
  input: ReservationBookingInput
) {
  const key = clean(input.idempotencyKey, 191);
  if (!key) {
    throw new ReservationAvailabilityError(
      "An idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }

  const requestedStart = await restaurantLocalDateTimeToUtc(
    tx,
    input.date,
    input.time
  );
  await advisoryLock(tx, "reservation-idempotency", key);

  const replay = await tx.reservation.findUnique({
    where: { idempotencyKey: key },
    include: { table: true },
  });
  if (replay) {
    const matches =
      replay.customerName === clean(input.customerName, 160) &&
      replay.customerPhone === clean(input.customerPhone, 40) &&
      (replay.customerEmail || null) ===
        normalizedOptional(input.customerEmail, 254) &&
      replay.partySize === input.partySize &&
      replay.dateTime.getTime() === requestedStart.getTime() &&
      sameNullable(input.occasion, replay.occasion) &&
      sameNullable(input.preference, replay.preference) &&
      sameNullable(input.notes, replay.notes);
    if (!matches) {
      throw new ReservationAvailabilityError(
        "The reservation idempotency key was used for another booking payload",
        "RESERVATION_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return { reservation: replay, replayed: true };
  }

  const availability = await listReservationAvailability({
    date: input.date,
    partySize: input.partySize,
    preference: input.preference,
    client: tx,
  });
  const slot = availability.slots.find((entry) => entry.time === input.time);
  if (!slot) {
    throw new ReservationAvailabilityError(
      "The selected reservation time is no longer available",
      "RESERVATION_SLOT_UNAVAILABLE",
      409
    );
  }

  const normalizedPhone = clean(input.customerPhone, 40);
  await advisoryLock(tx, "reservation-phone", normalizedPhone);

  const candidateTables = await tx.$queryRaw<CandidateTable[]>(Prisma.sql`
    SELECT
      restaurant_table."id",
      restaurant_table."number",
      restaurant_table."capacity",
      restaurant_table."section",
      restaurant_table."status"::text AS "status"
    FROM "RestaurantTable" AS restaurant_table
    WHERE restaurant_table."capacity" >= ${input.partySize}
    ORDER BY
      CASE
        WHEN ${clean(input.preference, 80)} = 'outdoor'
          AND restaurant_table."section" = 'patio' THEN 0
        WHEN ${clean(input.preference, 80)} = 'bar'
          AND restaurant_table."section" = 'bar' THEN 0
        WHEN ${clean(input.preference, 80)} = 'private'
          AND restaurant_table."section" = 'private' THEN 0
        WHEN ${clean(input.preference, 80)} = 'indoor'
          AND restaurant_table."section" NOT IN ('patio', 'bar') THEN 0
        ELSE 1
      END,
      restaurant_table."capacity" ASC,
      restaurant_table."number" ASC
    FOR UPDATE
  `);
  if (!candidateTables.length) {
    throw new ReservationAvailabilityError(
      "No configured table can accommodate this party",
      "NO_COMPATIBLE_TABLE",
      409
    );
  }

  const candidateIds = candidateTables.map((table) => table.id);
  const occupied = await tx.$queryRaw<Array<{ tableId: string }>>(Prisma.sql`
    SELECT DISTINCT reservation."tableId" AS "tableId"
    FROM "Reservation" AS reservation
    WHERE reservation."tableId" IN (${Prisma.join(candidateIds)})
      AND reservation."status" IN ('confirmed', 'seated')
      AND reservation."dateTime" < ${slot.releaseAt}
      AND reservation."releaseAt" > ${slot.startsAt}
  `);
  const occupiedIds = new Set(occupied.map((entry) => entry.tableId));
  const selectedTable = candidateTables.find(
    (table) => !occupiedIds.has(table.id)
  );
  if (!selectedTable) {
    throw new ReservationAvailabilityError(
      "The selected reservation time is no longer available",
      "RESERVATION_SLOT_UNAVAILABLE",
      409
    );
  }

  const duplicate = await tx.reservation.findFirst({
    where: {
      customerPhone: normalizedPhone,
      status: { in: ["confirmed", "seated"] },
      dateTime: { lt: slot.releaseAt },
      releaseAt: { gt: slot.startsAt },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ReservationAvailabilityError(
      "An active reservation already exists for this phone during that time",
      "DUPLICATE_RESERVATION",
      409
    );
  }

  const customerName = clean(input.customerName, 160);
  const customerEmail = normalizedOptional(input.customerEmail, 254);
  const customer = await tx.customer.upsert({
    where: { phone: normalizedPhone },
    update: {
      name: customerName,
      ...(customerEmail ? { email: customerEmail } : {}),
    },
    create: {
      name: customerName,
      phone: normalizedPhone,
      email: customerEmail,
    },
    select: { id: true },
  });

  const reservation = await tx.reservation.create({
    data: {
      idempotencyKey: key,
      customerName,
      customerPhone: normalizedPhone,
      customerEmail,
      partySize: input.partySize,
      tableId: selectedTable.id,
      customerId: customer.id,
      dateTime: slot.startsAt,
      durationMinutes: availability.policy.defaultDurationMinutes,
      turnoverMinutes: availability.policy.turnoverMinutes,
      endsAt: slot.endsAt,
      releaseAt: slot.releaseAt,
      source: input.source,
      status: "confirmed",
      occasion: normalizedOptional(input.occasion, 80),
      preference: normalizedOptional(input.preference, 80),
      notes: normalizedOptional(input.notes, 2_000),
    },
    include: { table: true },
  });
  return { reservation, replayed: false };
}

export async function lockReservation(
  tx: Prisma.TransactionClient,
  id: string
): Promise<LockedReservation | null> {
  const rows = await tx.$queryRaw<LockedReservation[]>(Prisma.sql`
    SELECT
      reservation."id",
      reservation."customerName",
      reservation."customerPhone",
      reservation."customerEmail",
      reservation."partySize",
      reservation."tableId",
      reservation."dateTime",
      reservation."durationMinutes",
      reservation."turnoverMinutes",
      reservation."endsAt",
      reservation."releaseAt",
      reservation."status"::text AS "status",
      reservation."occasion",
      reservation."preference",
      reservation."notes",
      reservation."source"::text AS "source",
      reservation."seatedAt",
      reservation."completedAt",
      reservation."cancelledAt",
      reservation."noShowAt"
    FROM "Reservation" AS reservation
    WHERE reservation."id" = ${id}
    FOR UPDATE
  `);
  return rows[0] || null;
}

export async function assertReservationTableAvailable(
  tx: Prisma.TransactionClient,
  input: {
    tableId: string;
    reservationId: string;
    partySize: number;
    startsAt: Date;
    releaseAt: Date;
  }
): Promise<CandidateTable> {
  const rows = await tx.$queryRaw<CandidateTable[]>(Prisma.sql`
    SELECT
      restaurant_table."id",
      restaurant_table."number",
      restaurant_table."capacity",
      restaurant_table."section",
      restaurant_table."status"::text AS "status"
    FROM "RestaurantTable" AS restaurant_table
    WHERE restaurant_table."id" = ${input.tableId}
    FOR UPDATE
  `);
  const table = rows[0];
  if (!table || table.capacity < input.partySize) {
    throw new ReservationAvailabilityError(
      "The selected table cannot accommodate this reservation",
      "INVALID_TABLE_ASSIGNMENT",
      409
    );
  }

  const conflicts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT reservation."id"
    FROM "Reservation" AS reservation
    WHERE reservation."tableId" = ${input.tableId}
      AND reservation."id" <> ${input.reservationId}
      AND reservation."status" IN ('confirmed', 'seated')
      AND reservation."dateTime" < ${input.releaseAt}
      AND reservation."releaseAt" > ${input.startsAt}
    LIMIT 1
  `);
  if (conflicts[0]) {
    throw new ReservationAvailabilityError(
      "The selected table is already reserved during this time",
      "RESERVATION_TABLE_CONFLICT",
      409
    );
  }
  return table;
}

export function customerCancellationAllowed(
  reservation: LockedReservation,
  policy: ReservationPolicy,
  now = new Date()
): boolean {
  return (
    reservation.status === "confirmed" &&
    reservation.dateTime.getTime() - now.getTime() >=
      policy.customerCancelCutoffMinutes * 60_000
  );
}

export function reservationErrorFromDatabase(
  error: unknown
): ReservationAvailabilityError | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new ReservationAvailabilityError(
      "The idempotency key is already in use",
      "RESERVATION_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Reservation_active_table_no_overlap") ||
    message.includes("23P01") ||
    message.toLowerCase().includes("exclusion constraint")
  ) {
    return new ReservationAvailabilityError(
      "The selected table is already reserved during this time",
      "RESERVATION_TABLE_CONFLICT",
      409
    );
  }
  return null;
}
