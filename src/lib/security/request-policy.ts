export type BrowserMutationDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 415;
      code: "CROSS_SITE_REQUEST_BLOCKED" | "ORIGIN_NOT_ALLOWED" | "UNSUPPORTED_MEDIA_TYPE";
      message: string;
    };

export interface BrowserMutationMetadata {
  method: string;
  requestOrigin: string;
  originHeader?: string | null;
  fetchSite?: string | null;
  contentType?: string | null;
  hasBody?: boolean;
  allowedOrigins?: readonly string[];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value?: string | null): string[] {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter((origin): origin is string => Boolean(origin))
    )
  );
}

export function evaluateBrowserMutation(
  metadata: BrowserMutationMetadata
): BrowserMutationDecision {
  const method = metadata.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return { allowed: true };

  const fetchSite = metadata.fetchSite?.trim().toLowerCase() || null;
  if (fetchSite === "cross-site") {
    return {
      allowed: false,
      status: 403,
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "Cross-site state-changing requests are not allowed",
    };
  }

  const requestOrigin = normalizeOrigin(metadata.requestOrigin);
  if (!requestOrigin) {
    return {
      allowed: false,
      status: 403,
      code: "ORIGIN_NOT_ALLOWED",
      message: "The request origin is invalid",
    };
  }

  if (metadata.originHeader) {
    const suppliedOrigin = normalizeOrigin(metadata.originHeader);
    const allowedOrigins = new Set([
      requestOrigin,
      ...(metadata.allowedOrigins || [])
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin)),
    ]);

    if (!suppliedOrigin || !allowedOrigins.has(suppliedOrigin)) {
      return {
        allowed: false,
        status: 403,
        code: "ORIGIN_NOT_ALLOWED",
        message: "The request origin is not allowed",
      };
    }
  } else if (fetchSite && !TRUSTED_FETCH_SITES.has(fetchSite)) {
    return {
      allowed: false,
      status: 403,
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "The browser request context is not allowed",
    };
  }

  if (
    metadata.hasBody &&
    ["POST", "PUT", "PATCH"].includes(method) &&
    !metadata.contentType?.toLowerCase().startsWith("application/json")
  ) {
    return {
      allowed: false,
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "State-changing API requests with a body must use application/json",
    };
  }

  return { allowed: true };
}
