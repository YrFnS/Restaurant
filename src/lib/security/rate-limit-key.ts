import { createHmac } from "node:crypto";

export interface RateLimitDescriptor {
  key: string;
  scope: string;
  windowStart: Date;
  expiresAt: Date;
}

export function createRateLimitDescriptor({
  secret,
  scope,
  identifier,
  windowMs,
  now = new Date(),
}: {
  secret: string;
  scope: string;
  identifier: string;
  windowMs: number;
  now?: Date;
}): RateLimitDescriptor {
  if (secret.length < 16) throw new Error("Rate-limit secret is too short");
  if (!/^[a-z0-9:_-]{1,80}$/i.test(scope)) {
    throw new Error("Rate-limit scope is invalid");
  }
  if (!identifier || identifier.length > 2_000) {
    throw new Error("Rate-limit identifier is invalid");
  }
  if (!Number.isSafeInteger(windowMs) || windowMs < 1_000 || windowMs > 86_400_000) {
    throw new Error("Rate-limit window is invalid");
  }

  const nowMs = now.getTime();
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const expiresAtMs = windowStartMs + windowMs;
  const digest = createHmac("sha256", secret)
    .update(`${scope}\u0000${identifier}\u0000${windowStartMs}`)
    .digest("hex");

  return {
    key: `rl_${digest}`,
    scope,
    windowStart: new Date(windowStartMs),
    expiresAt: new Date(expiresAtMs),
  };
}
