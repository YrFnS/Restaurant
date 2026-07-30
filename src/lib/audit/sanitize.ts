const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|passcode|pin|secret|token|verifier|credential)/i;

const MAX_DEPTH = 5;
const MAX_OBJECT_KEYS = 100;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 1_000;

export type SanitizedAuditValue =
  | null
  | boolean
  | number
  | string
  | SanitizedAuditValue[]
  | { [key: string]: SanitizedAuditValue };

function sanitizeString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

export function sanitizeAuditMetadata(
  value: unknown,
  depth = 0
): SanitizedAuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAuditMetadata(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, SanitizedAuditValue> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS
    );

    for (const [key, nestedValue] of entries) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeAuditMetadata(nestedValue, depth + 1);
    }
    return result;
  }

  return String(value);
}
