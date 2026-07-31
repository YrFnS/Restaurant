import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  exactBasisPointsToPercent,
  exactMinorToCents,
  exactMinorToNumber,
  exactRateMicrosToNumber,
  readExactMenuItemPrices,
  readExactModifierOptionPrices,
  readExactPricingRuleMultipliers,
  readExactPromoBasisPoints,
  readExactRestaurantPricingSettings,
} from "@/lib/money/exact-store";
import {
  applyScaledFactors,
  BASIS_POINT_DIGITS,
  CURRENCY_MINOR_DIGITS,
  divideAndRoundHalfUp,
  parseNonNegativeDecimalToScaledInteger,
  RATE_MICRO_DIGITS,
  scaleForDigits,
} from "@/lib/money/scaled-integer";

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

const MAX_SAFE_SCALED_INPUT = BigInt(Number.MAX_SAFE_INTEGER);
const RATE_SCALE = scaleForDigits(RATE_MICRO_DIGITS);
const PERCENT_SCALE = scaleForDigits(BASIS_POINT_DIGITS + 2);

function inputToScaledInteger(
  value: number,
  scaleDigits: number,
  configurationCode: string
): bigint {
  if (!Number.isFinite(value)) {
    throw new OrderPricingError(
      "A submitted monetary value is invalid",
      configurationCode,
      400
    );
  }
  try {
    return parseNonNegativeDecimalToScaledInteger(
      String(value),
      scaleDigits,
      MAX_SAFE_SCALED_INPUT
    );
  } catch {
    throw new OrderPricingError(
      "A submitted monetary value is invalid",
      configurationCode,
      400
    );
  }
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

function requiredExactValue(
  map: ReadonlyMap<string, bigint>,
  id: string,
  kind: string
): bigint {
  const value = map.get(id);
  if (value === undefined) {
    throw new OrderPricingError(
      `Exact ${kind} configuration is unavailable`,
      "EXACT_PRICING_NOT_CONFIGURED",
      503,
      { id, kind }
    );
  }
  return value;
}

export async function calculateOrderPricing(
  tx: Prisma.TransactionClient,
  input: OrderRequest,
  now = new Date()
): Promise<OrderPricing> {
  const itemIds = Array.from(new Set(input.items.map((item) => item.menuItemId)));

  const [settings, exactSettings, menuItems, pricingRules] = await Promise.all([
    tx.restaurantSettings.findUnique({
      where: { id: "1" },
      select: { id: true, avgPrepTimeMin: true },
    }),
    readExactRestaurantPricingSettings(tx),
    tx.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        nameEn: true,
        isAvailable: true,
        category: {
          select: { isAvailable: true, stationSlugs: true },
        },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            nameEn: true,
            isRequired: true,
            minSelect: true,
            maxSelect: true,
            options: {
              select: {
                id: true,
                nameEn: true,
                nameAr: true,
                preset: true,
              },
            },
          },
        },
      },
    }),
    tx.dynamicPricing.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  if (!settings || !exactSettings) {
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

  const modifierOptionIds = menuItems.flatMap((item) =>
    item.modifierGroups.flatMap((group) => group.options.map((option) => option.id))
  );
  const [itemPrices, optionPrices, pricingMultipliers] = await Promise.all([
    readExactMenuItemPrices(tx, itemIds),
    readExactModifierOptionPrices(tx, modifierOptionIds),
    readExactPricingRuleMultipliers(
      tx,
      pricingRules.map((rule) => rule.id)
    ),
  ]);

  const activePricingRules = pricingRules.filter((rule) =>
    isRuleActive(rule, now)
  );
  const activeMultiplierMicros = activePricingRules.map((rule) => {
    const multiplier = requiredExactValue(
      pricingMultipliers,
      rule.id,
      "dynamic-pricing multiplier"
    );
    if (multiplier <= BigInt(0) || multiplier > BigInt(10_000_000)) {
      throw new OrderPricingError(
        "A dynamic pricing rule is misconfigured",
        "INVALID_PRICING_RULE",
        503,
        { ruleId: rule.id }
      );
    }
    return multiplier;
  });
  const combinedMultiplierMicros = applyScaledFactors(
    RATE_SCALE,
    activeMultiplierMicros,
    RATE_MICRO_DIGITS
  );
  const dynamicMultiplier = exactRateMicrosToNumber(combinedMultiplierMicros);

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
    let configuredUnitMinor = requiredExactValue(
      itemPrices,
      menuItem.id,
      "menu-item price"
    );

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
        const optionMinor = requiredExactValue(
          optionPrices,
          option.id,
          "modifier-option price"
        );
        configuredUnitMinor += optionMinor;
        selectedOptions.push({
          id: option.id,
          groupId: group.id,
          nameEn: option.nameEn,
          nameAr: option.nameAr,
          price: exactMinorToNumber(optionMinor),
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

    const unitPriceMinor = applyScaledFactors(
      configuredUnitMinor,
      activeMultiplierMicros,
      RATE_MICRO_DIGITS
    );
    const totalPriceMinor = unitPriceMinor * BigInt(requestedLine.quantity);
    const stationSlug =
      menuItem.category.stationSlugs
        .split(",")
        .map((slug) => slug.trim())
        .find(Boolean) || "prep";

    return {
      menuItemId: menuItem.id,
      quantity: requestedLine.quantity,
      unitPriceCents: exactMinorToCents(unitPriceMinor),
      totalPriceCents: exactMinorToCents(totalPriceMinor),
      modifiers: JSON.stringify(selectedOptions),
      notes: requestedLine.notes || null,
      stationSlug,
      course: requestedLine.course,
    };
  });

  const subtotalMinor = lines.reduce(
    (sum, line) => sum + BigInt(line.totalPriceCents),
    BigInt(0)
  );
  const minimumDeliveryOrderMinor = exactSettings.minDeliveryOrderMinor;
  if (
    input.type === "delivery" &&
    subtotalMinor < minimumDeliveryOrderMinor
  ) {
    throw new OrderPricingError(
      `Minimum delivery order is ${exactMinorToNumber(minimumDeliveryOrderMinor)}`,
      "MINIMUM_DELIVERY_ORDER",
      400,
      { minimumDeliveryOrder: exactMinorToNumber(minimumDeliveryOrderMinor) }
    );
  }

  let promoCode: string | null = null;
  let promoDiscountBasisPoints = 0;
  if (input.promoCode) {
    const [promo, exactDiscountBasisPoints] = await Promise.all([
      tx.promoCode.findUnique({
        where: { code: input.promoCode },
        select: {
          code: true,
          isActive: true,
          validFrom: true,
          validUntil: true,
        },
      }),
      readExactPromoBasisPoints(tx, input.promoCode),
    ]);
    if (
      !promo?.isActive ||
      (promo.validFrom && now < promo.validFrom) ||
      (promo.validUntil && now > promo.validUntil) ||
      exactDiscountBasisPoints === null ||
      !Number.isInteger(exactDiscountBasisPoints) ||
      exactDiscountBasisPoints < 0 ||
      exactDiscountBasisPoints > 10_000
    ) {
      throw new OrderPricingError(
        "The promo code is invalid or expired",
        "INVALID_PROMO_CODE",
        400
      );
    }
    promoCode = promo.code;
    promoDiscountBasisPoints = exactDiscountBasisPoints;
  }

  const discountMinor =
    promoDiscountBasisPoints === 0
      ? BigInt(0)
      : divideAndRoundHalfUp(
          subtotalMinor * BigInt(promoDiscountBasisPoints),
          PERCENT_SCALE
        );
  const boundedDiscountMinor =
    discountMinor > subtotalMinor ? subtotalMinor : discountMinor;
  const discountedSubtotalMinor = subtotalMinor - boundedDiscountMinor;
  const taxMinor = divideAndRoundHalfUp(
    discountedSubtotalMinor * exactSettings.taxRateMicros,
    RATE_SCALE
  );
  const deliveryFeeMinor =
    input.type === "delivery" ? exactSettings.deliveryFeeMinor : BigInt(0);
  const tipMinor =
    input.tip.mode === "percent"
      ? divideAndRoundHalfUp(
          discountedSubtotalMinor *
            inputToScaledInteger(
              input.tip.value,
              BASIS_POINT_DIGITS,
              "INVALID_TIP_PERCENT"
            ),
          PERCENT_SCALE
        )
      : input.tip.mode === "amount"
        ? inputToScaledInteger(
            input.tip.value,
            CURRENCY_MINOR_DIGITS,
            "INVALID_TIP_AMOUNT"
          )
        : BigInt(0);
  const totalMinor =
    discountedSubtotalMinor + taxMinor + deliveryFeeMinor + tipMinor;

  return {
    lines,
    subtotalCents: exactMinorToCents(subtotalMinor),
    discountCents: exactMinorToCents(boundedDiscountMinor),
    taxCents: exactMinorToCents(taxMinor),
    deliveryFeeCents: exactMinorToCents(deliveryFeeMinor),
    tipCents: exactMinorToCents(tipMinor),
    totalCents: exactMinorToCents(totalMinor),
    minimumDeliveryOrderCents: exactMinorToCents(minimumDeliveryOrderMinor),
    averagePrepMinutes: settings.avgPrepTimeMin,
    promoCode,
    promoDiscountPercent: exactBasisPointsToPercent(
      promoDiscountBasisPoints
    ),
    dynamicMultiplier,
    activePricingRules: activePricingRules.map((rule) => ({
      id: rule.id,
      nameEn: rule.nameEn,
      nameAr: rule.nameAr,
    })),
  };
}
