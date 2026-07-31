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

const ingredientFields = {
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(40),
  quantity: z.number().min(0).max(1_000_000_000),
  lowThreshold: z.number().min(0).max(1_000_000_000),
  costPerUnit: z.number().min(0).max(1_000_000_000),
  supplier: z.string().trim().max(240).nullable().optional(),
  category: z.string().trim().max(160).nullable().optional(),
};

const createIngredientSchema = z.object(ingredientFields).strict();
const updateIngredientSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    name: ingredientFields.name.optional(),
    unit: ingredientFields.unit.optional(),
    quantity: ingredientFields.quantity.optional(),
    lowThreshold: ingredientFields.lowThreshold.optional(),
    costPerUnit: ingredientFields.costPerUnit.optional(),
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
    ingredientId: z.string().trim().min(1).max(191).optional(),
    ingredientName: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1_000_000_000),
    reason: z.enum([
      "expired",
      "spoiled",
      "burnt",
      "dropped",
      "overportion",
      "other",
    ]),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

class InsufficientInventoryError extends Error {}

function unitCostMicros(value: number): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    UNIT_COST_MICRO_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export async function GET() {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const [items, waste, purchaseOrders] = await Promise.all([
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
    db.wasteLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.purchaseOrder.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json(
    { items, waste, purchaseOrders },
    { headers: { "Cache-Control": "no-store" } }
  );
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

      const waste = await db.$transaction(async (tx) => {
        let ingredientName = parsed.data.ingredientName;

        if (parsed.data.ingredientId) {
          const ingredient = await tx.ingredient.findUnique({
            where: { id: parsed.data.ingredientId },
            select: { id: true, name: true },
          });
          if (!ingredient) {
            throw new InsufficientInventoryError("Ingredient not found");
          }

          const changed = await tx.ingredient.updateMany({
            where: {
              id: ingredient.id,
              quantity: { gte: parsed.data.quantity },
            },
            data: { quantity: { decrement: parsed.data.quantity } },
          });
          if (changed.count !== 1) {
            throw new InsufficientInventoryError(
              "Waste quantity exceeds available inventory"
            );
          }
          ingredientName = ingredient.name;
        }

        const created = await tx.wasteLog.create({
          data: {
            ingredientId: parsed.data.ingredientId || null,
            ingredientName,
            quantity: parsed.data.quantity,
            reason: parsed.data.reason,
            notes: parsed.data.notes || null,
            reportedBy: auth.session.id,
          },
        });

        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "inventory.waste.create",
          entityType: "WasteLog",
          entityId: created.id,
          context,
          metadata: {
            ingredientId: created.ingredientId,
            ingredientName: created.ingredientName,
            quantity: created.quantity,
            reason: created.reason,
          },
        });

        return created;
      });

      return NextResponse.json({ waste }, { status: 201 });
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
          ...parsed.data,
          costPerUnitMicros,
          supplier: parsed.data.supplier || null,
          category: parsed.data.category || null,
        },
      });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "inventory.ingredient.create",
        entityType: "Ingredient",
        entityId: created.id,
        context,
        metadata: {
          name: created.name,
          unit: created.unit,
          quantity: created.quantity,
          lowThreshold: created.lowThreshold,
          costPerUnit: created.costPerUnit,
          costPerUnitMicros: costPerUnitMicros.toString(),
        },
      });

      return created;
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientInventoryError) {
      return NextResponse.json(
        { error: error.message, code: "INSUFFICIENT_INVENTORY" },
        { status: 409 }
      );
    }

    console.error("[inventory] Failed to create inventory record", error);
    return NextResponse.json(
      { error: "Unable to create inventory record", code: "INVENTORY_CREATE_FAILED" },
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

    const { id, ...updateData } = parsed.data;
    const costPerUnitMicros =
      updateData.costPerUnit === undefined
        ? null
        : unitCostMicros(updateData.costPerUnit);
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.ingredient.update({
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

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "inventory.ingredient.update",
        entityType: "Ingredient",
        entityId: id,
        context,
        metadata: {
          changedFields: Object.keys(updateData),
          quantity: updated.quantity,
          lowThreshold: updated.lowThreshold,
          costPerUnit: updated.costPerUnit,
          ...(costPerUnitMicros === null
            ? {}
            : { costPerUnitMicros: costPerUnitMicros.toString() }),
        },
      });

      return updated;
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[inventory] Failed to update inventory record", error);
    return NextResponse.json(
      { error: "Unable to update inventory record", code: "INVENTORY_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}