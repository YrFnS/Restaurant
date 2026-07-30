import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createPinVerifier,
  InvalidPinError,
  isSecurePinVerifier,
  isValidPin,
  pinMatchesVerifier,
} from "../../src/lib/auth/pin";

const previousPepper = process.env.AUTH_PIN_PEPPER;

beforeAll(() => {
  process.env.AUTH_PIN_PEPPER =
    "unit-test-pin-pepper-0123456789abcdef0123456789abcdef";
});

afterAll(() => {
  if (previousPepper === undefined) delete process.env.AUTH_PIN_PEPPER;
  else process.env.AUTH_PIN_PEPPER = previousPepper;
});

describe("staff PIN verifier", () => {
  test("accepts only 4 to 8 numeric digits", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("123456789")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  test("creates a deterministic memory-hard verifier without exposing the PIN", async () => {
    const first = await createPinVerifier("4826");
    const second = await createPinVerifier("4826");

    expect(first).toBe(second);
    expect(isSecurePinVerifier(first)).toBe(true);
    expect(first).not.toContain("4826");
  });

  test("matches only the original PIN", async () => {
    const verifier = await createPinVerifier("4826");

    expect(await pinMatchesVerifier("4826", verifier)).toBe(true);
    expect(await pinMatchesVerifier("4827", verifier)).toBe(false);
    expect(await pinMatchesVerifier("bad", verifier)).toBe(false);
  });

  test("rejects invalid PINs before deriving a verifier", async () => {
    await expect(createPinVerifier("12")).rejects.toBeInstanceOf(InvalidPinError);
  });
});