import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

type HttpMethod =
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";
type ReadMethod = "GET" | "HEAD";

interface ReadHandler {
  key: string;
  method: ReadMethod;
  route: string;
  file: string;
  source: string;
  handler: string;
}

interface ReadPolicy {
  markers: readonly string[];
  markerScope?: "handler" | "source";
  forbidden?: readonly RegExp[];
}

const API_ROOT = resolve(process.cwd(), "src/app/api");
const READ_METHODS = new Set<ReadMethod>(["GET", "HEAD"]);
const HANDLER_PATTERN =
  /export\s+(?:async\s+)?function\s+(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s*\(/g;

/**
 * Reads without an unconditional staff guard must be explicitly reviewed here.
 * The markers make accidental removal of their ownership, rate-limit, filtering,
 * or redaction controls fail CI rather than silently widening public access.
 */
const SPECIAL_READ_POLICIES: Record<string, ReadPolicy> = {
  "GET /api": {
    markers: ['status: "ok"', '"Cache-Control": "no-store"'],
  },
  "GET /api/auth/session": {
    markers: ["getStaffSession", "status: 401", '"Cache-Control": "no-store"'],
    markerScope: "source",
    forbidden: [/\bpin(?:Hash|Verifier)?\b/i, /\btokenHash\b/i],
  },
  "GET /api/dynamic-pricing": {
    markers: [
      "activeOnly",
      "requireStaffSession(MENU_MANAGEMENT_ROLES)",
      "where: activeOnly ? { isActive: true } : undefined",
      "select: {",
    ],
  },
  "GET /api/internal/kds-outbox": {
    markers: [
      "configuredSecret",
      "secretsMatch",
      "processOutbox(request)",
      "flushKdsOutbox",
    ],
    markerScope: "source",
  },
  "GET /api/internal/waitlist": {
    markers: [
      "configuredSecret",
      "secretsMatch",
      "processWaitlist(request)",
      "refreshWaitlist",
    ],
    markerScope: "source",
  },
  "GET /api/menu": {
    markers: [
      'searchParams.get("all")',
      "requireStaffSession(MENU_MANAGEMENT_ROLES)",
      "{ isAvailable: true }",
      "modifierGroups",
    ],
  },
  "GET /api/offers": {
    markers: ["isActive: true", "validFrom", "validUntil", "select: {"],
    forbidden: [/\bcustomerPhone\b/i, /\bpin(?:Hash|Verifier)?\b/i, /\btokenHash\b/i],
  },
  "GET /api/orders/track/[orderNumber]": {
    markers: [
      "consumeRateLimit",
      "getStaffSession",
      "ORDER_MANAGEMENT_ROLES",
      "verifyOrderAccessToken",
      "findUnique",
      "select: {",
    ],
    forbidden: [/\btokenHash\b/i, /\bpin(?:Hash|Verifier)?\b/i],
  },
  "GET /api/promo": {
    markers: [
      "PROMO_PATTERN",
      "consumeRateLimit",
      "findUnique",
      "isActive",
      "valid: false",
    ],
  },
  "GET /api/reward-tiers": {
    markers: ["isActive: true", "select: {"],
    forbidden: [/\bcustomer\b/i, /\bemail\b/i, /\bphone\b/i],
  },
  "GET /api/reservations/availability": {
    markers: [
      "availabilityQuerySchema",
      "reservation-availability",
      "consumeRateLimit",
      "listReservationAvailability",
      "availableTableCount",
    ],
    forbidden: [
      /\bcustomerPhone\b/i,
      /\bcustomerEmail\b/i,
      /\btableId\b/i,
      /\btokenHash\b/i,
    ],
  },
  "GET /api/settings": {
    markers: ["restaurantSettings.findFirst", 'where: { id: "1" }'],
    forbidden: [/process\.env/i, /\bpin(?:Hash|Verifier)?\b/i, /\btokenHash\b/i],
  },
  "GET /api/testimonials": {
    markers: ["isActive: true", "select: {", '"Cache-Control": "public, max-age=60"'],
    forbidden: [/\bemail\b/i, /\bphone\b/i, /\btokenHash\b/i],
  },
  "GET /api/waitlist": {
    markers: [
      "admin",
      "requireStaffSession(RESERVATION_MANAGEMENT_ROLES)",
      "verifyCustomerAccessToken",
      "waitingCount",
      "serializeWaitlistForCustomer",
      "safeWaitlistPolicy",
    ],
    forbidden: [/\btokenHash\b/i, /\bpin(?:Hash|Verifier)?\b/i],
  },
};

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? routeFiles(path)
      : entry === "route.ts"
        ? [path]
        : [];
  });
}

function routeFromFile(file: string): string {
  const directory = relative(API_ROOT, file)
    .split(sep)
    .slice(0, -1)
    .join("/");
  return directory ? `/api/${directory}` : "/api";
}

function readHandlers(): ReadHandler[] {
  return routeFiles(API_ROOT).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const matches = Array.from(source.matchAll(HANDLER_PATTERN));
    const route = routeFromFile(file);

    return matches.flatMap((match, index) => {
      const method = match[1] as HttpMethod;
      if (!READ_METHODS.has(method as ReadMethod)) return [];

      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? source.length;
      return [
        {
          key: `${method} ${route}`,
          method: method as ReadMethod,
          route,
          file,
          source,
          handler: source.slice(start, end),
        },
      ];
    });
  });
}

function firstDatabaseAccessIndex(handler: string): number {
  const match = /\b(?:db|prisma)\.[A-Za-z_$][\w$]*/.exec(handler);
  return match?.index ?? -1;
}

describe("API read authorization and privacy inventory", () => {
  const reads = readHandlers();

  test("discovers at least one API read handler", () => {
    expect(reads.length).toBeGreaterThan(0);
  });

  test("classifies every read and authorizes protected reads before database access", () => {
    const unclassified: string[] = [];
    const missingMarkers: string[] = [];
    const forbiddenMarkers: string[] = [];
    const authorizationAfterDatabaseAccess: string[] = [];
    const discoveredPolicies = new Set<string>();

    for (const read of reads) {
      const policy = SPECIAL_READ_POLICIES[read.key];
      if (policy) {
        discoveredPolicies.add(read.key);
        const markerText =
          policy.markerScope === "source" ? read.source : read.handler;

        for (const marker of policy.markers) {
          if (!markerText.includes(marker)) {
            missingMarkers.push(`${read.key}: missing ${marker}`);
          }
        }
        for (const pattern of policy.forbidden || []) {
          if (pattern.test(read.handler)) {
            forbiddenMarkers.push(`${read.key}: matched forbidden ${pattern}`);
          }
        }
        continue;
      }

      const guardIndex = read.handler.indexOf("requireStaffSession(");
      if (guardIndex < 0) {
        unclassified.push(
          `${read.key} (${relative(process.cwd(), read.file)})`
        );
        continue;
      }

      const databaseIndex = firstDatabaseAccessIndex(read.handler);
      if (databaseIndex >= 0 && guardIndex > databaseIndex) {
        authorizationAfterDatabaseAccess.push(
          `${read.key}: staff authorization must run before database access`
        );
      }
    }

    const stalePolicies = Object.keys(SPECIAL_READ_POLICIES).filter(
      (key) => !discoveredPolicies.has(key)
    );

    expect(unclassified).toEqual([]);
    expect(missingMarkers).toEqual([]);
    expect(forbiddenMarkers).toEqual([]);
    expect(authorizationAfterDatabaseAccess).toEqual([]);
    expect(stalePolicies).toEqual([]);
  });
});
