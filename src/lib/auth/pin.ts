import {
  createHmac,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

const PIN_PATTERN = /^\d{4,8}$/;
const VERIFIER_PREFIX = "scrypt-v1.";
const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = {
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export class PinConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinConfigurationError";
  }
}

export class InvalidPinError extends Error {
  constructor() {
    super("PIN must contain between 4 and 8 digits");
    this.name = "InvalidPinError";
  }
}

function getPinPepper(): string {
  const pepper = process.env.AUTH_PIN_PEPPER || process.env.AUTH_SECRET;

  if (!pepper) {
    if (process.env.NODE_ENV === "production") {
      throw new PinConfigurationError("Staff PIN pepper is not configured");
    }
    return "restaurant-development-pin-pepper-change-before-production";
  }

  if (process.env.NODE_ENV === "production" && pepper.length < 32) {
    throw new PinConfigurationError(
      "Staff PIN pepper must be at least 32 characters"
    );
  }

  return pepper;
}

function deriveKey(material: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      material,
      salt,
      KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      }
    );
  });
}

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function isSecurePinVerifier(value: string): boolean {
  if (!value.startsWith(VERIFIER_PREFIX)) return false;
  const encoded = value.slice(VERIFIER_PREFIX.length);
  return /^[A-Za-z0-9_-]{43}$/.test(encoded);
}

/**
 * Creates a deterministic, memory-hard verifier suitable for indexed lookup.
 *
 * Staff PINs have very low entropy, so the application combines scrypt with a
 * deployment-only pepper. A stolen database is not enough to test PIN guesses.
 * The verifier is deterministic because PINs must remain unique and login must
 * locate one employee without scanning every employee row.
 */
export async function createPinVerifier(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new InvalidPinError();

  const pepper = getPinPepper();
  const material = createHmac("sha256", pepper)
    .update(`restaurant:staff-pin:${pin}`)
    .digest();
  const salt = createHmac("sha256", pepper)
    .update("restaurant:staff-pin:scrypt-salt:v1")
    .digest()
    .subarray(0, 16);
  const derivedKey = await deriveKey(material, salt);

  return `${VERIFIER_PREFIX}${derivedKey.toString("base64url")}`;
}

export async function pinMatchesVerifier(
  pin: string,
  verifier: string
): Promise<boolean> {
  if (!isValidPin(pin) || !isSecurePinVerifier(verifier)) return false;

  const expected = Buffer.from(
    verifier.slice(VERIFIER_PREFIX.length),
    "base64url"
  );
  const actual = Buffer.from(
    (await createPinVerifier(pin)).slice(VERIFIER_PREFIX.length),
    "base64url"
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
