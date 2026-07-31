import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

type MutationMethod = "POST" | "PUT" | "PATCH" | "DELETE";

interface MutationHandler {
  key: string;
  method: MutationMethod;
  route: string;
  file: string;
  source: string;
  handler: string;
}

interface SpecialPolicy {
  markers: readonly string[];
  beforeJson?: readonly string[];
}

const API_ROOT = resolve(process.cwd(), "src/app/api");
const MUTATION_METHODS = new Set<MutationMethod>([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const SPECIAL_POLICIES: Record<string, SpecialPolicy> = {
  "POST /api/auth/login": {
    markers: [
      "consumeRateLimit",
      "auth-login-source",
      "auth-login-pin",
      "authenticateEmployeePin",
      "setStaffSession",
    ],
  },
  "POST /api/auth/logout": {
    markers: ["getStaffSession", "clearStaffSession"],
  },
  "POST /api/customers/lookup": {
    markers: [
      "loyaltyCredentialsSchema",
      "verifyOrderAccessToken",
      "redemptionEnabled: false",
    ],
  },
  "PATCH /api/customers/lookup": {
    markers: ["DIRECT_REDEMPTION_DISABLED", "status: 405"],
  },
  "POST /api/employees/clock": {
    markers: [
      "clockSchema",
      "employee-clock-source",
      "employee-clock-pin",
      "authenticateEmployeePin",
      "requireStaffSession",
      "writeAuditEvent",
    ],
  },
  "POST /api/feedback": {
    markers: ["feedbackSchema", "feedback-submit", "consumeRateLimit"],
  },
  "POST /api/internal/kds-outbox": {
    markers: ["configuredSecret", "secretsMatch", "flushKdsOutbox"],
  },
  "POST /api/newsletter": {
    markers: ["newsletterSchema", "newsletter-subscribe", "consumeRateLimit"],
  },
  "POST /api/orders": {
    markers: [
      "orderRequestSchema",
      "order-create",
      "idempotency-key",
      "queueKdsEvent",
    ],
  },
  "POST /api/orders/quote": {
    markers: ["orderRequestSchema", "order-quote", "consumeRateLimit"],
  },
  "POST /api/orders/track/[orderNumber]/cancel": {
    markers: [
      "verifyOrderAccessToken",
      "order-cancel",
      "writeAuditEvent",
      "queueKdsEvent",
    ],
  },
  "POST /api/reservations": {
    markers: [
      "reservationCreateSchema",
      "reservation-create",
      "consumeRateLimit",
      "createCustomerAccessToken",
    ],
  },
  "PATCH /api/reservations/[id]": {
    markers: ["verifyCustomerAccessToken", "requireStaffSession"],
    beforeJson: ["verifyCustomerAccessToken", "requireStaffSession"],
  },
  "POST /api/waitlist": {
    markers: [
      "waitlistCreateSchema",
      "waitlist-join",
      "consumeRateLimit",
      "createCustomerAccessToken",
    ],
  },
  "PATCH /api/waitlist/[id]": {
    markers: ["verifyCustomerAccessToken", "requireStaffSession"],
    beforeJson: ["verifyCustomerAccessToken", "requireStaffSession"],
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

function mutationHandlers(): MutationHandler[] {
  return routeFiles(API_ROOT).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const matches = Array.from(
      source.matchAll(
        /export\s+async\s+function\s+(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s*\(/g
      )
    );
    const route = routeFromFile(file);

    return matches.flatMap((match, index) => {
      const method = match[1] as MutationMethod;
      if (!MUTATION_METHODS.has(method)) return [];
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? source.length;
      return [
        {
          key: `${method} ${route}`,
          method,
          route,
          file,
          source,
          handler: source.slice(start, end),
        },
      ];
    });
  });
}

function firstJsonParseIndex(handler: string): number {
  const indexes = [
    handler.indexOf("req.json()"),
    handler.indexOf("request.json()"),
  ].filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

describe("API mutation authorization inventory", () => {
  const mutations = mutationHandlers();

  test("discovers at least one state-changing API handler", () => {
    expect(mutations.length).toBeGreaterThan(0);
  });

  test("classifies every API mutation as staff-protected or explicitly controlled", () => {
    const unclassified: string[] = [];
    const missingMarkers: string[] = [];
    const authAfterBodyParsing: string[] = [];
    const discoveredSpecialPolicies = new Set<string>();

    for (const mutation of mutations) {
      const policy = SPECIAL_POLICIES[mutation.key];
      if (policy) {
        discoveredSpecialPolicies.add(mutation.key);
        for (const marker of policy.markers) {
          if (!mutation.source.includes(marker)) {
            missingMarkers.push(`${mutation.key}: missing ${marker}`);
          }
        }

        const jsonIndex = firstJsonParseIndex(mutation.handler);
        if (jsonIndex >= 0) {
          for (const marker of policy.beforeJson || []) {
            const markerIndex = mutation.handler.indexOf(marker);
            if (markerIndex < 0 || markerIndex > jsonIndex) {
              authAfterBodyParsing.push(
                `${mutation.key}: ${marker} must run before request JSON parsing`
              );
            }
          }
        }
        continue;
      }

      const guardIndex = mutation.handler.indexOf("requireStaffSession(");
      if (guardIndex < 0) {
        unclassified.push(`${mutation.key} (${relative(process.cwd(), mutation.file)})`);
        continue;
      }

      const jsonIndex = firstJsonParseIndex(mutation.handler);
      if (jsonIndex >= 0 && guardIndex > jsonIndex) {
        authAfterBodyParsing.push(
          `${mutation.key}: staff authorization must run before request JSON parsing`
        );
      }
    }

    const stalePolicies = Object.keys(SPECIAL_POLICIES).filter(
      (key) => !discoveredSpecialPolicies.has(key)
    );

    expect(unclassified).toEqual([]);
    expect(missingMarkers).toEqual([]);
    expect(authAfterBodyParsing).toEqual([]);
    expect(stalePolicies).toEqual([]);
  });
});
