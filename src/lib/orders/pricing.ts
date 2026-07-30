import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

const modifierIdsSchema = z
  .array(z.string().trim().min(1).max(191))
  .max(100)
  .default([])
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Modifier option IDs must be unique within an order line",
  });

const orderLineSchema = z
  .object({
    menuItemId: z.string().trim().min(1).max(191),
    quantity: z.number().int().min(1).max(50),
    modifierOptionIds: modifierIdsSchema,
    notes: z.string().trim().max(1_000).nullable().optional(),
    course: z.number().int().min(1).max(20).default(1),
  })
  .strict();

const tipSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }).strict(),
  z
    .object({
      mode: z.literal("percent"),
      value: z.number().min(0).max(100),
    })
    .strict(),
  z
    .object({
      mode: z.literal("amount"),
      value: z.number().min(0).max(1_000_000),
    })
    .strict(),
]);

const tableNumberSchema = z
  .union([
    z.number().int().positive(),
    z.string().trim().regex(/^\d{1,9}$/).transform(Number),
  ])
  .optional();

export const orderRequestSchema = z
  .object({
    type: z.enum(["dine_in", "takeout", "delivery"]),
    customerName: z.string().trim().max(160).default(""),
    customerPhone: z.string().trim().max(40).default(""),
    deliveryAddress: z.string().trim().max(1_000).nullable().optional(),
    tableNumber: tableNumberSchema,
    notes: z.string().trim().max(2_000).nullable().optional(),
    promoCode: z
      .string()
      .trim()
      .max(80)
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
    tip: tipSchema.default({ mode: "none" }),
    items: z.array(orderLineSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "dine_in" && value.tableNumber === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message: "A table number is required for dine-in orders",
      });
    }
    if (value.type === "delivery" && !value.deliveryAddress) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "A delivery address is required",
      });
    }
    if (value.type === "delivery" && !value.customerPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "A customer phone number is required for delivery",
      });
    }
  });

export type OrderRequest = z.infer<typeof orderRequestSchema>;

export class OrderPricingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    status = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "OrderPricingError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type PricedOrderLine = {
  menuItemId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  modifiers: string;
  notes: string | null;
  stationSlug: string;
  course: number;
};

export type OrderPricing = {
  lines: PricedOrderLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  tipCents: number;
  totalCents: number;
  minimumDeliveryOrderCents: number;
  averagePrepMinutes: number;
  promoCode: string | null;
  promoDiscountPercent: number;
  dynamicMultiplier: number;
  activePricingRules: Array<{ id: string; nameEn: string; nameAr: string }>;
};

function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new OrderPricingError(
      "A configured price is invalid",
      "INVALID_PRICE_CONFIGURATION",
      503
    );
  }
  return Math.round(value * 100);
}

export function fromCents(value: number): number {
  return value / 100;
}

function isRuleActive(
  rule: {
    dayOfWeek: number | null;
    startTime: string | null;
    endTime: string | null;
  },
  now: Date
): boolean {
  const dayOfWeek = now.getDay();
  if (
    rule.dayOfWeek !== null &&
    rule.dayOfWeek !== -1 &&
    rule.dayOfWeek !== dayOfWeek
  ) {
    return false;
  }

  if (rule.startTime && rule.endTime) {
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    if (rule.startTime <= rule.endTime) {
      return hhmm >= rule.startTime && hhmm < rule.endTime;
    }
    return hhmm >= rule.startTime || hhmm < rule.endTime;
  }

  return true;
}

