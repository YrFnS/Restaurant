export const CURRENCY_MINOR_DIGITS = 2;
export const RATE_MICRO_DIGITS = 6;
export const BASIS_POINT_DIGITS = 2;
export const UNIT_COST_MICRO_DIGITS = 6;

export class ExactValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExactValueError";
  }
}

function scaleForDigits(scaleDigits: number): bigint {
  if (!Number.isInteger(scaleDigits) || scaleDigits < 0 || scaleDigits > 12) {
    throw new ExactValueError("Scale digits must be an integer between 0 and 12");
  }
  return 10n ** BigInt(scaleDigits);
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
    result += 1n;
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
  if (value < 0n) {
    throw new ExactValueError("Value must be non-negative");
  }

  const scale = scaleForDigits(scaleDigits);
  if (scaleDigits === 0) return value.toString();

  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(scaleDigits, "0");
  return `${whole}.${fraction}`;
}

export function scaledIntegerToSafeNumber(
  value: bigint,
  scaleDigits: number
): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ExactValueError("Scaled value cannot be represented safely as a number");
  }

  const numeric = Number(formatScaledInteger(value, scaleDigits));
  if (!Number.isFinite(numeric)) {
    throw new ExactValueError("Scaled value cannot be represented safely as a number");
  }
  return numeric;
}
