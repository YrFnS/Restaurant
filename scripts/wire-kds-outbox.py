from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> bool:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return False
    if old not in text:
        raise RuntimeError(f"Expected source fragment not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


def replace_regex_once(path: str, pattern: str, replacement: str) -> bool:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count == 0:
        if replacement.strip() in text:
            return False
        raise RuntimeError(f"Expected regex source fragment not found in {path}: {pattern[:120]!r}")
    target.write_text(updated, encoding="utf-8")
    return True


changed: list[str] = []


def apply(path: str, operation) -> None:
    if operation():
        changed.append(path)


# Public order creation: enqueue the new-order event in the same database
# transaction, then make an immediate best-effort delivery attempt after commit.
path = "src/app/api/orders/route.ts"
apply(
    path,
    lambda: replace_once(
        path,
        'import { broadcastKds, stationSlugsFromItems } from "@/lib/kds/broadcast";',
        'import {\n  flushKdsOutboxBestEffort,\n  queueKdsEvent,\n  resolveKdsScreenSlugs,\n} from "@/lib/kds/outbox";',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """      return created;
    });""",
        """      const targetScreenSlugs = await resolveKdsScreenSlugs(
        tx,
        created.items.map((item) => item.stationSlug)
      );
      await queueKdsEvent(tx, {
        type: "order:new",
        screenSlugs: targetScreenSlugs,
        payload: { orderId: created.id, orderNumber: created.orderNumber },
      });

      return created;
    });""",
    ),
)
apply(
    path,
    lambda: replace_regex_once(
        path,
        r'''\n    try \{\n      const itemStationSlugs = stationSlugsFromItems\(order\.items\);.*?\n    \} catch \(error\) \{\n      console\.warn\("\[orders\] KDS notification failed", error\);\n    \}\n''',
        "\n    await flushKdsOutboxBestEffort(10);\n",
    ),
)

# Administrative order status transitions.
path = "src/app/api/orders/[id]/route.ts"
apply(
    path,
    lambda: replace_once(
        path,
        'import { broadcastKds } from "@/lib/kds/broadcast";',
        'import { flushKdsOutboxBestEffort, queueKdsEvent } from "@/lib/kds/outbox";',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """      return tx.order.findUniqueOrThrow({""",
        """      await queueKdsEvent(tx, {
        type: "order:status",
        screenSlugs: [],
        payload: { orderId: id, status: nextStatus },
      });

      return tx.order.findUniqueOrThrow({""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """    await broadcastKds({
      type: "order:status",
      payload: { orderId: order.id, status: nextStatus },
    });""",
        """    await flushKdsOutboxBestEffort(10);""",
    ),
)

# Direct order-item status transitions.
path = "src/app/api/orders/items/[id]/route.ts"
apply(
    path,
    lambda: replace_once(
        path,
        'import { broadcastKds } from "@/lib/kds/broadcast";',
        'import {\n  flushKdsOutboxBestEffort,\n  queueKdsEvent,\n  resolveKdsScreenSlugs,\n} from "@/lib/kds/outbox";',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """      return updated;
    });""",
        """      const targetScreenSlugs = await resolveKdsScreenSlugs(tx, [
        updated.stationSlug,
      ]);
      await queueKdsEvent(tx, {
        type: "order:update",
        screenSlugs: targetScreenSlugs,
        payload: {
          orderId: existing.orderId,
          itemId: updated.id,
          status: nextStatus,
        },
      });

      return updated;
    });""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """    await broadcastKds({
      type: "order:update",
      payload: {
        orderId: existing.orderId,
        itemId: item.id,
        status: nextStatus,
      },
    });""",
        """    await flushKdsOutboxBestEffort(10);""",
    ),
)