export async function calculateOrderPricing(
  tx: Prisma.TransactionClient,
  input: OrderRequest,
  now = new Date()
): Promise<OrderPricing> {
  const itemIds = Array.from(new Set(input.items.map((item) => item.menuItemId)));

  const [settings, menuItems, pricingRules] = await Promise.all([
    tx.restaurantSettings.findUnique({ where: { id: "1" } }),
    tx.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        category: true,
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: { options: true },
        },
      },
    }),
    tx.dynamicPricing.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!settings) {
    throw new OrderPricingError(
      "Restaurant settings are not configured",
      "SETTINGS_NOT_CONFIGURED",
      503
    );
  }

  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  const missingItemIds = itemIds.filter((id) => !menuItemMap.has(id));
  if (missingItemIds.length > 0) {
    throw new OrderPricingError(
      "One or more menu items no longer exist",
      "MENU_ITEM_NOT_FOUND",
      409,
      { menuItemIds: missingItemIds }
    );
  }

  const activePricingRules = pricingRules.filter((rule) =>
    isRuleActive(rule, now)
  );
  const dynamicMultiplier = activePricingRules.reduce((result, rule) => {
    if (
      !Number.isFinite(rule.multiplier) ||
      rule.multiplier <= 0 ||
      rule.multiplier > 10
    ) {
      throw new OrderPricingError(
        "A dynamic pricing rule is misconfigured",
        "INVALID_PRICING_RULE",
        503,
        { ruleId: rule.id }
      );
    }
    return result * rule.multiplier;
  }, 1);

  const lines: PricedOrderLine[] = input.items.map((requestedLine) => {
    const menuItem = menuItemMap.get(requestedLine.menuItemId)!;
    if (!menuItem.isAvailable || !menuItem.category.isAvailable) {
      throw new OrderPricingError(
        `${menuItem.nameEn} is currently unavailable`,
        "MENU_ITEM_UNAVAILABLE",
        409,
        { menuItemId: menuItem.id }
      );
    }

    const selectedIds = new Set(requestedLine.modifierOptionIds);
    const knownOptionIds = new Set<string>();
    const selectedOptions: Array<{
      id: string;
      groupId: string;
      nameEn: string;
      nameAr: string;
      price: number;
      preset: string;
    }> = [];

    for (const group of menuItem.modifierGroups) {
      const selectedForGroup = group.options.filter((option) => {
        knownOptionIds.add(option.id);
        return selectedIds.has(option.id);
      });
      const minimum = Math.max(group.minSelect, group.isRequired ? 1 : 0);
      const maximum = Math.max(1, group.maxSelect);

      if (selectedForGroup.length < minimum) {
        throw new OrderPricingError(
          `Select at least ${minimum} option(s) for ${group.nameEn}`,
          "MODIFIER_SELECTION_REQUIRED",
          400,
          { menuItemId: menuItem.id, groupId: group.id }
        );
      }
      if (selectedForGroup.length > maximum) {
        throw new OrderPricingError(
          `Select no more than ${maximum} option(s) for ${group.nameEn}`,
          "TOO_MANY_MODIFIERS",
          400,
          { menuItemId: menuItem.id, groupId: group.id }
        );
      }

      selectedForGroup.forEach((option) => {
        selectedOptions.push({
          id: option.id,
          groupId: group.id,
          nameEn: option.nameEn,
          nameAr: option.nameAr,
          price: fromCents(toCents(option.price)),
          preset: option.preset,
        });
      });
    }

    const unknownOptionIds = requestedLine.modifierOptionIds.filter(
      (id) => !knownOptionIds.has(id)
    );
    if (unknownOptionIds.length > 0) {
      throw new OrderPricingError(
        "A selected modifier does not belong to this menu item",
        "INVALID_MODIFIER",
        400,
        { menuItemId: menuItem.id, modifierOptionIds: unknownOptionIds }
      );
    }

    const configuredUnitCents =
      toCents(menuItem.price) +
      selectedOptions.reduce((sum, option) => sum + toCents(option.price), 0);
    const unitPriceCents = Math.max(
      0,
      Math.round(configuredUnitCents * dynamicMultiplier)
    );
    const totalPriceCents = unitPriceCents * requestedLine.quantity;
    const stationSlug =
      menuItem.category.stationSlugs
        .split(",")
        .map((slug) => slug.trim())
        .find(Boolean) || "prep";

    return {
      menuItemId: menuItem.id,
      quantity: requestedLine.quantity,
      unitPriceCents,
      totalPriceCents,
      modifiers: JSON.stringify(selectedOptions),
      notes: requestedLine.notes || null,
      stationSlug,
      course: requestedLine.course,
    };
  });

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.totalPriceCents,
    0
  );
  const minimumDeliveryOrderCents = toCents(settings.minDeliveryOrder);
  if (
    input.type === "delivery" &&
    subtotalCents < minimumDeliveryOrderCents
  ) {
    throw new OrderPricingError(
      `Minimum delivery order is ${fromCents(minimumDeliveryOrderCents)}`,
      "MINIMUM_DELIVERY_ORDER",
      400,
      { minimumDeliveryOrder: fromCents(minimumDeliveryOrderCents) }
    );
  }

  let promoCode: string | null = null;
  let promoDiscountPercent = 0;
  if (input.promoCode) {
    const promo = await tx.promoCode.findUnique({
      where: { code: input.promoCode },
    });
    if (
      !promo?.isActive ||
      (promo.validFrom && now < promo.validFrom) ||
      (promo.validUntil && now > promo.validUntil) ||
      !Number.isFinite(promo.discountPercent) ||
      promo.discountPercent < 0 ||
      promo.discountPercent > 100
    ) {
      throw new OrderPricingError(
        "The promo code is invalid or expired",
        "INVALID_PROMO_CODE",
        400
      );
    }
    promoCode = promo.code;
    promoDiscountPercent = promo.discountPercent;
  }

  const discountCents = Math.min(
    subtotalCents,
    Math.round((subtotalCents * promoDiscountPercent) / 100)
  );
  const discountedSubtotalCents = subtotalCents - discountCents;
  const taxCents = Math.max(
    0,
    Math.round(discountedSubtotalCents * settings.taxRate)
  );
  const deliveryFeeCents =
    input.type === "delivery" ? toCents(settings.deliveryFee) : 0;
  const tipCents =
    input.tip.mode === "percent"
      ? Math.round((discountedSubtotalCents * input.tip.value) / 100)
      : input.tip.mode === "amount"
        ? toCents(input.tip.value)
        : 0;
  const totalCents = Math.max(
    0,
    discountedSubtotalCents + taxCents + deliveryFeeCents + tipCents
  );

  return {
    lines,
    subtotalCents,
    discountCents,
    taxCents,
    deliveryFeeCents,
    tipCents,
    totalCents,
    minimumDeliveryOrderCents,
    averagePrepMinutes: settings.avgPrepTimeMin,
    promoCode,
    promoDiscountPercent,
    dynamicMultiplier,
    activePricingRules: activePricingRules.map((rule) => ({
      id: rule.id,
      nameEn: rule.nameEn,
      nameAr: rule.nameAr,
    })),
  };
}
