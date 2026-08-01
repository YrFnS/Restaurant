import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

const migration = source(
  "prisma/migrations/20260731235960_add_purchase_orders_receiving/migration.sql"
);
const schema = source("prisma/schema.prisma");
const service = source("src/lib/inventory/purchasing.ts");
const stockService = source("src/lib/inventory/stock-ledger-impl.ts");
const supplierRoute = source("src/app/api/suppliers/route.ts");
const ordersRoute = source("src/app/api/purchase-orders/route.ts");
const orderRoute = source("src/app/api/purchase-orders/[id]/route.ts");
const receiptRoute = source(
  "src/app/api/purchase-orders/[id]/receipts/route.ts"
);
const ui = source("src/components/admin/tabs/PurchasingTab.tsx");
const adminShell = source("src/components/admin/AdminShell.tsx");
const packageJson = source("package.json");
const roadmap = source("docs/REMEDIATION_PLAN.md");
const design = source("docs/P1_PURCHASE_ORDERS_RECEIVING.md");

describe("purchase order and receiving source inventory", () => {
  test("commits first-class supplier, line, receipt, and status storage", () => {
    for (const marker of [
      'CREATE TYPE "SupplierStatus"',
      'CREATE TYPE "PurchaseOrderStatus"',
      'CREATE TYPE "PurchaseReceiptStatus"',
      'CREATE TABLE "Supplier"',
      'CREATE TABLE "PurchaseOrderLine"',
      'CREATE TABLE "PurchaseReceipt"',
      'CREATE TABLE "PurchaseReceiptLine"',
      'PurchaseOrder_orderNumber_key',
      'PurchaseOrder_creationKey_key',
      'PurchaseReceipt_idempotencyKey_key',
      'PurchaseReceiptLine_stockMovement_key',
    ]) {
      expect(migration).toContain(marker);
    }
    for (const marker of [
      "enum SupplierStatus",
      "enum PurchaseOrderStatus",
      "enum PurchaseReceiptStatus",
      "model Supplier",
      "model PurchaseOrderLine",
      "model PurchaseReceipt",
      "model PurchaseReceiptLine",
    ]) {
      expect(schema).toContain(marker);
    }
  });

  test("preserves exact commercial and inventory snapshots", () => {
    for (const marker of [
      '"conversionToBaseMicros" BIGINT NOT NULL',
      '"orderedPurchaseQuantityMicros" BIGINT NOT NULL',
      '"orderedBaseQuantityMicros" BIGINT NOT NULL',
      '"receivedBaseQuantityMicros" BIGINT NOT NULL DEFAULT 0',
      '"purchaseUnitCostMicros" BIGINT NOT NULL',
      '"baseUnitCostMicros" BIGINT NOT NULL',
      '"lineTotalMinor" BIGINT NOT NULL',
      '"totalCostMinor" BIGINT NOT NULL',
      '"stockMovementId" TEXT NOT NULL',
    ]) {
      expect(migration).toContain(marker);
    }
    for (const marker of [
      "PURCHASE_TOTAL_DENOMINATOR",
      "prepareDraftLines",
      "conversionToBaseMicros",
      "orderedPurchaseQuantityMicros",
      "baseUnitCostMicros",
      "lineTotalMinor",
      "prepareReceiptLines",
      "totalCostMinor",
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("freezes submitted orders and immutable receipt history", () => {
    for (const marker of [
      'PurchaseOrder_protect_header',
      'PurchaseOrderLine_protect_update',
      'Submitted purchase-order commercial terms are immutable',
      'Submitted purchase-order lines are immutable',
      'PurchaseReceipt_immutable_update',
      'PurchaseReceiptLine_immutable_update',
      'Purchase receipts are immutable',
      'Purchase receipt lines are immutable',
      'Purchase-receipt movements require the purchasing correction workflow',
    ]) {
      expect(migration).toContain(marker);
    }
    expect(stockService).toContain("PURCHASE_RECEIPT_REVERSAL_REQUIRED");
    expect(stockService).toContain('original.sourceType === "PurchaseReceipt"');
  });

  test("serializes idempotent draft, receipt, and correction workflows", () => {
    for (const marker of [
      "lockKey",
      "pg_advisory_xact_lock",
      "createPurchaseOrder",
      "replaceDraftPurchaseOrder",
      "submitPurchaseOrder",
      "cancelPurchaseOrder",
      "postPurchaseReceipt",
      "reversePurchaseReceipt",
      "FOR UPDATE",
      'idempotencyKey: `purchase-receipt:',
      'idempotencyKey: `purchase-receipt-reversal:',
      'sourceType: "PurchaseReceipt"',
      'sourceType: "PurchaseReceiptReversal"',
    ]) {
      expect(service).toContain(marker);
    }
  });

  test("protects all APIs with inventory roles, schemas, audits, and idempotency", () => {
    for (const route of [supplierRoute, ordersRoute, orderRoute, receiptRoute]) {
      expect(route).toContain(
        "requireStaffSession(INVENTORY_MANAGEMENT_ROLES)"
      );
      expect(route).toContain("writeAuditEvent");
    }
    expect(supplierRoute).toContain("createSupplierSchema");
    expect(supplierRoute).toContain("updateSupplierSchema");
    expect(ordersRoute).toContain("createPurchaseOrderSchema");
    expect(ordersRoute).toContain("Idempotency-Key");
    expect(orderRoute).toContain("lifecycleSchema");
    expect(receiptRoute).toContain("receiptMutationSchema");
    expect(receiptRoute).toContain("Idempotency-Key");
    expect(receiptRoute).toContain("purchasing.receipt.post");
    expect(receiptRoute).toContain("purchasing.receipt.reverse");
  });

  test("ships a bilingual purchasing console in the role-aware admin shell", () => {
    for (const marker of [
      'apiFetch("/api/suppliers"',
      'apiFetch("/api/purchase-orders"',
      '"Idempotency-Key"',
      "Purchase orders",
      "أوامر الشراء",
      "New supplier",
      "مورد جديد",
      "Post receipt",
      "تثبيت الاستلام",
      "Purchase receipt reversed",
    ]) {
      expect(ui).toContain(marker);
    }
    expect(adminShell).toContain("PurchasingTab");
    expect(adminShell).toContain('id: "purchasing"');
    expect(adminShell).toContain("INVENTORY_MANAGEMENT_ROLES");
  });

  test("keeps permanent validation and explicit policy documentation", () => {
    expect(packageJson).toContain(
      "bun tests/integration/p1-purchase-orders-receiving.ts"
    );
    expect(roadmap).toContain("P1-B04 Purchase orders");
    expect(roadmap).toContain("P1_PURCHASE_ORDERS_RECEIVING.md");
    expect(roadmap).toContain(
      "P1 suppliers, purchase orders, and partial receiving"
    );
    expect(design).toContain("partial deliveries");
    expect(design).toContain("submitted orders become immutable");
    expect(design).toContain("Generic stock reversal");
    expect(design).toContain("weighted-average, FIFO, or lot valuation");
  });
});
