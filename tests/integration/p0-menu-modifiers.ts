import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.30";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-menu-${crypto.randomUUID()}`);

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

async function login(pin: string): Promise<string> {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  expectStatus(result, 200, "Administrative login");
  const setCookie = result.response.headers.get("set-cookie");
  assert.ok(setCookie, "Login must set a staff session cookie");
  return setCookie.split(";", 1)[0];
}

function minimumForGroup(group: any): number {
  return Math.max(Number(group.minSelect) || 0, group.isRequired ? 1 : 0);
}

function preferredOptions(group: any): any[] {
  return [...(group.options || [])].sort((left, right) => {
    const defaultDifference =
      Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault));
    if (defaultDifference !== 0) return defaultDifference;
    return Number(right.price || 0) - Number(left.price || 0);
  });
}

function requiredSelections(item: any, overriddenGroupId?: string): string[] {
  return (item.modifierGroups || []).flatMap((group: any) => {
    if (group.id === overriddenGroupId) return [];
    const minimum = minimumForGroup(group);
    return preferredOptions(group)
      .slice(0, minimum)
      .map((option: any) => option.id);
  });
}

function orderBody(item: any, modifierOptionIds: string[]) {
  return {
    type: "takeout",
    customerName: "P0 Modifier Guest",
    customerPhone: `+964701${String(Date.now()).slice(-7)}`,
    notes: "Automated modifier validation order",
    tip: { mode: "none" },
    items: [
      {
        menuItemId: item.id,
        quantity: 1,
        modifierOptionIds,
        notes: null,
        course: 1,
      },
    ],
  };
}

async function createOrder(item: any, modifierOptionIds: string[]) {
  return request("/api/orders", {
    method: "POST",
    headers: { "idempotency-key": `p0-menu-order-${crypto.randomUUID()}` },
    body: JSON.stringify(orderBody(item, modifierOptionIds)),
  });
}

