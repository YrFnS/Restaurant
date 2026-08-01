import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { StaffSession } from "@/lib/auth/session";
import {
  writeAuditEvent,
  type AuditRequestContext,
} from "@/lib/audit";

export type WaitlistActor = Pick<StaffSession, "id" | "name" | "role"> &
  Partial<Pick<StaffSession, "sessionId">>;

export interface WaitlistPolicy {
  timezone: string;
  enabled: boolean;
  isOpenNow: boolean;
  minPartySize: number;
  maxPartySize: number;
  averageTurnoverMinutes: number;
  notificationExpiryMinutes: number;
  estimatePaddingMinutes: number;
  maxQuoteMinutes: number;
  requireConfirmation: boolean;
  now: Date;
}

export interface WaitlistEntryRow {
  id: string;
  idempotencyKey: string | null;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  estimatedWait: number;
  notes: string | null;
  customerId: string | null;
  source: "customer" | "staff" | "import";
  preference: string | null;
  tableId: string | null;
  tableNumber: number | null;
  tableCapacity: number | null;
  tableSection: string | null;
  estimatedSeatAt: Date | null;
  estimateCalculatedAt: Date | null;
  seatedAt: Date | null;
  notifiedAt: Date | null;
  notificationExpiresAt: Date | null;
  notificationConfirmedAt: Date | null;
  cancelledAt: Date | null;
  noShowAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type WaitlistClient = Prisma.TransactionClient;

type TableRow = {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: string;
  seatedAt: Date | null;
};

type ReservationBlockRow = {
  tableId: string;
  startsAt: Date;
  releaseAt: Date;
};

type TimeBlock = {
  startsAt: Date;
  endsAt: Date;
};

export class WaitlistOperationsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "WaitlistOperationsError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function clean(value: string | null | undefined, maximum: number): string {
  return (value || "").trim().slice(0, maximum);
}

function optional(value: string | null | undefined, maximum: number): string | null {
  const result = clean(value, maximum);
  return result || null;
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.ceil((later.getTime() - earlier.getTime()) / 60_000));
}

function sameOptional(left: string | null | undefined, right: string | null, maximum: number) {
  return optional(left, maximum) === (right || null);
}

