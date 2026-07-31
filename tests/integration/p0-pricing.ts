import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE_URL = (process.env.P0_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SOURCE_IP = "198.51.100.32";

type Json = Record<string, any> | null;

async function request(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; data: Json }> {
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  headers.set("x-forwarded-for", SOURCE_IP);
  headers.set("x-request-id", `p0-pricing-${crypto.randomUUID()}`);

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

function orderBody(
  itemId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    type: "takeout",
    customerName: "P0 Pricing Guest",
    customerPhone: "",
    notes: null,
    tip: { mode: "none" },
    items: [
      {
        menuItemId: itemId,
        quantity: 3,
        modifierOptionIds: [],
        notes: null,
        course: 1,
      },
    ],
    ...overrides,
  };
}

async function quote(
  itemId: string,
  overrides: Record<string, unknown> = {}
) {
  return request("/api/orders/quote", {
    method: "POST",
    body: JSON.stringify(orderBody(itemId, overrides)),
  });
}

function promoCode(prefix: string): string {
  return `${prefix}${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`.toUpperCase();
}

async function main() {
  const settings = await db.restaurantSettings.findUnique({
    where: { id: "1" },
    select: {
      taxRate: true,
      deliveryFee: true,
      minDeliveryOrder: true,
    },
  });
  assert.ok(settings, "Restaurant settings must exist");

  const menuItems = await db.menuItem.findMany({
    where: { isAvailable: true },
    include: {
      category: true,
      modifierGroups: true,
    },
  });
  const item = menuItems.find(
    (candidate) =>
      candidate.category.isAvailable &&
      candidate.modifierGroups.every(
        (group) => Math.max(group.minSelect, group.isRequired ? 1 : 0) === 0
      )
  );
  assert.ok(item, "Seed data must include an available item without required modifiers");

  const originalPrice = item.price;
  const originalRules = await db.dynamicPricing.findMany({
    select: { id: true, isActive: true },
  });
  const createdPromoIds: string[] = [];
  let createdRuleId: string | null = null;

  try {
    await db.$transaction([
      db.restaurantSettings.update({
        where: { id: "1" },
        data: {
          taxRate: 0.075,
          deliveryFee: 1.23,
          minDeliveryOrder: 0,
        },
      }),
      db.menuItem.update({
        where: { id: item.id },
        data: { price: 10.05 },
      }),
      db.dynamicPricing.updateMany({ data: { isActive: false } }),
    ]);

    console.log("[p0-pricing] validating subtotal and tax rounding");
    const base = await quote(item.id);
    expectStatus(base, 200, "Base quote");
    assert.equal(base.data?.quote?.subtotal, 30.15);
    assert.equal(base.data?.quote?.discountAmount, 0);
    assert.equal(base.data?.quote?.taxAmount, 2.26);
    assert.equal(base.data?.quote?.deliveryFee, 0);
    assert.equal(base.data?.quote?.tipAmount, 0);
    assert.equal(base.data?.quote?.total, 32.41);

    console.log("[p0-pricing] validating percentage and amount tip rounding");
    const percentTip = await quote(item.id, {
      tip: { mode: "percent", value: 12.5 },
    });
    expectStatus(percentTip, 200, "Percentage-tip quote");
    assert.equal(percentTip.data?.quote?.tipAmount, 3.77);
    assert.equal(percentTip.data?.quote?.total, 36.18);

    const amountTip = await quote(item.id, {
      tip: { mode: "amount", value: 2.345 },
    });
    expectStatus(amountTip, 200, "Amount-tip quote");
    assert.equal(amountTip.data?.quote?.tipAmount, 2.35);
    assert.equal(amountTip.data?.quote?.total, 34.76);

    console.log("[p0-pricing] validating delivery-fee calculation");
    const delivery = await quote(item.id, {
      type: "delivery",
      customerPhone: "+9647040000000",
      deliveryAddress: "P0 integration delivery address",
    });
    expectStatus(delivery, 200, "Delivery quote");
    assert.equal(delivery.data?.quote?.deliveryFee, 1.23);
    assert.equal(delivery.data?.quote?.total, 33.64);

    console.log("[p0-pricing] validating active promo calculation and rounding");
    const now = new Date();
    const validPromo = await db.promoCode.create({
      data: {
        code: promoCode("P0VALID"),
        discountPercent: 10,
        isActive: true,
        validFrom: new Date(now.getTime() - 60 * 60 * 1_000),
        validUntil: new Date(now.getTime() + 60 * 60 * 1_000),
      },
    });
    createdPromoIds.push(validPromo.id);

    const discounted = await quote(item.id, { promoCode: validPromo.code });
    expectStatus(discounted, 200, "Valid promo quote");
    assert.equal(discounted.data?.quote?.promoCode, validPromo.code);
    assert.equal(discounted.data?.quote?.promoDiscountPercent, 10);
    assert.equal(discounted.data?.quote?.discountAmount, 3.02);
    assert.equal(discounted.data?.quote?.taxAmount, 2.03);
    assert.equal(discounted.data?.quote?.total, 29.16);

    console.log("[p0-pricing] validating inactive, future, and expired promo rejection");
    const invalidPromos = await Promise.all([
      db.promoCode.create({
        data: {
          code: promoCode("P0INACTIVE"),
          discountPercent: 10,
          isActive: false,
        },
      }),
      db.promoCode.create({
        data: {
          code: promoCode("P0FUTURE"),
          discountPercent: 10,
          isActive: true,
          validFrom: new Date(now.getTime() + 60 * 60 * 1_000),
          validUntil: new Date(now.getTime() + 2 * 60 * 60 * 1_000),
        },
      }),
      db.promoCode.create({
        data: {
          code: promoCode("P0EXPIRED"),
          discountPercent: 10,
          isActive: true,
          validFrom: new Date(now.getTime() - 2 * 60 * 60 * 1_000),
          validUntil: new Date(now.getTime() - 60 * 60 * 1_000),
        },
      }),
    ]);
    createdPromoIds.push(...invalidPromos.map((promo) => promo.id));

    for (const invalidPromo of invalidPromos) {
      const result = await quote(item.id, { promoCode: invalidPromo.code });
      expectStatus(result, 400, `Reject promo ${invalidPromo.code}`);
      assert.equal(result.data?.code, "INVALID_PROMO_CODE");
    }

    console.log("[p0-pricing] validating dynamic-price cent rounding");
    const pricingRule = await db.dynamicPricing.create({
      data: {
        nameEn: "P0 deterministic multiplier",
        nameAr: "اختبار تسعير P0",
        type: "surge",
        multiplier: 1.25,
        dayOfWeek: null,
        startTime: null,
        endTime: null,
        isActive: true,
      },
    });
    createdRuleId = pricingRule.id;

    const dynamic = await quote(item.id);
    expectStatus(dynamic, 200, "Dynamic-pricing quote");
    assert.equal(dynamic.data?.quote?.dynamicMultiplier, 1.25);
    assert.ok(
      (dynamic.data?.quote?.activePricingRules || []).some(
        (rule: any) => rule.id === pricingRule.id
      ),
      "Quote must identify the active dynamic-pricing rule"
    );
    assert.equal(dynamic.data?.quote?.subtotal, 37.68);
    assert.equal(dynamic.data?.quote?.taxAmount, 2.83);
    assert.equal(dynamic.data?.quote?.total, 40.51);

    console.log("[p0-pricing] validating minimum delivery order against authoritative subtotal");
    await db.restaurantSettings.update({
      where: { id: "1" },
      data: { minDeliveryOrder: 40 },
    });
    const belowMinimum = await quote(item.id, {
      type: "delivery",
      customerPhone: "+9647040000001",
      deliveryAddress: "P0 minimum-order address",
    });
    expectStatus(belowMinimum, 400, "Below-minimum delivery quote");
    assert.equal(belowMinimum.data?.code, "MINIMUM_DELIVERY_ORDER");

    console.log("[p0-pricing] Pricing, promo, and rounding assertions passed.");
  } finally {
    await db.$transaction(async (tx) => {
      if (createdPromoIds.length > 0) {
        await tx.promoCode.deleteMany({
          where: { id: { in: createdPromoIds } },
        });
      }
      if (createdRuleId) {
        await tx.dynamicPricing.delete({ where: { id: createdRuleId } });
      }
      await tx.restaurantSettings.update({
        where: { id: "1" },
        data: settings,
      });
      await tx.menuItem.update({
        where: { id: item.id },
        data: { price: originalPrice },
      });
      for (const rule of originalRules) {
        await tx.dynamicPricing.update({
          where: { id: rule.id },
          data: { isActive: rule.isActive },
        });
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("[p0-pricing] Test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
