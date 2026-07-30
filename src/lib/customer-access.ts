import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type CustomerResourceKind = "reservation" | "waitlist";

const TOKEN_PREFIX = "cr1";

export class CustomerAccessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerAccessConfigurationError";
  }
}

function getCustomerAccessSecret(): string {
  const secret =
    process.env.AUTH_CUSTOMER_ACCESS_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new CustomerAccessConfigurationError(
        "Customer resource access secret is not configured"
      );
    }
    return "restaurant-development-customer-access-secret-change-before-production";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new CustomerAccessConfigurationError(
      "Customer resource access secret must be at least 32 characters"
    );
  }

  return secret;
}

export function createCustomerAccessToken(
  kind: CustomerResourceKind,
  resourceId: string
): string {
  const signature = createHmac("sha256", getCustomerAccessSecret())
    .update(`restaurant:customer-resource:${kind}:${resourceId}`)
    .digest("base64url");
  return `${TOKEN_PREFIX}.${kind}.${signature}`;
}

export function verifyCustomerAccessToken(
  kind: CustomerResourceKind,
  resourceId: string,
  token: string | null | undefined
): boolean {
  if (!token?.startsWith(`${TOKEN_PREFIX}.${kind}.`)) return false;

  const expected = Buffer.from(createCustomerAccessToken(kind, resourceId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
