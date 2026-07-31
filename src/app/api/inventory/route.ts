import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  readIngredientsWithStock,
  resolveQuantityToBaseMicros,
  serializeIngredientStock,
} from "@/lib/inventory/stock-ledger";

const ingredientFields = {
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(40),
  quantity: z.number().min(0).max(1_000_000_000),
  lowThreshold: z.number().min(0).max(1_000_000_000),
  costPerUnit: z.number().min(0).max(1_000_000_000),
  allowNegativeStock: z.boolean().default(false),
  supplier: z.string().trim().max(240).nullable().optional(),
  category: z.string().trim().max(160).nullable().optional(),
};

const createIngredientSchema = z.object(ingredientFields).strict();
const updateIngredientSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    name: ingredientFields.name.optional(),
    unit: ingredientFields.unit.optional(),
    lowThreshold: ingredientFields.lowThreshold.optional(),
    costPerUnit: ingredientFields.costPerUnit.optional(),
    allowNegativeStock: z.boolean().optional(),
    supplier: ingredientFields.supplier,
    category: ingredientFields.category,
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one editable field is required",
  });
const deleteIngredientSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    _delete: z.literal(true),
  })
  .strict();
const wasteSchema = z
  .object({
    type: z.literal("waste"),
    ingredientId: z.string().trim().min(1).max(191),
    ingredientName: z.string().trim().min(1).max(200).optional(),
    quantity: z.number().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40).optional(),
    reason: z.enum([
      "expired",
      "spoiled",
      "burnt",
      "dropped",
      "overportion",
      "other",
    ]),
    notes: z.string().trim().min(1).max(2_000),
  })
  .strict();

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

function unitCostMicros(value: number): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    UNIT_COST_MICRO_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