# KDS operation endpoint: both per-item updates and ticket completion enqueue
# durable events before the transaction commits.
path = "src/app/api/kitchen/route.ts"
apply(
    path,
    lambda: replace_once(
        path,
        'import { broadcastKds } from "@/lib/kds/broadcast";',
        'import {\n  flushKdsOutboxBestEffort,\n  queueKdsEvent,\n  resolveKdsScreenSlugs,\n} from "@/lib/kds/outbox";',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """        return updated;
      });""",
        """        const targetScreenSlugs = await resolveKdsScreenSlugs(tx, [
          updated.stationSlug,
        ]);
        await queueKdsEvent(tx, {
          type: "order:update",
          screenSlugs: targetScreenSlugs,
          payload: {
            orderId: existing.orderId,
            itemId: updated.id,
            status: nextStatus,
          },
        });

        return updated;
      });""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """      await broadcastKds({
        type: "order:update",
        payload: {
          orderId: existing.orderId,
          itemId: item.id,
          status: nextStatus,
        },
      });""",
        """      await flushKdsOutboxBestEffort(10);""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """      return tx.order.findUniqueOrThrow({""",
        """      await queueKdsEvent(tx, {
        type: "order:status",
        screenSlugs: [],
        payload: { orderId, status: "completed" },
      });

      return tx.order.findUniqueOrThrow({""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """    await broadcastKds({
      type: "order:status",
      payload: { orderId: order.id, status: "completed" },
    });""",
        """    await flushKdsOutboxBestEffort(10);""",
    ),
)

# Extend the database-backed integration smoke test so outbox regressions fail
# CI rather than silently falling back to polling forever.
path = "tests/integration/p0-smoke.ts"
apply(
    path,
    lambda: replace_once(
        path,
        'import assert from "node:assert/strict";',
        'import assert from "node:assert/strict";\nimport { PrismaClient } from "@prisma/client";',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        'const SOURCE_IP = "198.51.100.27";',
        'const SOURCE_IP = "198.51.100.27";\nconst integrationDb = new PrismaClient();',
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """  logStep("tracking requires the opaque credential and returns a redacted DTO");""",
        """  logStep("durable KDS events are committed with order and status changes");
  const queuedNewOrder = await integrationDb.kdsOutboxEvent.findFirst({
    where: { eventType: "order:new" },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(queuedNewOrder, "Order creation must enqueue a durable KDS event");
  assert.ok(
    JSON.stringify(queuedNewOrder.payload).includes(firstOrder.data.order.id),
    "The durable new-order event must identify the created order"
  );

  const statusUpdate = await api<any>(
    `/api/orders/${encodeURIComponent(firstOrder.data.order.id)}`,
    {
      method: "PATCH",
      headers: { cookie: sessionCookie },
      body: JSON.stringify({ status: "preparing" }),
    }
  );
  assertStatus(statusUpdate.response, 200, "Authorized order status update");

  const firstItemId = firstOrder.data.order.items[0]?.id;
  assert.ok(firstItemId, "Created order must contain an item");
  const itemUpdate = await api<any>(
    `/api/orders/items/${encodeURIComponent(firstItemId)}`,
    {
      method: "PATCH",
      headers: { cookie: sessionCookie },
      body: JSON.stringify({ status: "preparing" }),
    }
  );
  assertStatus(itemUpdate.response, 200, "Authorized order-item status update");

  const queuedStatusEvents = await integrationDb.kdsOutboxEvent.findMany({
    where: { eventType: { in: ["order:status", "order:update"] } },
  });
  assert.ok(
    queuedStatusEvents.some((event) =>
      JSON.stringify(event.payload).includes(firstOrder.data.order.id)
    ),
    "Order and item mutations must enqueue durable KDS events"
  );

  logStep("tracking requires the opaque credential and returns a redacted DTO");""",
    ),
)
apply(
    path,
    lambda: replace_once(
        path,
        """main().catch((error) => {
  console.error("\n[p0-integration] Smoke test failed:", error);
  process.exitCode = 1;
});""",
        """main()
  .catch((error) => {
    console.error("\n[p0-integration] Smoke test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await integrationDb.$disconnect();
  });""",
    ),
)

if changed:
    print("Wired durable KDS outbox into:")
    for file_name in sorted(set(changed)):
        print(f"  - {file_name}")
else:
    print("Durable KDS outbox wiring is already current.")
