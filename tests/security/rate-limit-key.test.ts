import { describe, expect, test } from "bun:test";
import { createRateLimitDescriptor } from "../../src/lib/security/rate-limit-key";

const secret = "unit-test-rate-limit-secret-0123456789abcdef";

describe("rate-limit key derivation", () => {
  test("uses one stable key inside a fixed window", () => {
    const first = createRateLimitDescriptor({
      secret,
      scope: "auth-login-source",
      identifier: "192.0.2.10",
      windowMs: 60_000,
      now: new Date("2026-07-31T10:00:01.000Z"),
    });
    const sameWindow = createRateLimitDescriptor({
      secret,
      scope: "auth-login-source",
      identifier: "192.0.2.10",
      windowMs: 60_000,
      now: new Date("2026-07-31T10:00:59.999Z"),
    });

    expect(first.key).toBe(sameWindow.key);
    expect(first.expiresAt.toISOString()).toBe("2026-07-31T10:01:00.000Z");
  });

  test("rotates the counter key at the next window", () => {
    const first = createRateLimitDescriptor({
      secret,
      scope: "order-create",
      identifier: "192.0.2.10",
      windowMs: 60_000,
      now: new Date("2026-07-31T10:00:59.999Z"),
    });
    const next = createRateLimitDescriptor({
      secret,
      scope: "order-create",
      identifier: "192.0.2.10",
      windowMs: 60_000,
      now: new Date("2026-07-31T10:01:00.000Z"),
    });

    expect(first.key).not.toBe(next.key);
  });

  test("does not persist the raw identifier in the key", () => {
    const descriptor = createRateLimitDescriptor({
      secret,
      scope: "newsletter",
      identifier: "person@example.com",
      windowMs: 60_000,
      now: new Date("2026-07-31T10:00:00.000Z"),
    });

    expect(descriptor.key).toMatch(/^rl_[a-f0-9]{64}$/);
    expect(descriptor.key).not.toContain("person@example.com");
  });

  test("isolates scopes and identifiers", () => {
    const base = {
      secret,
      windowMs: 60_000,
      now: new Date("2026-07-31T10:00:00.000Z"),
    };
    const first = createRateLimitDescriptor({
      ...base,
      scope: "feedback",
      identifier: "192.0.2.10",
    });
    const differentScope = createRateLimitDescriptor({
      ...base,
      scope: "newsletter",
      identifier: "192.0.2.10",
    });
    const differentSource = createRateLimitDescriptor({
      ...base,
      scope: "feedback",
      identifier: "192.0.2.11",
    });

    expect(first.key).not.toBe(differentScope.key);
    expect(first.key).not.toBe(differentSource.key);
  });
});