async function advisoryLock(
  tx: WaitlistClient,
  namespace: string,
  value: string
): Promise<void> {
  await tx.$queryRaw<Array<{ locked: number }>>(Prisma.sql`
    WITH waitlist_lock AS (
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${namespace}:${value}`}, 0)
      )
    )
    SELECT 1::integer AS "locked" FROM waitlist_lock
  `);
}

export async function readWaitlistPolicy(
  tx: WaitlistClient
): Promise<WaitlistPolicy> {
  const rows = await tx.$queryRaw<WaitlistPolicy[]>(Prisma.sql`
    WITH policy AS (
      SELECT
        settings."timezone",
        settings."waitlistEnabled" AS "enabled",
        settings."reservationMinPartySize" AS "minPartySize",
        settings."reservationMaxPartySize" AS "maxPartySize",
        settings."waitlistAverageTurnoverMinutes" AS "averageTurnoverMinutes",
        settings."waitlistNotificationExpiryMinutes" AS "notificationExpiryMinutes",
        settings."waitlistEstimatePaddingMinutes" AS "estimatePaddingMinutes",
        settings."waitlistMaxQuoteMinutes" AS "maxQuoteMinutes",
        settings."waitlistRequireConfirmation" AS "requireConfirmation",
        CURRENT_TIMESTAMP AS "now",
        EXTRACT(
          DOW FROM CURRENT_TIMESTAMP AT TIME ZONE settings."timezone"
        )::integer AS "weekday",
        EXTRACT(
          DOW FROM (
            CURRENT_TIMESTAMP AT TIME ZONE settings."timezone" - INTERVAL '1 day'
          )
        )::integer AS "previousWeekday",
        (
          EXTRACT(
            HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE settings."timezone"
          )::integer * 60 +
          EXTRACT(
            MINUTE FROM CURRENT_TIMESTAMP AT TIME ZONE settings."timezone"
          )::integer
        ) AS "localMinute"
      FROM "RestaurantSettings" AS settings
      WHERE settings."id" = '1'
    )
    SELECT
      policy."timezone",
      policy."enabled",
      policy."minPartySize",
      policy."maxPartySize",
      policy."averageTurnoverMinutes",
      policy."notificationExpiryMinutes",
      policy."estimatePaddingMinutes",
      policy."maxQuoteMinutes",
      policy."requireConfirmation",
      policy."now",
      (
        policy."enabled"
        AND EXISTS (
          SELECT 1
          FROM "ReservationServicePeriod" AS period
          WHERE period."isActive" = true
            AND (
              (
                period."dayOfWeek" = policy."weekday"
                AND period."closesAtMinute" > period."opensAtMinute"
                AND policy."localMinute" >= period."opensAtMinute"
                AND policy."localMinute" < period."closesAtMinute"
              )
              OR (
                period."dayOfWeek" = policy."weekday"
                AND period."closesAtMinute" < period."opensAtMinute"
                AND policy."localMinute" >= period."opensAtMinute"
              )
              OR (
                period."dayOfWeek" = policy."previousWeekday"
                AND period."closesAtMinute" < period."opensAtMinute"
                AND policy."localMinute" < period."closesAtMinute"
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "ReservationClosure" AS closure
          WHERE closure."startsAt" <= policy."now"
            AND closure."endsAt" > policy."now"
        )
      ) AS "isOpenNow"
    FROM policy
  `);

  const policy = rows[0];
  if (!policy) {
    throw new WaitlistOperationsError(
      "Waitlist settings are missing",
      "WAITLIST_SETTINGS_MISSING",
      503
    );
  }
  return policy;
}

const ENTRY_SELECT = Prisma.sql`
  entry."id",
  entry."idempotencyKey",
  entry."customerName",
  entry."customerPhone",
  entry."partySize",
  entry."status"::text AS "status",
  entry."estimatedWait",
  entry."notes",
  entry."customerId",
  entry."source"::text AS "source",
  entry."preference",
  entry."tableId",
  restaurant_table."number" AS "tableNumber",
  restaurant_table."capacity" AS "tableCapacity",
  restaurant_table."section" AS "tableSection",
  entry."estimatedSeatAt",
  entry."estimateCalculatedAt",
  entry."seatedAt",
  entry."notifiedAt",
  entry."notificationExpiresAt",
  entry."notificationConfirmedAt",
  entry."cancelledAt",
  entry."noShowAt",
  entry."createdAt",
  entry."updatedAt"
`;

export async function readWaitlistEntry(
  tx: WaitlistClient,
  id: string,
  lock = false
): Promise<WaitlistEntryRow | null> {
  const lockSql = lock ? Prisma.sql`FOR UPDATE OF entry` : Prisma.empty;
  const rows = await tx.$queryRaw<WaitlistEntryRow[]>(Prisma.sql`
    SELECT ${ENTRY_SELECT}
    FROM "WaitlistEntry" AS entry
    LEFT JOIN "RestaurantTable" AS restaurant_table
      ON restaurant_table."id" = entry."tableId"
    WHERE entry."id" = ${id}
    LIMIT 1
    ${lockSql}
  `);
  return rows[0] || null;
}

async function readWaitlistEntryByKey(
  tx: WaitlistClient,
  key: string
): Promise<WaitlistEntryRow | null> {
  const rows = await tx.$queryRaw<WaitlistEntryRow[]>(Prisma.sql`
    SELECT ${ENTRY_SELECT}
    FROM "WaitlistEntry" AS entry
    LEFT JOIN "RestaurantTable" AS restaurant_table
      ON restaurant_table."id" = entry."tableId"
    WHERE entry."idempotencyKey" = ${key}
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function listWaitlistEntries(
  tx: WaitlistClient,
  options: { activeOnly?: boolean; limit?: number } = {}
): Promise<WaitlistEntryRow[]> {
  const activeOnly = options.activeOnly ?? false;
  const limit = Math.max(1, Math.min(options.limit || 200, 500));
  return tx.$queryRaw<WaitlistEntryRow[]>(Prisma.sql`
    SELECT ${ENTRY_SELECT}
    FROM "WaitlistEntry" AS entry
    LEFT JOIN "RestaurantTable" AS restaurant_table
      ON restaurant_table."id" = entry."tableId"
    WHERE (${activeOnly} = false OR entry."status" IN ('waiting', 'notified'))
    ORDER BY
      CASE WHEN entry."status" = 'notified' THEN 0
           WHEN entry."status" = 'waiting' THEN 1
           ELSE 2 END,
      entry."estimatedSeatAt" ASC NULLS LAST,
      entry."createdAt" ASC,
      entry."id" ASC
    LIMIT ${limit}
  `);
}

export function serializeWaitlistForCustomer(entry: WaitlistEntryRow) {
  return {
    id: entry.id,
    customerName: entry.customerName,
    partySize: entry.partySize,
    status: entry.status,
    estimatedWait: entry.estimatedWait,
    estimatedSeatAt: entry.estimatedSeatAt,
    estimateCalculatedAt: entry.estimateCalculatedAt,
    preference: entry.preference,
    table:
      entry.tableNumber === null
        ? null
        : {
            number: entry.tableNumber,
            capacity: entry.tableCapacity,
            section: entry.tableSection,
          },
    notifiedAt: entry.notifiedAt,
    notificationExpiresAt: entry.notificationExpiresAt,
    notificationConfirmedAt: entry.notificationConfirmedAt,
    seatedAt: entry.seatedAt,
    cancelledAt: entry.cancelledAt,
    noShowAt: entry.noShowAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function serializeWaitlistForStaff(entry: WaitlistEntryRow) {
  return {
    ...serializeWaitlistForCustomer(entry),
    customerPhone: entry.customerPhone,
    customerId: entry.customerId,
    source: entry.source,
    notes: entry.notes,
    tableId: entry.tableId,
  };
}

export function safeWaitlistPolicy(policy: WaitlistPolicy) {
  return {
    enabled: policy.enabled,
    isOpenNow: policy.isOpenNow,
    timezone: policy.timezone,
    minPartySize: policy.minPartySize,
    maxPartySize: policy.maxPartySize,
    averageTurnoverMinutes: policy.averageTurnoverMinutes,
    notificationExpiryMinutes: policy.notificationExpiryMinutes,
    estimatePaddingMinutes: policy.estimatePaddingMinutes,
    maxQuoteMinutes: policy.maxQuoteMinutes,
    requireConfirmation: policy.requireConfirmation,
  };
}

async function releaseHeldTable(
  tx: WaitlistClient,
  tableId: string | null
): Promise<void> {
  if (!tableId) return;
  await tx.$executeRaw(Prisma.sql`
    UPDATE "RestaurantTable" AS restaurant_table
    SET
      "status" = 'open'::"TableStatus",
      "seatedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE restaurant_table."id" = ${tableId}
      AND restaurant_table."status" = 'reserved'
      AND NOT EXISTS (
        SELECT 1
        FROM "WaitlistEntry" AS active_hold
        WHERE active_hold."tableId" = restaurant_table."id"
          AND active_hold."status" = 'notified'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "Reservation" AS reservation
        WHERE reservation."tableId" = restaurant_table."id"
          AND reservation."status" IN ('confirmed', 'seated')
          AND reservation."dateTime" <= CURRENT_TIMESTAMP
          AND reservation."releaseAt" > CURRENT_TIMESTAMP
      )
  `);
}

export async function expireStaleNotifications(
  tx: WaitlistClient,
  context?: AuditRequestContext
): Promise<WaitlistEntryRow[]> {
  const stale = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT entry."id"
    FROM "WaitlistEntry" AS entry
    WHERE entry."status" = 'notified'
      AND entry."notificationExpiresAt" IS NOT NULL
      AND entry."notificationExpiresAt" <= CURRENT_TIMESTAMP
    ORDER BY entry."notificationExpiresAt" ASC
    FOR UPDATE
  `);

  const expired: WaitlistEntryRow[] = [];
  for (const row of stale) {
    const existing = await readWaitlistEntry(tx, row.id, true);
    if (!existing || existing.status !== "notified") continue;

    await tx.$executeRaw(Prisma.sql`
      UPDATE "WaitlistEntry"
      SET
        "status" = 'no_show'::"WaitlistStatus",
        "noShowAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${existing.id}
        AND "status" = 'notified'
    `);
    await releaseHeldTable(tx, existing.tableId);
    await writeAuditEvent(tx, {
      actor: null,
      action: "waitlist.notification.expire",
      entityType: "WaitlistEntry",
      entityId: existing.id,
      context,
      metadata: {
        tableId: existing.tableId,
        notifiedAt: existing.notifiedAt,
        notificationExpiresAt: existing.notificationExpiresAt,
      },
    });
    const updated = await readWaitlistEntry(tx, existing.id);
    if (updated) expired.push(updated);
  }
  return expired;
}

function addBlock(map: Map<string, TimeBlock[]>, tableId: string, block: TimeBlock) {
  if (block.endsAt <= block.startsAt) return;
  const blocks = map.get(tableId) || [];
  blocks.push(block);
  map.set(tableId, blocks);
}

function earliestGap(
  blocks: TimeBlock[],
  now: Date,
  durationMinutes: number
): Date {
  const durationMs = durationMinutes * 60_000;
  let cursor = new Date(now);
  const ordered = [...blocks].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime()
  );
  for (const block of ordered) {
    if (block.endsAt.getTime() <= cursor.getTime()) continue;
    if (cursor.getTime() + durationMs <= block.startsAt.getTime()) return cursor;
    if (block.startsAt.getTime() < cursor.getTime() + durationMs) {
      cursor = new Date(Math.max(cursor.getTime(), block.endsAt.getTime()));
    }
  }
  return cursor;
}

function preferenceRank(entry: WaitlistEntryRow, table: TableRow): number {
  const preference = (entry.preference || "").toLowerCase();
  if (!preference || preference === "any") return 0;
  if (preference === "outdoor" && table.section === "patio") return 0;
  if (preference === "bar" && table.section === "bar") return 0;
  if (preference === "private" && table.section === "private") return 0;
  if (
    preference === "indoor" &&
    !["patio", "bar"].includes(table.section)
  ) {
    return 0;
  }
  return 1;
}

async function loadTableSchedules(
  tx: WaitlistClient,
  policy: WaitlistPolicy,
  activeEntries: WaitlistEntryRow[]
) {
  const tables = await tx.$queryRaw<TableRow[]>(Prisma.sql`
    SELECT
      restaurant_table."id",
      restaurant_table."number",
      restaurant_table."capacity",
      restaurant_table."section",
      restaurant_table."status"::text AS "status",
      restaurant_table."seatedAt"
    FROM "RestaurantTable" AS restaurant_table
    ORDER BY restaurant_table."capacity" ASC, restaurant_table."number" ASC
  `);
  const schedules = new Map<string, TimeBlock[]>();
  const heldTableIds = new Set(
    activeEntries
      .filter((entry) => entry.status === "notified" && entry.tableId)
      .map((entry) => entry.tableId as string)
  );

  for (const table of tables) {
    if (["seated", "ordered", "served"].includes(table.status)) {
      const expectedEnd = table.seatedAt
        ? addMinutes(table.seatedAt, policy.averageTurnoverMinutes)
        : addMinutes(policy.now, policy.averageTurnoverMinutes);
      addBlock(schedules, table.id, {
        startsAt: policy.now,
        endsAt:
          expectedEnd > policy.now
            ? expectedEnd
            : addMinutes(policy.now, Math.max(5, policy.estimatePaddingMinutes)),
      });
    } else if (["paid", "cleaning"].includes(table.status)) {
      addBlock(schedules, table.id, {
        startsAt: policy.now,
        endsAt: addMinutes(policy.now, Math.max(5, policy.estimatePaddingMinutes)),
      });
    } else if (table.status === "reserved" && !heldTableIds.has(table.id)) {
      addBlock(schedules, table.id, {
        startsAt: policy.now,
        endsAt: addMinutes(policy.now, policy.notificationExpiryMinutes),
      });
    }
  }

  const reservations = await tx.$queryRaw<ReservationBlockRow[]>(Prisma.sql`
    SELECT
      reservation."tableId" AS "tableId",
      reservation."dateTime" AS "startsAt",
      reservation."releaseAt"
    FROM "Reservation" AS reservation
    WHERE reservation."tableId" IS NOT NULL
      AND reservation."status" IN ('confirmed', 'seated')
      AND reservation."releaseAt" > CURRENT_TIMESTAMP
    ORDER BY reservation."dateTime" ASC
  `);
  for (const reservation of reservations) {
    addBlock(schedules, reservation.tableId, {
      startsAt: reservation.startsAt,
      endsAt: reservation.releaseAt,
    });
  }

  for (const entry of activeEntries) {
    if (entry.status !== "notified" || !entry.tableId) continue;
    const holdUntil = entry.notificationExpiresAt ||
      addMinutes(policy.now, policy.notificationExpiryMinutes);
    addBlock(schedules, entry.tableId, {
      startsAt: policy.now,
      endsAt: addMinutes(
        holdUntil > policy.now ? holdUntil : policy.now,
        policy.averageTurnoverMinutes
      ),
    });
  }

  return { tables, schedules };
}

export async function recalculateWaitlistEstimates(
  tx: WaitlistClient
): Promise<WaitlistEntryRow[]> {
  const policy = await readWaitlistPolicy(tx);
  const activeEntries = await listWaitlistEntries(tx, {
    activeOnly: true,
    limit: 500,
  });
  const { tables, schedules } = await loadTableSchedules(
    tx,
    policy,
    activeEntries
  );

  const waiting = activeEntries
    .filter((entry) => entry.status === "waiting")
    .sort((left, right) => {
      const byCreated = left.createdAt.getTime() - right.createdAt.getTime();
      return byCreated || left.id.localeCompare(right.id);
    });

  for (const entry of waiting) {
    const candidates = tables.filter((table) => table.capacity >= entry.partySize);
    let selected:
      | { table: TableRow; startsAt: Date; preferenceRank: number }
      | null = null;

    for (const table of candidates) {
      const startsAt = earliestGap(
        schedules.get(table.id) || [],
        policy.now,
        policy.averageTurnoverMinutes
      );
      const candidate = {
        table,
        startsAt,
        preferenceRank: preferenceRank(entry, table),
      };
      if (
        !selected ||
        candidate.startsAt < selected.startsAt ||
        (candidate.startsAt.getTime() === selected.startsAt.getTime() &&
          candidate.preferenceRank < selected.preferenceRank) ||
        (candidate.startsAt.getTime() === selected.startsAt.getTime() &&
          candidate.preferenceRank === selected.preferenceRank &&
          candidate.table.capacity < selected.table.capacity) ||
        (candidate.startsAt.getTime() === selected.startsAt.getTime() &&
          candidate.preferenceRank === selected.preferenceRank &&
          candidate.table.capacity === selected.table.capacity &&
          candidate.table.number < selected.table.number)
      ) {
        selected = candidate;
      }
    }

    const startsAt = selected?.startsAt ||
      addMinutes(policy.now, policy.maxQuoteMinutes);
    const quotedMinutes = Math.min(
      policy.maxQuoteMinutes,
      minutesBetween(startsAt, policy.now) + policy.estimatePaddingMinutes
    );
    const estimatedSeatAt = addMinutes(policy.now, quotedMinutes);

    await tx.$executeRaw(Prisma.sql`
      UPDATE "WaitlistEntry"
      SET
        "estimatedWait" = ${quotedMinutes},
        "estimatedSeatAt" = ${estimatedSeatAt},
        "estimateCalculatedAt" = ${policy.now}
      WHERE "id" = ${entry.id}
        AND "status" = 'waiting'
    `);

    if (selected) {
      addBlock(schedules, selected.table.id, {
        startsAt: selected.startsAt,
        endsAt: addMinutes(
          selected.startsAt,
          policy.averageTurnoverMinutes
        ),
      });
    }
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "WaitlistEntry"
    SET
      "estimatedWait" = 0,
      "estimatedSeatAt" = CURRENT_TIMESTAMP,
      "estimateCalculatedAt" = CURRENT_TIMESTAMP
    WHERE "status" = 'notified'
  `);

  return listWaitlistEntries(tx, { activeOnly: true, limit: 500 });
}

export function waitlistPosition(
  activeEntries: WaitlistEntryRow[],
  entryId: string
): number {
  const ordered = [...activeEntries].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "notified") return -1;
      if (right.status === "notified") return 1;
    }
    const leftEstimate = left.estimatedSeatAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightEstimate = right.estimatedSeatAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return (
      leftEstimate - rightEstimate ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id)
    );
  });
  const index = ordered.findIndex((entry) => entry.id === entryId);
  return index < 0 ? 0 : index + 1;
}

