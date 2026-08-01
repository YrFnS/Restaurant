import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.40";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-kds-config-${crypto.randomUUID()}`);

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("origin", BASE_URL);
    headers.set("sec-fetch-site", "same-origin");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: "manual",
  });
  const raw = await response.text();
  let data: Json = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON ${response.status}: ${raw.slice(0, 400)}`
      );
    }
  }
  return { response, data };
}

function expectStatus(
  result: { response: Response; data: Json },
  expected: number,
  message: string
) {
  assert.equal(
    result.response.status,
    expected,
    `${message}: expected ${expected}, received ${result.response.status} (${JSON.stringify(
      result.data
    )})`
  );
}

async function login(): Promise<string> {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin: "1234" }),
  });
  expectStatus(result, 200, "Administrative login");
  const setCookie = result.response.headers.get("set-cookie");
  assert.ok(setCookie, "Login must set a staff session cookie");
  return setCookie.split(";", 1)[0];
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

async function main() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const stationSlug = `p0-station-${suffix}`;
  const renamedStationSlug = `${stationSlug}-renamed`;
  const screenSlug = `p0-screen-${suffix}`;
  const renamedScreenSlug = `${screenSlug}-renamed`;
  let stationId: string | null = null;
  let screenId: string | null = null;
  const startedAt = new Date(Date.now() - 1_000);

  try {
    const adminCookie = await login();

    console.log("[p0-kds-config] creating an audited station with a durable event");
    const stationCreate = await request("/api/stations", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        name: `P0 Station ${suffix}`,
        slug: stationSlug,
        icon: "ChefHat",
        color: "#123456",
        targetPrepMin: 17,
        sortOrder: 9_000,
        isActive: true,
      }),
    });
    expectStatus(stationCreate, 201, "Create kitchen station");
    stationId = String(stationCreate.data?.station?.id || "");
    assert.ok(stationId, "Station creation must return an ID");

    const [stationCreateAudit, stationCreateEvent] = await Promise.all([
      db.auditEvent.findFirst({
        where: {
          action: "kds.station.create",
          entityType: "KitchenStation",
          entityId: stationId,
        },
      }),
      db.kdsOutboxEvent.findFirst({
        where: {
          eventType: "screen:update",
          payload: { path: ["stationId"], equals: stationId },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    assert.ok(stationCreateAudit, "Station creation must be audited");
    assert.ok(stationCreateEvent, "Station creation must enqueue a KDS event");

    console.log("[p0-kds-config] creating a screen assigned to the station");
    const screenCreate = await request("/api/kitchen-screens", {
      method: "POST",
      headers: { cookie: adminCookie },
      body: JSON.stringify({
        name: `P0 Screen ${suffix}`,
        slug: screenSlug,
        description: "P0 KDS configuration integration test",
        stationFilter: stationSlug,
        screenType: "prep",
        layoutType: "grid",
        autoRefreshSec: 7,
        showCompleted: false,
        maxOrders: 20,
        sortOrder: 9_000,
        isActive: true,
      }),
    });
    expectStatus(screenCreate, 201, "Create kitchen screen");
    screenId = String(screenCreate.data?.screen?.id || "");
    assert.ok(screenId, "Screen creation must return an ID");

    const [screenCreateAudit, screenCreateEvent] = await Promise.all([
      db.auditEvent.findFirst({
        where: {
          action: "kds.screen.create",
          entityType: "KitchenScreen",
          entityId: screenId,
        },
      }),
      db.kdsOutboxEvent.findFirst({
        where: {
          eventType: "screen:update",
          payload: { path: ["screenId"], equals: screenId },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    assert.ok(screenCreateAudit, "Screen creation must be audited");
    assert.ok(screenCreateEvent, "Screen creation must enqueue a KDS event");
    assert.deepEqual(jsonArray(screenCreateEvent.screenSlugs), [screenSlug]);

    console.log("[p0-kds-config] renaming the station and cascading references");
    const stationUpdate = await request(
      `/api/stations/${encodeURIComponent(stationId)}`,
      {
        method: "PATCH",
        headers: { cookie: adminCookie },
        body: JSON.stringify({
          slug: renamedStationSlug,
          targetPrepMin: 19,
        }),
      }
    );
    expectStatus(stationUpdate, 200, "Update kitchen station");
    assert.equal(stationUpdate.data?.station?.slug, renamedStationSlug);

    const screenAfterStationRename = await db.kitchenScreen.findUnique({
      where: { id: screenId },
      select: { stationFilter: true },
    });
    assert.equal(
      screenAfterStationRename?.stationFilter,
      renamedStationSlug,
      "Station slug changes must cascade to exact screen references"
    );

    const stationUpdateAudit = await db.auditEvent.findFirst({
      where: {
        action: "kds.station.update",
        entityType: "KitchenStation",
        entityId: stationId,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(stationUpdateAudit, "Station update must be audited");
    assert.equal((stationUpdateAudit.metadata as any)?.before?.slug, stationSlug);
    assert.equal(
      (stationUpdateAudit.metadata as any)?.after?.slug,
      renamedStationSlug
    );

    console.log("[p0-kds-config] refusing to delete an assigned station");
    const blockedDelete = await request(
      `/api/stations/${encodeURIComponent(stationId)}`,
      {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }
    );
    expectStatus(blockedDelete, 409, "Delete referenced kitchen station");
    assert.equal(blockedDelete.data?.code, "STATION_IN_USE");
    assert.equal(blockedDelete.data?.references?.screens, 1);

    console.log("[p0-kds-config] renaming and auditing the screen");
    const screenUpdate = await request(
      `/api/kitchen-screens/${encodeURIComponent(screenId)}`,
      {
        method: "PATCH",
        headers: { cookie: adminCookie },
        body: JSON.stringify({
          slug: renamedScreenSlug,
          layoutType: "compact",
          stationFilter: renamedStationSlug,
        }),
      }
    );
    expectStatus(screenUpdate, 200, "Update kitchen screen");
    assert.equal(screenUpdate.data?.screen?.slug, renamedScreenSlug);
    assert.equal(screenUpdate.data?.screen?.layoutType, "compact");

    const screenUpdateAudit = await db.auditEvent.findFirst({
      where: {
        action: "kds.screen.update",
        entityType: "KitchenScreen",
        entityId: screenId,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(screenUpdateAudit, "Screen update must be audited");
    assert.equal((screenUpdateAudit.metadata as any)?.before?.slug, screenSlug);
    assert.equal(
      (screenUpdateAudit.metadata as any)?.after?.slug,
      renamedScreenSlug
    );

    const screenUpdateEvent = await db.kdsOutboxEvent.findFirst({
      where: {
        eventType: "screen:update",
        payload: { path: ["screenId"], equals: screenId },
        createdAt: { gte: screenCreateEvent.createdAt },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(screenUpdateEvent, "Screen update must enqueue a KDS event");
    assert.deepEqual(
      new Set(jsonArray(screenUpdateEvent.screenSlugs)),
      new Set([screenSlug, renamedScreenSlug]),
      "Screen slug changes must notify both the old and new screen channels"
    );

    console.log("[p0-kds-config] deleting the screen and then the station");
    const screenDelete = await request(
      `/api/kitchen-screens/${encodeURIComponent(screenId)}`,
      {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }
    );
    expectStatus(screenDelete, 200, "Delete kitchen screen");
    assert.equal(screenDelete.data?.ok, true);

    const stationDelete = await request(
      `/api/stations/${encodeURIComponent(stationId)}`,
      {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }
    );
    expectStatus(stationDelete, 200, "Delete unreferenced kitchen station");
    assert.equal(stationDelete.data?.ok, true);

    const [deletedScreen, deletedStation, screenDeleteAudit, stationDeleteAudit] =
      await Promise.all([
        db.kitchenScreen.findUnique({ where: { id: screenId } }),
        db.kitchenStation.findUnique({ where: { id: stationId } }),
        db.auditEvent.findFirst({
          where: {
            action: "kds.screen.delete",
            entityType: "KitchenScreen",
            entityId: screenId,
          },
        }),
        db.auditEvent.findFirst({
          where: {
            action: "kds.station.delete",
            entityType: "KitchenStation",
            entityId: stationId,
          },
        }),
      ]);
    assert.equal(deletedScreen, null);
    assert.equal(deletedStation, null);
    assert.ok(screenDeleteAudit, "Screen deletion must be audited");
    assert.ok(stationDeleteAudit, "Station deletion must be audited");

    const relatedEvents = await db.kdsOutboxEvent.findMany({
      where: {
        createdAt: { gte: startedAt },
        OR: [
          { payload: { path: ["stationId"], equals: stationId } },
          { payload: { path: ["screenId"], equals: screenId } },
        ],
      },
    });
    assert.ok(
      relatedEvents.length >= 6,
      "Every KDS configuration mutation must leave a durable event"
    );

    console.log("[p0-kds-config] KDS configuration lifecycle assertions passed.");
  } finally {
    if (screenId) {
      await db.kitchenScreen.deleteMany({ where: { id: screenId } });
    }
    if (stationId) {
      await db.menuCategory.updateMany({
        where: {
          OR: [
            { stationSlugs: { contains: stationSlug } },
            { stationSlugs: { contains: renamedStationSlug } },
          ],
        },
        data: { stationSlugs: "" },
      });
      await db.kitchenStation.deleteMany({ where: { id: stationId } });
    }

    const entityIds = [stationId, screenId].filter(
      (value): value is string => Boolean(value)
    );
    if (entityIds.length > 0) {
      await db.auditEvent.deleteMany({
        where: { entityId: { in: entityIds } },
      });
      await db.kdsOutboxEvent.deleteMany({
        where: {
          OR: entityIds.flatMap((id) => [
            { payload: { path: ["stationId"], equals: id } },
            { payload: { path: ["screenId"], equals: id } },
          ]),
        },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("[p0-kds-config] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