function movementKey(req: NextRequest, fallback: string): string {
  const submitted = req.headers.get("idempotency-key")?.trim() || "";
  if (submitted && !IDEMPOTENCY_KEY_PATTERN.test(submitted)) {
    throw new InventoryLedgerError(
      "A valid Idempotency-Key header is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  return submitted || fallback;
}

function errorResponse(error: InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const [items, waste, purchaseOrders] = await Promise.all([
      readIngredientsWithStock(db),
      db.wasteLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
      db.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

    return NextResponse.json(
      {
        items: items.map(serializeIngredientStock),
        waste,
        purchaseOrders,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory] Failed to load inventory", error);
    return NextResponse.json(
      { error: "Unable to load inventory", code: "INVENTORY_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const context = auditContextFromRequest(req);

    if (body?.type === "waste") {
      const parsed = wasteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Invalid waste entry",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const key = movementKey(
        req,
        `legacy-waste:${randomUUID().replaceAll("-", "")}`
      );
      const result = await db.$transaction(async (tx) => {
        const ingredient = await readIngredientStock(
          tx,
          parsed.data.ingredientId
        );
        if (!ingredient) {
          throw new InventoryLedgerError(
            "Ingredient not found",
            "INGREDIENT_NOT_FOUND",
            404
          );
        }
        const resolved = await resolveQuantityToBaseMicros(
          tx,
          ingredient.id,
          parsed.data.quantity,
          parsed.data.unit || ingredient.unit
        );

        const waste = await tx.wasteLog.create({
          data: {
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            quantity: Number(resolved.baseQuantityMicros) / 1_000_000,
            reason: parsed.data.reason,
            notes: parsed.data.notes,
            reportedBy: auth.session.id,
          },
        });
        const movement = await createStockMovement(tx, {
          idempotencyKey: key,
          ingredientId: ingredient.id,
          movementType: "waste",
          quantityDeltaMicros: -resolved.baseQuantityMicros,
          unitCostMicros: ingredient.costPerUnitMicros,
          sourceType: "WasteLog",
          sourceId: waste.id,
          sourceLineId: waste.id,
          reasonCode: parsed.data.reason,
          reason: parsed.data.notes,
          actor: auth.session,
          metadata: {
            submittedQuantity: parsed.data.quantity,
            submittedUnit: parsed.data.unit || ingredient.unit,
          },
        });

        if (!movement.replayed) {
          await writeAuditEvent(tx, {
            actor: auth.session,
            action: "inventory.stock.waste",
            entityType: "StockMovement",
            entityId: movement.movement.id,
            context,
            metadata: {
              wasteLogId: waste.id,
              ingredientId: ingredient.id,
              quantityDeltaMicros:
                movement.movement.quantityDeltaMicros.toString(),
              balanceAfterMicros:
                movement.movement.balanceAfterMicros.toString(),
              totalCostMinor: movement.movement.totalCostMinor.toString(),
              reasonCode: parsed.data.reason,
            },
          });
        }

        return { waste, movement };
      });

      return NextResponse.json(
        { waste: result.waste, replayed: result.movement.replayed },
        {
          status: result.movement.replayed ? 200 : 201,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const parsed = createIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid ingredient",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const costPerUnitMicros = unitCostMicros(parsed.data.costPerUnit);
    const item = await db.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: {
          name: parsed.data.name,
          unit: parsed.data.unit,
          quantity: 0,
          lowThreshold: parsed.data.lowThreshold,
          costPerUnit: parsed.data.costPerUnit,
          costPerUnitMicros,
          supplier: parsed.data.supplier || null,
          category: parsed.data.category || null,
        },
        select: { id: true },
      });

      await tx.$executeRaw(Prisma.sql`
        UPDATE "Ingredient"
        SET "allowNegativeStock" = ${parsed.data.allowNegativeStock}
        WHERE "id" = ${created.id}
      `);

      if (parsed.data.quantity > 0) {
        const openingMicros = parseNonNegativeDecimalToScaledInteger(
          String(parsed.data.quantity),
          6,
          BigInt(Number.MAX_SAFE_INTEGER)
        );
        await createStockMovement(tx, {
          idempotencyKey: `ingredient-opening:${created.id}`,
          ingredientId: created.id,
          movementType: "opening_balance",
          quantityDeltaMicros: openingMicros,
          unitCostMicros: costPerUnitMicros,
          sourceType: "Ingredient",
          sourceId: created.id,
          reasonCode: "opening_balance",
          reason: "Opening balance supplied during ingredient creation",
          actor: auth.session,
          metadata: { baseUnit: parsed.data.unit },
        });
      }

      const saved = await readIngredientStock(tx, created.id);
      if (!saved) {
        throw new InventoryLedgerError(
          "Unable to load created ingredient",
          "INGREDIENT_RESULT_MISSING",
          500
        );
      }

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "inventory.ingredient.create",
        entityType: "Ingredient",
        entityId: saved.id,
        context,
        metadata: {
          name: saved.name,
          unit: saved.unit,
          openingQuantityMicros: saved.quantityMicros.toString(),
          lowThreshold: saved.lowThreshold,
          costPerUnitMicros: saved.costPerUnitMicros.toString(),
          allowNegativeStock: saved.allowNegativeStock,
        },
      });

      return saved;
    });

    return NextResponse.json(
      { item: serializeIngredientStock(item) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InventoryLedgerError) return errorResponse(error);
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory] Failed to create inventory record", error);
    return NextResponse.json(
      {
        error: "Unable to create inventory record",
        code: "INVENTORY_CREATE_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const context = auditContextFromRequest(req);

    if (body && Object.prototype.hasOwnProperty.call(body, "quantity")) {
      return NextResponse.json(
        {
          error: "Ingredient quantity is ledger-controlled; create a stock movement",
          code: "DIRECT_QUANTITY_EDIT_DISABLED",
        },
        { status: 409 }
      );
    }

    if (body?._delete === true) {
      const parsed = deleteIngredientSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid delete request", code: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }

      await db.$transaction(async (tx) => {
        const deleted = await tx.ingredient.delete({
          where: { id: parsed.data.id },
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "inventory.ingredient.delete",
          entityType: "Ingredient",
          entityId: deleted.id,
          context,
          metadata: {
            name: deleted.name,
            quantity: deleted.quantity,
            unit: deleted.unit,
          },
        });
      });

      return NextResponse.json({ ok: true });
    }

    const parsed = updateIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid ingredient update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, allowNegativeStock, ...updateData } = parsed.data;
    const costPerUnitMicros =
      updateData.costPerUnit === undefined
        ? null
        : unitCostMicros(updateData.costPerUnit);
    const item = await db.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.ingredient.update({
          where: { id },
          data: {
            ...updateData,
            ...(costPerUnitMicros === null ? {} : { costPerUnitMicros }),
            ...(updateData.supplier !== undefined
              ? { supplier: updateData.supplier || null }
              : {}),
            ...(updateData.category !== undefined
              ? { category: updateData.category || null }
              : {}),
          },
        });
      }
      if (allowNegativeStock !== undefined) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Ingredient"
          SET
            "allowNegativeStock" = ${allowNegativeStock},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${id}
        `);
      }

      const updated = await readIngredientStock(tx, id);
      if (!updated) {
        throw new InventoryLedgerError(
          "Ingredient not found",
          "INGREDIENT_NOT_FOUND",
          404
        );
      }

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "inventory.ingredient.update",
        entityType: "Ingredient",
        entityId: id,
        context,
        metadata: {
          changedFields: [
            ...Object.keys(updateData),
            ...(allowNegativeStock === undefined
              ? []
              : ["allowNegativeStock"]),
          ],
          quantityMicros: updated.quantityMicros.toString(),
          lowThreshold: updated.lowThreshold,
          costPerUnitMicros: updated.costPerUnitMicros.toString(),
          allowNegativeStock: updated.allowNegativeStock,
        },
      });

      return updated;
    });

    return NextResponse.json(
      { item: serializeIngredientStock(item) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InventoryLedgerError) return errorResponse(error);
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error: "Ingredient history or recipes prevent deletion",
          code: "INGREDIENT_HISTORY_EXISTS",
        },
        { status: 409 }
      );
    }
    console.error("[inventory] Failed to update inventory record", error);
    return NextResponse.json(
      {
        error: "Unable to update inventory record",
        code: "INVENTORY_UPDATE_FAILED",
      },
      { status: 500 }
    );
  }
}