export async function refreshWaitlist(
  tx: WaitlistClient,
  context?: AuditRequestContext
) {
  await advisoryLock(tx, "waitlist", "queue");
  const expired = await expireStaleNotifications(tx, context);
  const active = await recalculateWaitlistEstimates(tx);
  return { expired, active };
}

export async function createWaitlistEntry(
  tx: WaitlistClient,
  input: {
    idempotencyKey: string;
    customerName: string;
    customerPhone: string;
    partySize: number;
    preference?: string | null;
    notes?: string | null;
    source: "customer" | "staff" | "import";
    actor?: WaitlistActor | null;
    context?: AuditRequestContext;
  }
): Promise<{ entry: WaitlistEntryRow; active: WaitlistEntryRow[]; replayed: boolean }> {
  const key = clean(input.idempotencyKey, 191);
  if (!key) {
    throw new WaitlistOperationsError(
      "An idempotency key is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }

  const customerName = clean(input.customerName, 160);
  const customerPhone = clean(input.customerPhone, 40);
  const preference = optional(input.preference, 80);
  const notes = optional(input.notes, 2_000);
  if (!customerName || customerPhone.length < 5) {
    throw new WaitlistOperationsError(
      "A customer name and phone number are required",
      "INVALID_WAITLIST_CUSTOMER",
      400
    );
  }

  await advisoryLock(tx, "waitlist", "queue");
  await advisoryLock(tx, "waitlist-idempotency", key);
  await advisoryLock(tx, "waitlist-phone", customerPhone);
  await expireStaleNotifications(tx, input.context);

  const replay = await readWaitlistEntryByKey(tx, key);
  if (replay) {
    const matches =
      replay.customerName === customerName &&
      replay.customerPhone === customerPhone &&
      replay.partySize === input.partySize &&
      replay.source === input.source &&
      sameOptional(input.preference, replay.preference, 80) &&
      sameOptional(input.notes, replay.notes, 2_000);
    if (!matches) {
      throw new WaitlistOperationsError(
        "The waitlist idempotency key was used for another payload",
        "WAITLIST_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    const active = await recalculateWaitlistEstimates(tx);
    return {
      entry: (await readWaitlistEntry(tx, replay.id)) || replay,
      active,
      replayed: true,
    };
  }

  const policy = await readWaitlistPolicy(tx);
  if (!policy.enabled) {
    throw new WaitlistOperationsError(
      "The waitlist is currently disabled",
      "WAITLIST_DISABLED",
      409
    );
  }
  if (!policy.isOpenNow) {
    throw new WaitlistOperationsError(
      "The waitlist is available only during restaurant service",
      "WAITLIST_CLOSED",
      409
    );
  }
  if (
    input.partySize < policy.minPartySize ||
    input.partySize > policy.maxPartySize
  ) {
    throw new WaitlistOperationsError(
      `Party size must be between ${policy.minPartySize} and ${policy.maxPartySize}`,
      "WAITLIST_PARTY_SIZE_OUT_OF_RANGE",
      400,
      { minimum: policy.minPartySize, maximum: policy.maxPartySize }
    );
  }



  const duplicates = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "WaitlistEntry"
    WHERE "customerPhone" = ${customerPhone}
      AND "status" IN ('waiting', 'notified')
    LIMIT 1
    FOR UPDATE
  `);
  if (duplicates[0]) {
    throw new WaitlistOperationsError(
      "This phone number is already on the active waitlist",
      "DUPLICATE_WAITLIST_ENTRY",
      409
    );
  }

  const customer = await tx.customer.upsert({
    where: { phone: customerPhone },
    update: { name: customerName },
    create: { name: customerName, phone: customerPhone },
    select: { id: true },
  });
  const id = newId("waitlist");
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "WaitlistEntry" (
      "id", "idempotencyKey", "customerName", "customerPhone",
      "partySize", "status", "estimatedWait", "notes", "customerId",
      "source", "preference", "estimatedSeatAt", "estimateCalculatedAt"
    ) VALUES (
      ${id}, ${key}, ${customerName}, ${customerPhone},
      ${input.partySize}, 'waiting'::"WaitlistStatus", 0, ${notes},
      ${customer.id}, CAST(${input.source} AS "ReservationSource"),
      ${preference}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
  await writeAuditEvent(tx, {
    actor: input.actor || null,
    action: "waitlist.join",
    entityType: "WaitlistEntry",
    entityId: id,
    context: input.context,
    metadata: {
      source: input.source,
      partySize: input.partySize,
      preference,
    },
  });

  const active = await recalculateWaitlistEstimates(tx);
  const entry = await readWaitlistEntry(tx, id);
  if (!entry) {
    throw new WaitlistOperationsError(
      "Unable to load the created waitlist entry",
      "WAITLIST_RESULT_MISSING",
      500
    );
  }
  return { entry, active, replayed: false };
}

function availableNow(
  table: TableRow,
  reservations: ReservationBlockRow[],
  policy: WaitlistPolicy
): boolean {
  if (table.status !== "open") return false;
  const plannedRelease = addMinutes(policy.now, policy.averageTurnoverMinutes);
  return !reservations.some(
    (reservation) =>
      reservation.tableId === table.id &&
      reservation.startsAt < plannedRelease &&
      reservation.releaseAt > policy.now
  );
}

export async function notifyWaitlistEntry(
  tx: WaitlistClient,
  input: {
    id: string;
    actor: WaitlistActor;
    context?: AuditRequestContext;
  }
): Promise<{ entry: WaitlistEntryRow; active: WaitlistEntryRow[] }> {
  await advisoryLock(tx, "waitlist", "queue");
  await expireStaleNotifications(tx, input.context);
  const policy = await readWaitlistPolicy(tx);
  await recalculateWaitlistEstimates(tx);

  const target = await readWaitlistEntry(tx, input.id, true);
  if (!target) {
    throw new WaitlistOperationsError(
      "Waitlist entry not found",
      "WAITLIST_ENTRY_NOT_FOUND",
      404
    );
  }
  if (target.status !== "waiting") {
    throw new WaitlistOperationsError(
      "Only a waiting entry can be notified",
      "WAITLIST_NOTIFY_DENIED",
      409
    );
  }

  const tables = await tx.$queryRaw<TableRow[]>(Prisma.sql`
    SELECT
      restaurant_table."id",
      restaurant_table."number",
      restaurant_table."capacity",
      restaurant_table."section",
      restaurant_table."status"::text AS "status",
      restaurant_table."seatedAt"
    FROM "RestaurantTable" AS restaurant_table
    WHERE restaurant_table."status" = 'open'
    ORDER BY restaurant_table."capacity" ASC, restaurant_table."number" ASC
    FOR UPDATE
  `);
  const reservations = await tx.$queryRaw<ReservationBlockRow[]>(Prisma.sql`
    SELECT
      reservation."tableId" AS "tableId",
      reservation."dateTime" AS "startsAt",
      reservation."releaseAt"
    FROM "Reservation" AS reservation
    WHERE reservation."tableId" IS NOT NULL
      AND reservation."status" IN ('confirmed', 'seated')
      AND reservation."releaseAt" > CURRENT_TIMESTAMP
  `);
  const openTables = tables.filter((table) =>
    availableNow(table, reservations, policy)
  );

  const waiting = (await listWaitlistEntries(tx, {
    activeOnly: true,
    limit: 500,
  })).filter((entry) => entry.status === "waiting");
  const firstEligible = waiting.find((entry) =>
    openTables.some((table) => table.capacity >= entry.partySize)
  );
  if (!firstEligible) {
    throw new WaitlistOperationsError(
      "No compatible table is ready",
      "WAITLIST_TABLE_NOT_READY",
      409
    );
  }
  if (firstEligible.id !== target.id) {
    throw new WaitlistOperationsError(
      "Another compatible party has priority for the available table",
      "WAITLIST_PRIORITY_CONFLICT",
      409,
      { priorityEntryId: firstEligible.id }
    );
  }

  const selected = openTables
    .filter((table) => table.capacity >= target.partySize)
    .sort(
      (left, right) =>
        preferenceRank(target, left) - preferenceRank(target, right) ||
        left.capacity - right.capacity ||
        left.number - right.number
    )[0];
  if (!selected) {
    throw new WaitlistOperationsError(
      "No compatible table is ready",
      "WAITLIST_TABLE_NOT_READY",
      409
    );
  }

  const tableUpdated = await tx.$executeRaw(Prisma.sql`
    UPDATE "RestaurantTable"
    SET
      "status" = 'reserved'::"TableStatus",
      "seatedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${selected.id}
      AND "status" = 'open'
  `);
  if (tableUpdated !== 1) {
    throw new WaitlistOperationsError(
      "The selected table changed while it was being assigned",
      "WAITLIST_TABLE_ASSIGNMENT_CONFLICT",
      409
    );
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "WaitlistEntry"
    SET
      "status" = 'notified'::"WaitlistStatus",
      "tableId" = ${selected.id},
      "estimatedWait" = 0,
      "estimatedSeatAt" = CURRENT_TIMESTAMP,
      "estimateCalculatedAt" = CURRENT_TIMESTAMP,
      "notifiedAt" = CURRENT_TIMESTAMP,
      "notificationExpiresAt" = CURRENT_TIMESTAMP +
        make_interval(mins => ${policy.notificationExpiryMinutes}),
      "notificationConfirmedAt" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${target.id}
      AND "status" = 'waiting'
  `);
  await writeAuditEvent(tx, {
    actor: input.actor,
    action: "waitlist.notify",
    entityType: "WaitlistEntry",
    entityId: target.id,
    context: input.context,
    metadata: {
      tableId: selected.id,
      tableNumber: selected.number,
      partySize: target.partySize,
      expiryMinutes: policy.notificationExpiryMinutes,
    },
  });

  const active = await recalculateWaitlistEstimates(tx);
  const entry = await readWaitlistEntry(tx, target.id);
  if (!entry) {
    throw new WaitlistOperationsError(
      "Unable to load the notified waitlist entry",
      "WAITLIST_RESULT_MISSING",
      500
    );
  }
  return { entry, active };
}

export async function confirmWaitlistEntry(
  tx: WaitlistClient,
  input: {
    id: string;
    actor?: WaitlistActor | null;
    context?: AuditRequestContext;
  }
): Promise<{ entry: WaitlistEntryRow; replayed: boolean }> {
  await advisoryLock(tx, "waitlist", "queue");
  await expireStaleNotifications(tx, input.context);
  const entry = await readWaitlistEntry(tx, input.id, true);
  if (!entry) {
    throw new WaitlistOperationsError(
      "Waitlist entry not found",
      "WAITLIST_ENTRY_NOT_FOUND",
      404
    );
  }
  if (entry.status !== "notified") {
    throw new WaitlistOperationsError(
      "This waitlist notification is no longer active",
      "WAITLIST_CONFIRM_DENIED",
      409
    );
  }
  if (entry.notificationConfirmedAt) {
    return { entry, replayed: true };
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "WaitlistEntry"
    SET
      "notificationConfirmedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entry.id}
      AND "status" = 'notified'
      AND "notificationConfirmedAt" IS NULL
  `);
  await writeAuditEvent(tx, {
    actor: input.actor || null,
    action: "waitlist.notification.confirm",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    context: input.context,
    metadata: { tableId: entry.tableId },
  });
  const updated = await readWaitlistEntry(tx, entry.id);
  if (!updated) {
    throw new WaitlistOperationsError(
      "Unable to load the confirmed waitlist entry",
      "WAITLIST_RESULT_MISSING",
      500
    );
  }
  return { entry: updated, replayed: false };
}

export async function seatWaitlistEntry(
  tx: WaitlistClient,
  input: {
    id: string;
    actor: WaitlistActor;
    context?: AuditRequestContext;
  }
): Promise<{ entry: WaitlistEntryRow; active: WaitlistEntryRow[] }> {
  await advisoryLock(tx, "waitlist", "queue");
  await expireStaleNotifications(tx, input.context);
  const policy = await readWaitlistPolicy(tx);
  const entry = await readWaitlistEntry(tx, input.id, true);
  if (!entry) {
    throw new WaitlistOperationsError(
      "Waitlist entry not found",
      "WAITLIST_ENTRY_NOT_FOUND",
      404
    );
  }
  if (entry.status !== "notified" || !entry.tableId) {
    throw new WaitlistOperationsError(
      "Only an active notified entry with a table hold can be seated",
      "WAITLIST_SEAT_DENIED",
      409
    );
  }
  if (policy.requireConfirmation && !entry.notificationConfirmedAt) {
    throw new WaitlistOperationsError(
      "The customer must confirm before seating",
      "WAITLIST_CONFIRMATION_REQUIRED",
      409
    );
  }

  const tables = await tx.$queryRaw<TableRow[]>(Prisma.sql`
    SELECT
      restaurant_table."id",
      restaurant_table."number",
      restaurant_table."capacity",
      restaurant_table."section",
      restaurant_table."status"::text AS "status",
      restaurant_table."seatedAt"
    FROM "RestaurantTable" AS restaurant_table
    WHERE restaurant_table."id" = ${entry.tableId}
    FOR UPDATE
  `);
  const table = tables[0];
  if (!table || table.status !== "reserved" || table.capacity < entry.partySize) {
    throw new WaitlistOperationsError(
      "The held table is no longer available",
      "WAITLIST_TABLE_ASSIGNMENT_CONFLICT",
      409
    );
  }

  const plannedRelease = addMinutes(policy.now, policy.averageTurnoverMinutes);
  const conflicts = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT reservation."id"
    FROM "Reservation" AS reservation
    WHERE reservation."tableId" = ${table.id}
      AND reservation."status" IN ('confirmed', 'seated')
      AND reservation."dateTime" < ${plannedRelease}
      AND reservation."releaseAt" > ${policy.now}
    LIMIT 1
  `);
  if (conflicts[0]) {
    throw new WaitlistOperationsError(
      "An upcoming reservation prevents seating this party at the held table",
      "WAITLIST_RESERVATION_CONFLICT",
      409
    );
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "WaitlistEntry"
    SET
      "status" = 'seated'::"WaitlistStatus",
      "seatedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entry.id}
      AND "status" = 'notified'
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "RestaurantTable"
    SET
      "status" = 'seated'::"TableStatus",
      "seatedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${table.id}
      AND "status" = 'reserved'
  `);
  await writeAuditEvent(tx, {
    actor: input.actor,
    action: "waitlist.seat",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    context: input.context,
    metadata: {
      tableId: table.id,
      tableNumber: table.number,
      partySize: entry.partySize,
    },
  });

  const active = await recalculateWaitlistEstimates(tx);
  const updated = await readWaitlistEntry(tx, entry.id);
  if (!updated) {
    throw new WaitlistOperationsError(
      "Unable to load the seated waitlist entry",
      "WAITLIST_RESULT_MISSING",
      500
    );
  }
  return { entry: updated, active };
}

export async function closeWaitlistEntry(
  tx: WaitlistClient,
  input: {
    id: string;
    outcome: "cancelled" | "no_show";
    actor?: WaitlistActor | null;
    context?: AuditRequestContext;
    reason?: string | null;
  }
): Promise<{ entry: WaitlistEntryRow; active: WaitlistEntryRow[]; replayed: boolean }> {
  await advisoryLock(tx, "waitlist", "queue");
  await expireStaleNotifications(tx, input.context);
  const entry = await readWaitlistEntry(tx, input.id, true);
  if (!entry) {
    throw new WaitlistOperationsError(
      "Waitlist entry not found",
      "WAITLIST_ENTRY_NOT_FOUND",
      404
    );
  }
  if (entry.status === input.outcome) {
    const active = await recalculateWaitlistEstimates(tx);
    return { entry, active, replayed: true };
  }
  if (!['waiting', 'notified'].includes(entry.status)) {
    throw new WaitlistOperationsError(
      "This waitlist entry can no longer be changed",
      "WAITLIST_TERMINAL_STATE",
      409
    );
  }

  if (input.outcome === "cancelled") {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "WaitlistEntry"
      SET
        "status" = 'cancelled'::"WaitlistStatus",
        "cancelledAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${entry.id}
        AND "status" IN ('waiting', 'notified')
    `);
  } else {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "WaitlistEntry"
      SET
        "status" = 'no_show'::"WaitlistStatus",
        "noShowAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${entry.id}
        AND "status" IN ('waiting', 'notified')
    `);
  }
  await releaseHeldTable(tx, entry.tableId);
  await writeAuditEvent(tx, {
    actor: input.actor || null,
    action:
      input.outcome === "cancelled" ? "waitlist.cancel" : "waitlist.no_show",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    context: input.context,
    metadata: {
      previousStatus: entry.status,
      tableId: entry.tableId,
      reason: optional(input.reason, 2_000),
    },
  });

  const active = await recalculateWaitlistEstimates(tx);
  const updated = await readWaitlistEntry(tx, entry.id);
  if (!updated) {
    throw new WaitlistOperationsError(
      "Unable to load the updated waitlist entry",
      "WAITLIST_RESULT_MISSING",
      500
    );
  }
  return { entry: updated, active, replayed: false };
}

function databaseErrorDetails(error: unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5 || value === null || value === undefined) return;
    if (["string", "number", "bigint"].includes(typeof value)) {
      parts.push(String(value));
      return;
    }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Error) {
      parts.push(value.name, value.message);
      visit(value.cause, depth + 1);
    }
    const record = value as Record<string, unknown>;
    for (const key of ["code", "message", "meta", "cause", "constraint", "target"]) {
      visit(record[key], depth + 1);
    }
  };
  visit(error, 0);
  return parts.join(" ");
}

export function waitlistErrorFromDatabase(
  error: unknown
): WaitlistOperationsError | null {
  const details = databaseErrorDetails(error);
  if (
    details.includes("WaitlistEntry_one_active_phone_idx") ||
    details.includes("customerPhone") && details.includes("23505")
  ) {
    return new WaitlistOperationsError(
      "This phone number is already on the active waitlist",
      "DUPLICATE_WAITLIST_ENTRY",
      409
    );
  }
  if (details.includes("WaitlistEntry_one_active_table_hold_idx")) {
    return new WaitlistOperationsError(
      "The selected table is already held for another party",
      "WAITLIST_TABLE_ASSIGNMENT_CONFLICT",
      409
    );
  }
  if (details.includes("WaitlistEntry_idempotencyKey_key")) {
    return new WaitlistOperationsError(
      "The waitlist idempotency key is already in use",
      "WAITLIST_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (
    details.includes("40P01") ||
    details.includes("40001") ||
    details.includes("P2034") ||
    details.toLowerCase().includes("deadlock detected") ||
    details.toLowerCase().includes("serialization failure")
  ) {
    return new WaitlistOperationsError(
      "The waitlist changed concurrently; retry the request",
      "WAITLIST_TRANSACTION_RETRY_REQUIRED",
      409,
      { retryable: true }
    );
  }
  return null;
}
