const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => {
  const request = input instanceof Request ? input : null;
  const method = (init?.method || request?.method || "GET").toUpperCase();
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const pathname = new URL(rawUrl, "http://127.0.0.1").pathname;

  if (method === "POST" && pathname === "/api/pos/checkout") {
    const headers = new Headers(init?.headers || request?.headers);
    if (!headers.has("idempotency-key")) {
      headers.set(
        "idempotency-key",
        `p1-checkout-compat-${crypto.randomUUID()}`
      );
    }
    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
}) as typeof fetch;
