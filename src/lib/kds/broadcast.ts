import "server-only";

const KDS_REALTIME_URL =
  process.env.KDS_REALTIME_URL || "http://localhost:3003/broadcast";

export type KdsBroadcastType =
  | "order:new"
  | "order:update"
  | "order:status"
  | "screen:update";

export interface KdsBroadcastPayload {
  type?: KdsBroadcastType;
  /** Slugs of screens that should receive the update. Empty/undefined = all. */
  screenSlugs?: string[];
  payload?: unknown;
}

export class KdsBroadcastError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KdsBroadcastError";
  }
}

/**
 * Deliver one event to the realtime service. Failures are surfaced so the
 * transactional outbox can retain and retry the event. KDS polling remains a
 * display fallback, but it is no longer the only recovery mechanism.
 */
export async function broadcastKds({
  type = "order:update",
  screenSlugs,
  payload,
}: KdsBroadcastPayload = {}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const response = await fetch(KDS_REALTIME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        screenSlugs: Array.from(
          new Set((screenSlugs || []).filter(Boolean))
        ),
        payload: payload ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KdsBroadcastError(
        `KDS realtime service returned HTTP ${response.status}`
      );
    }
  } catch (error) {
    if (error instanceof KdsBroadcastError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new KdsBroadcastError("KDS realtime delivery timed out");
    }
    throw new KdsBroadcastError(
      error instanceof Error ? error.message : "KDS realtime delivery failed"
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function stationSlugsFromItems(
  items: { stationSlug?: string | null }[]
): string[] {
  const set = new Set<string>();
  items.forEach((item) => {
    if (item.stationSlug) set.add(item.stationSlug);
  });
  return Array.from(set);
}