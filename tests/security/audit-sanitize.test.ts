import { describe, expect, test } from "bun:test";
import { sanitizeAuditMetadata } from "../../src/lib/audit/sanitize";

describe("audit metadata sanitizer", () => {
  test("redacts credential-like keys recursively", () => {
    expect(
      sanitizeAuditMetadata({
        action: "employee.update",
        pin: "1234",
        nested: {
          accessToken: "secret-token",
          safe: "visible",
        },
      })
    ).toEqual({
      action: "employee.update",
      pin: "[redacted]",
      nested: {
        accessToken: "[redacted]",
        safe: "visible",
      },
    });
  });

  test("normalizes unsupported scalar values", () => {
    expect(
      sanitizeAuditMetadata({
        invalidNumber: Number.POSITIVE_INFINITY,
        amount: BigInt(12),
        at: new Date("2026-07-31T00:00:00.000Z"),
      })
    ).toEqual({
      invalidNumber: 0,
      amount: "12",
      at: "2026-07-31T00:00:00.000Z",
    });
  });

  test("bounds deeply nested data", () => {
    const deeplyNested = {
      one: {
        two: {
          three: {
            four: {
              five: {
                six: "hidden",
              },
            },
          },
        },
      },
    };

    expect(sanitizeAuditMetadata(deeplyNested)).toEqual({
      one: {
        two: {
          three: {
            four: {
              five: "[truncated]",
            },
          },
        },
      },
    });
  });
});