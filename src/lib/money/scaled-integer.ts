export const CURRENCY_MINOR_DIGITS = 2;
export const RATE_MICRO_DIGITS = 6;
export const BASIS_POINT_DIGITS = 2;
export const UNIT_COST_MICRO_DIGITS = 6;

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export class ExactValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExactValueError";
  }
}

export function scaleForDigits(scaleDigits: number): bigint {
  if (!Number.isInteger(scaleDigits) || scaleDigits < 0 || scaleDigits > 12) {
    throw new ExactValueError("Scale digits must be an integer between 0 and 12");
  }
  return BIGINT_TEN ** BigInt(scaleDigits);
}

/**
 * Parse a non-negative base-10 value without passing through binary floating
 * point. Extra fractional digits are rounded half-up at the requested scale.
 */
export function parseNonNegativeDecimalToScaledInteger(
  input: string,
  scaleDigits: number,
  maximum?: bigint
): bigint {
  const normalized = input.trim();
  const match = /^(?:\+)?(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) {
    throw new ExactValueError("Value must be a non-negative base-10 decimal");
  }

  const scale = scaleForDigits(scaleDigits);
  const integerPart = BigInt(match[1]);
  const fraction = match[2] || "";
  const retained = fraction.slice(0, scaleDigits).padEnd(scaleDigits, "0");
  let result = integerPart * scale + BigInt(retained || "0");

  const firstDiscardedDigit = fraction[scaleDigits];
  if (firstDiscardedDigit && firstDiscardedDigit >= "5") {
    result += BIGINT_ONE;
  }

  if (maximum !== undefined && result > maximum) {
    throw new ExactValueError("Value exceeds the supported maximum");
  }

  return result;
}

export function formatScaledInteger(
  value: bigint,
  scaleDigits: number
): string {
  if (value < BIGINT_ZERO) {
    throw new ExactValueError("Value must be non-negative");
  }

  const scale = scaleForDigits(scaleDigits);
  if (scaleDigits === 0) return value.toString();

  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(scaleDigits, "0");
  return `${whole}.${fraction}`;
}

export function scaledIntegerToSafeInteger(value: bigint): number {
  if (value < BIGINT_ZERO || value > MAX_SAFE_BIGINT) {
    throw new ExactValueError("Integer value cannot be represented safely as a number");
  }
  return Number(value);
}

export function scaledIntegerToSafeNumber(
  value: bigint,
  scaleDigits: number
): number {
  if (value < BIGINT_ZERO || value > MAX_SAFE_BIGINT) {
    throw new ExactValueError("Scaled value cannot be represented safely as a number");
  }

  const numeric = Number(formatScaledInteger(value, scaleDigits));
  if (!Number.isFinite(numeric)) {
    throw new ExactValueError("Scaled value cannot be represented safely as a number");
  }
  return numeric;
}

/** Round a non-negative integer ratio half-up without using floating point. */
export function divideAndRoundHalfUp(
  numerator: bigint,
  denominator: bigint
): bigint {
  if (numerator < BIGINT_ZERO) {
    throw new ExactValueError("Numerator must be non-negative");
  }
  if (denominator <= BIGINT_ZERO) {
    throw new ExactValueError("Denominator must be positive");
  }
  return (numerator + denominator / BIGINT_TWO) / denominator;
}

/**
 * Apply one or more equally scaled non-negative factors and round once at the
 * end. This avoids binary floating point and avoids cumulative per-rule
 * rounding drift.
 */
export function applyScaledFactors(
  value: bigint,
  factors: readonly bigint[],
  factorScaleDigits: number
): bigint {
  if (value < BIGINT_ZERO || factors.some((factor) => factor < BIGINT_ZERO)) {
    throw new ExactValueError("Scaled values and factors must be non-negative");
  }
  if (factors.length === 0) return value;

  const factorScale = scaleForDigits(factorScaleDigits);
  const numerator = factors.reduce(
    (result, factor) => result * factor,
    value
  );
  const denominator = factorScale ** BigInt(factors.length);
  return divideAndRoundHalfUp(numerator, denominator);
}
