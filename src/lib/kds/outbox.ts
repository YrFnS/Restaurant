import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  broadcastKds,
  type KdsBroadcastPayload,
  type KdsBroadcastType,
} from "./broadcast";

type OutboxClient =
  | Pick<PrismaClient, "kdsOutboxEvent" | "kitchenScreen">
  | Pick<Prisma.TransactionClient, "kdsOutboxEvent" | "kitchenScreen">;

interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  screenSlugs: Prisma.JsonValue;
  payload: Prisma.JsonValue | null;
  attempts: number;
}

export interface KdsOutboxFlushResult {
  claimed: number;
  delivered: number;
  failed: number;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.filter((entry): entry is string => typeof entry === "string")
  );
}

function asBroadcastType(value: string): KdsBroadcastType {
  if (
    value === "order:new" ||
    value === "order:update" ||
    value === "order:status" ||
    value === "screen:update"
  ) {
    return value;
  }
  throw new Error(`Unsupported KDS outbox event type: ${value}`);
}

export async function resolveKdsScreenSlugs(
  client: OutboxClient,
  stationSlugs: readonly string[]
): Promise<string[]> {
  const normalizedStations = uniqueStrings(stationSlugs);
  const screens = await client.kitchenScreen.findMany({
    where: { isActive: true },
    select: { slug: true, stationFilter: true, screenType: true },
  });

  return screens
    .filter((screen) => {
      if (screen.screenType === "expo") return true;
      if (!screen.stationFilter) return true;
      const filter = screen.stationFilter.split(",").filter(Boolean);
      return filter.some((slug) => normalizedStations.includes(slug));
    })
    .map((screen) => screen.slug);
}

export async function queueKdsEvent(
  client: OutboxClient,
  event: Required<Pick<KdsBroadcastPayload, "type">> &
    Pick<KdsBroadcastPayload, "screenSlugs" | "payload">
): Promise<string> {
  const created = await client.kdsOutboxEvent.create({
    data: {
      eventType: event.type,
      screenSlugs: uniqueStrings(event.screenSlugs || []),
      ...(event.payload === undefined
        ? {}
        : { payload: event.payload as Prisma.InputJsonValue }),
    },
    select: { id: true },
  });
  return created.id;
}

async function claimDueEvents(limit: number): Promise<ClaimedOutboxEvent[]> {
  const lockToken = randomUUID();
  const leaseExpiredBefore = new Date(Date.now() - 2 * 60 * 1_000);

  return db.$queryRaw<ClaimedOutboxEvent[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "KdsOutboxEvent"
      WHERE
        "deliveredAt" IS NULL
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        AND (
          "lockedAt" IS NULL
          OR "lockedAt" < ${leaseExpiredBefore}
        )
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "KdsOutboxEvent" AS event
    SET
      "lockedAt" = CURRENT_TIMESTAMP,
      "lockToken" = ${lockToken},
      "attempts" = event."attempts" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    FROM candidates
    WHERE event."id" = candidates."id"
    RETURNING
      event."id",
      event."eventType",
      event."screenSlugs",
      event."payload",
      event."attempts"
  `;
}

function retryDelayMs(attempts: number): number {
  const exponential = 5_000 * 2 ** Math.min(Math.max(attempts - 1, 0), 8);
  return Math.min(15 * 60 * 1_000, exponential);
}

export async function flushKdsOutbox(
  requestedLimit = 25
): Promise<KdsOutboxFlushResult> {
  const limit = Math.min(100, Math.max(1, Math.floor(requestedLimit)));
  const events = await claimDueEvents(limit);
  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await broadcastKds({
        type: asBroadcastType(event.eventType),
        screenSlugs: asStringArray(event.screenSlugs),
        payload: event.payload,
      });

      await db.kdsOutboxEvent.update({
        where: { id: event.id },
        data: {
          deliveredAt: new Date(),
          lockedAt: null,
          lockToken: null,
          lastError: "",
        },
      });
      delivered += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown KDS delivery failure";
      await db.kdsOutboxEvent.update({
        where: { id: event.id },
        data: {
          nextAttemptAt: new Date(Date.now() + retryDelayMs(event.attempts)),
          lockedAt: null,
          lockToken: null,
          lastError: message.slice(0, 2_000),
        },
      });
      failed += 1;
    }
  }

  return { claimed: events.length, delivered, failed };
}

export async function flushKdsOutboxBestEffort(limit = 10): Promise<void> {
  try {
    await flushKdsOutbox(limit);
  } catch (error) {
    console.warn("[kds/outbox] Flush failed; queued events remain pending", error);
  }
}
