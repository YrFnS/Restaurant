import { describe, expect, test } from "bun:test";
import {
  ExactValueError,
  formatScaledInteger,
  parseNonNegativeDecimalToScaledInteger,
  scaledIntegerToSafeNumber,
} from "../../src/lib/money/scaled-integer";

describe("exact scaled-integer values", () => {
  test("parses currency values without binary floating-point arithmetic", () => {
    expect(parseNonNegativeDecimalToScaledInteger("12.34", 2)).toBe(
      BigInt(1234)
    );
    expect(parseNonNegativeDecimalToScaledInteger("0.1", 2)).toBe(BigInt(10));
    expect(parseNonNegativeDecimalToScaledInteger("0007.50", 2)).toBe(
      BigInt(750)
    );
  });

  test("rounds discarded digits half-up", () => {
    expect(parseNonNegativeDecimalToScaledInteger("12.344", 2)).toBe(
      BigInt(1234)
    );
    expect(parseNonNegativeDecimalToScaledInteger("12.345", 2)).toBe(
      BigInt(1235)
    );
    expect(parseNonNegativeDecimalToScaledInteger("0.005", 2)).toBe(
      BigInt(1)
    );
    expect(parseNonNegativeDecimalToScaledInteger("1.2345675", 6)).toBe(
      BigInt(1234568)
    );
  });

  test("formats exact values deterministically", () => {
    expect(formatScaledInteger(BigInt(0), 2)).toBe("0.00");
    expect(formatScaledInteger(BigInt(5), 2)).toBe("0.05");
    expect(formatScaledInteger(BigInt(1234567), 6)).toBe("1.234567");
    expect(scaledIntegerToSafeNumber(BigInt(1234), 2)).toBe(12.34);
  });

  test("rejects negative, exponential, malformed, and oversized inputs", () => {
    for (const input of ["-1", "1e3", "NaN", "Infinity", "", ".5"]) {
      expect(() => parseNonNegativeDecimalToScaledInteger(input, 2)).toThrow(
        ExactValueError
      );
    }

    expect(() =>
      parseNonNegativeDecimalToScaledInteger("100.01", 2, BigInt(10000))
    ).toThrow("Value exceeds the supported maximum");
    expect(() => scaledIntegerToSafeNumber(BigInt(-1), 2)).toThrow(
      ExactValueError
    );
    expect(() =>
      scaledIntegerToSafeNumber(
        BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1),
        2
      )
    ).toThrow(ExactValueError);
  });
});
