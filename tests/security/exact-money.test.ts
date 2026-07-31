import { describe, expect, test } from "bun:test";
import {
  ExactValueError,
  formatScaledInteger,
  parseNonNegativeDecimalToScaledInteger,
  scaledIntegerToSafeNumber,
} from "../../src/lib/money/scaled-integer";

describe("exact scaled-integer values", () => {
  test("parses currency values without binary floating-point arithmetic", () => {
    expect(parseNonNegativeDecimalToScaledInteger("12.34", 2)).toBe(1234n);
    expect(parseNonNegativeDecimalToScaledInteger("0.1", 2)).toBe(10n);
    expect(parseNonNegativeDecimalToScaledInteger("0007.50", 2)).toBe(750n);
  });

  test("rounds discarded digits half-up", () => {
    expect(parseNonNegativeDecimalToScaledInteger("12.344", 2)).toBe(1234n);
    expect(parseNonNegativeDecimalToScaledInteger("12.345", 2)).toBe(1235n);
    expect(parseNonNegativeDecimalToScaledInteger("0.005", 2)).toBe(1n);
    expect(parseNonNegativeDecimalToScaledInteger("1.2345675", 6)).toBe(
      1234568n
    );
  });

  test("formats exact values deterministically", () => {
    expect(formatScaledInteger(0n, 2)).toBe("0.00");
    expect(formatScaledInteger(5n, 2)).toBe("0.05");
    expect(formatScaledInteger(1234567n, 6)).toBe("1.234567");
    expect(scaledIntegerToSafeNumber(1234n, 2)).toBe(12.34);
  });

  test("rejects negative, exponential, malformed, and oversized inputs", () => {
    for (const input of ["-1", "1e3", "NaN", "Infinity", "", ".5"]) {
      expect(() => parseNonNegativeDecimalToScaledInteger(input, 2)).toThrow(
        ExactValueError
      );
    }

    expect(() =>
      parseNonNegativeDecimalToScaledInteger("100.01", 2, 10000n)
    ).toThrow("Value exceeds the supported maximum");
    expect(() => scaledIntegerToSafeNumber(-1n, 2)).toThrow(ExactValueError);
    expect(() =>
      scaledIntegerToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 2)
    ).toThrow(ExactValueError);
  });
});
