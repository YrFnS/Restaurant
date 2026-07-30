const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3003,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/broadcast") {
      const payload = await request.json().catch(() => null);
      console.log("[kds-mock] broadcast", JSON.stringify(payload));
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`[kds-mock] listening on ${server.hostname}:${server.port}`);
