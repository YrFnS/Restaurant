// Server-only helper: notify the kds-realtime WebSocket service to broadcast
// an update to connected KDS screens. Used by /api/orders POST and
// /api/kitchen PATCH so screens update instantly without waiting for the
// next poll.
//
// This MUST only be imported from server code (API routes, server actions).

const KDS_REALTIME_URL = "http://localhost:3003/broadcast";

type BroadcastType =
  | "order:new"
  | "order:update"
  | "order:status"
  | "screen:update";

interface BroadcastPayload {
  type?: BroadcastType;
  /** Slugs of screens that should receive the update. Empty/undefined = all. */
  screenSlugs?: string[];
  payload?: unknown;
}

/**
 * Fire-and-forget broadcast. Errors are swallowed (KDS will still poll).
 * Server-to-server call — this is allowed to use a direct localhost URL.
 */
export async function broadcastKds({
  type = "order:update",
  screenSlugs,
  payload,
}: BroadcastPayload = {}): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    await fetch(KDS_REALTIME_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        screenSlugs: screenSlugs?.filter(Boolean) ?? [],
        payload: payload ?? null,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    // Mini-service may be down — silent fail; polling will catch up.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kds/broadcast] failed:", e);
    }
  }
}

/**
 * Compute the unique station slugs from an order's items. Used to scope the
 * broadcast to only the screens that show those stations.
 */
export function stationSlugsFromItems(items: { stationSlug?: string | null }[]): string[] {
  const set = new Set<string>();
  items.forEach((i) => {
    if (i.stationSlug) set.add(i.stationSlug);
  });
  return Array.from(set);
}