async function main() {
  console.log("[p0-menu] loading configured public menu");
  const menuResult = await request("/api/menu");
  expectStatus(menuResult, 200, "Public menu read");
  const menuItems = (menuResult.data?.categories || []).flatMap(
    (category: any) => category.items || []
  );

  const configuredItem = menuItems.find((item: any) => {
    if (!item.isAvailable || !(item.modifierGroups || []).length) return false;
    const hasRequiredGroup = item.modifierGroups.some(
      (group: any) =>
        minimumForGroup(group) > 0 &&
        (group.options || []).length >= minimumForGroup(group)
    );
    const hasOverflowGroup = item.modifierGroups.some(
      (group: any) =>
        (group.options || []).length > Math.max(1, Number(group.maxSelect) || 1)
    );
    return hasRequiredGroup && hasOverflowGroup;
  });
  assert.ok(
    configuredItem,
    "Seed data must contain an available item with required and bounded modifier groups"
  );

  const overflowGroup = configuredItem.modifierGroups.find(
    (group: any) =>
      (group.options || []).length > Math.max(1, Number(group.maxSelect) || 1)
  );
  assert.ok(overflowGroup, "Configured item must provide an overflow-test group");

  console.log("[p0-menu] validating audited administrative menu mutation");
  const adminCookie = await login("1234");
  const originalPrice = Number(configuredItem.price);
  const changedPrice = Math.round((originalPrice + 0.37) * 100) / 100;
  const auditStart = new Date();

  const update = await request(
    `/api/menu/${encodeURIComponent(configuredItem.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ type: "item", price: changedPrice }),
    }
  );
  expectStatus(update, 200, "Authorized menu price update");
  assert.equal(Number(update.data?.item?.price), changedPrice);

  const audit = await db.auditEvent.findFirst({
    where: {
      action: "menu.item.update",
      entityType: "MenuItem",
      entityId: configuredItem.id,
      createdAt: { gte: auditStart },
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, "Menu mutation must create an immutable audit event");
  const metadata = audit.metadata as any;
  assert.equal(Number(metadata?.before?.price), originalPrice);
  assert.equal(Number(metadata?.after?.price), changedPrice);

  const restore = await request(
    `/api/menu/${encodeURIComponent(configuredItem.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ type: "item", price: originalPrice }),
    }
  );
  expectStatus(restore, 200, "Restore original menu price");

  console.log("[p0-menu] validating audited dynamic-pricing creation");
  const pricingAuditStart = new Date();
  const pricingRuleName = `P0 inactive pricing ${crypto.randomUUID().slice(0, 8)}`;
  const pricingRuleCreate = await request("/api/dynamic-pricing", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      nameEn: pricingRuleName,
      nameAr: pricingRuleName,
      type: "surge",
      multiplier: 1.1,
      dayOfWeek: -1,
      startTime: null,
      endTime: null,
      isActive: false,
    }),
  });
  expectStatus(pricingRuleCreate, 201, "Authorized dynamic-pricing creation");
  const pricingRuleId = String(pricingRuleCreate.data?.rule?.id || "");
  assert.ok(pricingRuleId, "Dynamic-pricing creation must return an ID");

  const pricingAudit = await db.auditEvent.findFirst({
    where: {
      action: "dynamic-pricing.create",
      entityType: "DynamicPricing",
      entityId: pricingRuleId,
      createdAt: { gte: pricingAuditStart },
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(pricingAudit, "Dynamic-pricing creation must be audited");
  const pricingMetadata = pricingAudit.metadata as any;
  assert.equal(pricingMetadata?.nameEn, pricingRuleName);
  assert.equal(Number(pricingMetadata?.multiplier), 1.1);
  assert.equal(pricingMetadata?.isActive, false);
  await db.dynamicPricing.delete({ where: { id: pricingRuleId } });

  console.log("[p0-menu] validating required modifier enforcement");
  const missingRequired = await createOrder(configuredItem, []);
  expectStatus(missingRequired, 400, "Order without required modifiers");
  assert.equal(missingRequired.data?.code, "MODIFIER_SELECTION_REQUIRED");

  console.log("[p0-menu] validating modifier maximum enforcement");
  const overflowMaximum = Math.max(1, Number(overflowGroup.maxSelect) || 1);
  const overflowIds = preferredOptions(overflowGroup)
    .slice(0, overflowMaximum + 1)
    .map((option: any) => option.id);
  const tooManyIds = [
    ...requiredSelections(configuredItem, overflowGroup.id),
    ...overflowIds,
  ];
  const tooMany = await createOrder(configuredItem, tooManyIds);
  expectStatus(tooMany, 400, "Order exceeding modifier maximum");
  assert.equal(tooMany.data?.code, "TOO_MANY_MODIFIERS");

  console.log("[p0-menu] validating cross-item modifier ownership");
  const foreignOption = menuItems
    .filter((item: any) => item.id !== configuredItem.id)
    .flatMap((item: any) => item.modifierGroups || [])
    .flatMap((group: any) => group.options || [])[0];
  assert.ok(foreignOption, "Seed data must provide a modifier from another item");

  const validRequiredIds = requiredSelections(configuredItem);
  const optionalGroup = configuredItem.modifierGroups.find((group: any) => {
    const selectedCount = validRequiredIds.filter((id) =>
      (group.options || []).some((option: any) => option.id === id)
    ).length;
    return selectedCount < Math.max(1, Number(group.maxSelect) || 1);
  });
  const optionalOption = optionalGroup
    ? preferredOptions(optionalGroup).find(
        (option: any) => !validRequiredIds.includes(option.id)
      )
    : null;
  const validModifierIds = Array.from(
    new Set([
      ...validRequiredIds,
      ...(optionalOption ? [optionalOption.id] : []),
    ])
  );

  const foreign = await createOrder(configuredItem, [
    ...validModifierIds,
    foreignOption.id,
  ]);
  expectStatus(foreign, 400, "Order with a modifier owned by another item");
  assert.equal(foreign.data?.code, "INVALID_MODIFIER");

  console.log("[p0-menu] placing a valid configured-modifier order");
  const validOrder = await createOrder(configuredItem, validModifierIds);
  expectStatus(validOrder, 201, "Valid configured-modifier order");
  const storedLine = validOrder.data?.order?.items?.[0];
  assert.ok(storedLine, "Created order must contain its configured item");
  const storedModifiers = JSON.parse(String(storedLine.modifiers || "[]"));
  assert.deepEqual(
    new Set(storedModifiers.map((modifier: any) => modifier.id)),
    new Set(validModifierIds),
    "The server must persist exactly the validated modifier selections"
  );
  assert.ok(
    storedModifiers.every(
      (modifier: any) =>
        typeof modifier.nameEn === "string" &&
        typeof modifier.price === "number" &&
        typeof modifier.groupId === "string"
    ),
    "Stored modifiers must be authoritative server snapshots"
  );

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie: adminCookie },
    body: JSON.stringify({}),
  });
  expectStatus(logout, 200, "Administrative logout");

  console.log("[p0-menu] Menu, pricing audit, and modifier assertions passed.");
}

main()
  .catch((error) => {
    console.error("[p0-menu] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
