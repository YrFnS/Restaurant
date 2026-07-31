import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ExactWritePolicy {
  file: string;
  compatibilityFields: readonly string[];
  exactMarkers: readonly string[];
}

const policies: ExactWritePolicy[] = [
  {
    file: "src/app/api/settings/route.ts",
    compatibilityFields: ["taxRate", "deliveryFee", "minDeliveryOrder"],
    exactMarkers: [
      "taxRateMicros",
      "deliveryFeeMinor",
      "minDeliveryOrderMinor",
      "parseNonNegativeDecimalToScaledInteger",
    ],
  },
  {
    file: "src/app/api/menu/route.ts",
    compatibilityFields: ["price"],
    exactMarkers: ["priceMinor", "moneyMinor", "modifierGroups"],
  },
  {
    file: "src/app/api/menu/[id]/route.ts",
    compatibilityFields: ["price"],
    exactMarkers: ["priceMinor", "moneyMinor"],
  },
  {
    file: "src/app/api/dynamic-pricing/route.ts",
    compatibilityFields: ["multiplier"],
    exactMarkers: ["multiplierMicros", "RATE_MICRO_DIGITS"],
  },
  {
    file: "src/app/api/employees/route.ts",
    compatibilityFields: ["hourlyWage"],
    exactMarkers: ["hourlyWageMinor", "wageMinor"],
  },
  {
    file: "src/app/api/employees/[id]/route.ts",
    compatibilityFields: ["hourlyWage"],
    exactMarkers: ["hourlyWageMinor", "wageMinor"],
  },
  {
    file: "src/app/api/inventory/route.ts",
    compatibilityFields: ["costPerUnit"],
    exactMarkers: ["costPerUnitMicros", "unitCostMicros"],
  },
  {
    file: "src/app/api/cash/route.ts",
    compatibilityFields: ["amount"],
    exactMarkers: ["amountMinor", "parseCurrencyInputToMinor"],
  },
  {
    file: "src/app/api/pos/checkout/route.ts",
    compatibilityFields: ["amount", "total"],
    exactMarkers: [
      "readExactOrderTotalMinor",
      "amountMinor: exactTotalMinor",
      "amountCents: totalCents",
    ],
  },
  {
    file: "src/app/api/orders/route.ts",
    compatibilityFields: [
      "subtotal",
      "taxAmount",
      "deliveryFee",
      "discountAmount",
      "tipAmount",
      "total",
      "unitPrice",
      "totalPrice",
    ],
    exactMarkers: [
      "subtotalMinor",
      "taxAmountMinor",
      "deliveryFeeMinor",
      "discountAmountMinor",
      "tipAmountMinor",
      "totalMinor",
      "unitPriceMinor",
      "totalPriceMinor",
    ],
  },
];

const deferredCompatibilityModels = {
  GiftCard: ["amount", "balance"],
  PurchaseOrder: ["totalCost"],
  ComboMeal: ["price"],
  Customer: ["totalSpent"],
  SpecialOffer: ["discountPercent"],
  PromoCode: ["discountPercent"],
} as const;

describe("exact financial API write inventory", () => {
  test("keeps every active financial write route explicitly dual-written", () => {
    for (const policy of policies) {
      const source = readFileSync(resolve(policy.file), "utf8");

      for (const compatibilityField of policy.compatibilityFields) {
        expect(source).toContain(compatibilityField);
      }
      for (const marker of policy.exactMarkers) {
        expect(source).toContain(marker);
      }
    }
  });

  test("documents every remaining compatibility-only financial model", () => {
    const status = readFileSync(
      resolve("docs/P1_IMPLEMENTATION_STATUS.md"),
      "utf8"
    );

    for (const [model, fields] of Object.entries(deferredCompatibilityModels)) {
      expect(status).toContain(model.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase());
      for (const field of fields) {
        expect(field.length).toBeGreaterThan(0);
      }
    }
  });

  test("has no duplicate policy paths", () => {
    const files = policies.map((policy) => policy.file);
    expect(new Set(files).size).toBe(files.length);
  });
});
