import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  parseNonNegativeDecimalToScaledInteger,
  UNIT_COST_MICRO_DIGITS,
} from "@/lib/money/scaled-integer";
import {
  createStockMovement,
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
  readIngredientStock,
  readStockMovements,
  resolveQuantityToBaseMicros,
  reverseStockMovement,
  serializeIngredientStock,
  serializeStockMovement,
} from "@/lib/inventory/stock-ledger";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);

const movementQuerySchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191).optional(),
    sourceType: z.string().trim().min(1).max(80).optional(),
    sourceId: z.string().trim().min(1).max(191).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict();

const reasonFields = {
  reasonCode: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(2_000),
};

const receiptSchema = z
  .object({
    action: z.literal("receipt"),
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    unitCost: z.number().finite().min(0).max(1_000_000_000).optional(),
    referenceType: z.string().trim().max(80).optional(),
    referenceId: z.string().trim().max(191).optional(),
    ...reasonFields,
  })
  .strict();

const adjustmentSchema = z
  .object({
    action: z.literal("adjustment"),
    direction: z.enum(["in", "out"]),
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    ...reasonFields,
  })
  .strict();

const wasteSchema = z
  .object({
    action: z.literal("waste"),
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    reasonCode: z.enum([
      "expired",
      "spoiled",
      "burnt",
      "dropped",
      "overportion",
      "other",
    ]),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

const reverseSchema = z
  .object({
    action: z.literal("reverse"),
    movementId: z.string().trim().min(1).max(191),
    ...reasonFields,
  })
  .strict();

const movementSchema = z.discriminatedUnion("action", [
  receiptSchema,
  adjustmentSchema,
  wasteSchema,
  reverseSchema,
]);

function idempotencyKey(req: NextRequest): string {
  const key = req.headers.get("idempotency-key")?.trim() || "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new InventoryLedgerError(
      "A valid Idempotency-Key header is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  return key;
}

function unitCostMicros(value: number): bigint {
  try {
    return parseNonNegativeDecimalToScaledInteger(
      String(value),
      UNIT_COST_MICRO_DIGITS,
      MAX_SAFE_SCALED
    );
  } catch {
    throw new InventoryLedgerError(
      "Inventory unit cost is outside the supported range",
      "INVALID_INVENTORY_COST",
      400
    );
  }
}

function errorResponse(error: InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = movementQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid stock movement query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const movements = await readStockMovements(db, parsed.data);
    return NextResponse.json(
      { movements: movements.map(serializeStockMovement) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/movements] Failed to load stock movements", error);
    return NextResponse.json(
      {
        error: "Unable to load stock movements",
        code: "STOCK_MOVEMENTS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const key = idempotencyKey(req);
    const parsed = movementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid stock movement",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      if (parsed.data.action === "reverse") {
        const reversed = await reverseStockMovement(tx, {
          idempotencyKey: key,
          movementId: parsed.data.movementId,
          reasonCode: parsed.data.reasonCode,
          reason: parsed.data.reason,
          actor: auth.session,
        });
        if (!reversed.replayed) {
          await writeAuditEvent(tx, {
            actor: auth.session,
            action: "inventory.stock.reverse",
            entityType: "StockMovement",
            entityId: reversed.movement.id,
            context,
            metadata: {
              reversalOfId: reversed.movement.reversalOfId,
              ingredientId: reversed.movement.ingredientId,
              quantityDeltaMicros:
                reversed.movement.quantityDeltaMicros.toString(),
              balanceAfterMicros:
                reversed.movement.balanceAfterMicros.toString(),
              reasonCode: reversed.movement.reasonCode,
            },
          });
        }
        const ingredient = await readIngredientStock(
          tx,
          reversed.movement.ingredientId
        );
        return {
          movement: reversed.movement,
          ingredient,
          replayed: reversed.replayed,
          waste: null,
        };
      }

      const resolved = await resolveQuantityToBaseMicros(
        tx,
        parsed.data.ingredientId,
        parsed.data.quantity,
        parsed.data.unit
      );

      let movementType:
        | "receipt"
        | "waste"
        | "adjustment_in"
        | "adjustment_out";
      let delta = resolved.baseQuantityMicros;
      let sourceType = "InventoryAdjustment";
      let sourceId: string | null = null;
      let sourceLineId: string | null = null;
      let waste: Awaited<ReturnType<typeof tx.wasteLog.create>> | null = null;
      let snapshotCostMicros = resolved.ingredient.costPerUnitMicros;

      if (parsed.data.action === "receipt") {
        movementType = "receipt";
        sourceType = parsed.data.referenceType || "InventoryReceipt";
        sourceId = parsed.data.referenceId || null;
        if (parsed.data.unitCost !== undefined) {
          snapshotCostMicros = unitCostMicros(parsed.data.unitCost);
        }
      } else if (parsed.data.action === "waste") {
        movementType = "waste";
        delta = -delta;
        sourceType = "WasteLog";
        waste = await tx.wasteLog.create({
          data: {
            ingredientId: resolved.ingredient.id,
            ingredientName: resolved.ingredient.name,
            quantity: Number(resolved.baseQuantityMicros) / 1_000_000,
            reason: parsed.data.reasonCode,
            notes: parsed.data.reason,
            reportedBy: auth.session.id,
          },
        });
        sourceId = waste.id;
        sourceLineId = waste.id;
      } else {
        movementType =
          parsed.data.direction === "in" ? "adjustment_in" : "adjustment_out";
        if (parsed.data.direction === "out") delta = -delta;
      }

      const movement = await createStockMovement(tx, {
        idempotencyKey: key,
        ingredientId: resolved.ingredient.id,
        movementType,
        quantityDeltaMicros: delta,
        unitCostMicros: snapshotCostMicros,
        sourceType,
        sourceId,
        sourceLineId,
        reasonCode: parsed.data.reasonCode,
        reason: parsed.data.reason,
        actor: auth.session,
        metadata: {
          submittedQuantity: parsed.data.quantity,
          submittedUnit: resolved.submittedUnit,
          submittedQuantityMicros:
            resolved.submittedQuantityMicros.toString(),
          baseQuantityMicros: resolved.baseQuantityMicros.toString(),
        },
      });

      if (!movement.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: `inventory.stock.${movementType}`,
          entityType: "StockMovement",
          entityId: movement.movement.id,
          context,
          metadata: {
            ingredientId: movement.movement.ingredientId,
            movementType,
            quantityDeltaMicros:
              movement.movement.quantityDeltaMicros.toString(),
            balanceAfterMicros:
              movement.movement.balanceAfterMicros.toString(),
            unitCostMicros: movement.movement.unitCostMicros.toString(),
            totalCostMinor: movement.movement.totalCostMinor.toString(),
            sourceType: movement.movement.sourceType,
            sourceId: movement.movement.sourceId,
            reasonCode: movement.movement.reasonCode,
          },
        });
      }

      const ingredient = await readIngredientStock(
        tx,
        movement.movement.ingredientId
      );
      return {
        movement: movement.movement,
        ingredient,
        replayed: movement.replayed,
        waste,
      };
    });

    return NextResponse.json(
      {
        movement: serializeStockMovement(result.movement),
        ingredient: result.ingredient
          ? serializeIngredientStock(result.ingredient)
          : null,
        waste: result.waste,
        replayed: result.replayed,
      },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (error instanceof InventoryLedgerError) return errorResponse(error);
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/movements] Failed to create stock movement", error);
    return NextResponse.json(
      {
        error: "Unable to create stock movement",
        code: "STOCK_MOVEMENT_CREATE_FAILED",
      },
      { status: 500 }
    );
  }
}
