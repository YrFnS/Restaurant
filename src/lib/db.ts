import { PrismaClient } from "@prisma/client";

/**
 * Exact scaled-integer fields are authoritative but must never enter an
 * unreviewed JSON payload because native BigInt is not JSON serializable.
 * Reviewed services opt in with an explicit select or `omit: { field: false }`.
 */
export const exactFinancialFieldOmit = {
  restaurantSettings: {
    taxRateMicros: true,
    deliveryFeeMinor: true,
    minDeliveryOrderMinor: true,
  },
  menuItem: { priceMinor: true },
  modifierOption: { priceMinor: true },
  customer: { totalSpentMinor: true },
  order: {
    subtotalMinor: true,
    taxAmountMinor: true,
    deliveryFeeMinor: true,
    discountAmountMinor: true,
    tipAmountMinor: true,
    totalMinor: true,
  },
  orderItem: {
    unitPriceMinor: true,
    totalPriceMinor: true,
  },
  specialOffer: { discountBasisPoints: true },
  promoCode: { discountBasisPoints: true },
  giftCard: {
    amountMinor: true,
    balanceMinor: true,
  },
  employee: { hourlyWageMinor: true },
  ingredient: { costPerUnitMicros: true },
  purchaseOrder: { totalCostMinor: true },
  cashRegister: { discrepancyApprovalThresholdMinor: true },
  cashRegisterSession: { openingFloatMinor: true },
  cashRegisterClose: {
    expectedCashMinor: true,
    countedCashMinor: true,
    discrepancyMinor: true,
    thresholdMinor: true,
  },
  cashDrawerEntry: { amountMinor: true },
  dynamicPricing: { multiplierMicros: true },
  comboMeal: { priceMinor: true },
} as const;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    omit: exactFinancialFieldOmit,
  });
}

type RestaurantPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: RestaurantPrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
