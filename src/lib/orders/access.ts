import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "oa1.";

export class OrderAccessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderAccessConfigurationError";
  }
}

function getOrderAccessSecret(): string {
  const secret = process.env.AUTH_ORDER_ACCESS_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new OrderAccessConfigurationError(
        "Order access token secret is not configured"
      );
    }
    return "restaurant-development-order-access-secret-change-before-production";
  }

  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new OrderAccessConfigurationError(
      "Order access token secret must be at least 32 characters"
    );
  }

  return secret;
}

export function createOrderAccessToken(orderId: string): string {
  const signature = createHmac("sha256", getOrderAccessSecret())
    .update(`restaurant:order-access:${orderId}`)
    .digest("base64url");
  return `${TOKEN_PREFIX}${signature}`;
}

export function verifyOrderAccessToken(
  orderId: string,
  token: string | null | undefined
): boolean {
  if (!token?.startsWith(TOKEN_PREFIX)) return false;

  const expected = Buffer.from(createOrderAccessToken(orderId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function orderIdFromIdempotencyKey(key: string): string {
  const digest = createHash("sha256")
    .update(`restaurant:order-idempotency:${key}`)
    .digest("hex")
    .slice(0, 32);
  return `ord_${digest}`;
}
