import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  InventoryLedgerError,
  inventoryLedgerErrorFromDatabase,
  readUnitConversions,
  serializeUnitConversion,
  upsertUnitConversion,
} from "@/lib/inventory/stock-ledger";

const querySchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191).optional(),
  })
  .strict();

const conversionSchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191),
    unit: z.string().trim().min(1).max(40),
    toBaseQuantity: z.number().finite().positive().max(1_000_000_000),
  })
  .strict();

function errorResponse(error: InventoryLedgerError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid conversion query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const conversions = await readUnitConversions(
      db,
      parsed.data.ingredientId
    );
    return NextResponse.json(
      { conversions: conversions.map(serializeUnitConversion) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/conversions] Failed to load conversions", error);
    return NextResponse.json(
      {
        error: "Unable to load inventory conversions",
        code: "INVENTORY_CONVERSIONS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = conversionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid unit conversion",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const conversion = await db.$transaction(async (tx) => {
      const saved = await upsertUnitConversion(tx, parsed.data);
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "inventory.unit_conversion.upsert",
        entityType: "IngredientUnitConversion",
        entityId: saved.id,
        context,
        metadata: {
          ingredientId: saved.ingredientId,
          unit: saved.unit,
          toBaseMicros: saved.toBaseMicros.toString(),
        },
      });
      return saved;
    });

    return NextResponse.json(
      { conversion: serializeUnitConversion(conversion) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InventoryLedgerError) return errorResponse(error);
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/conversions] Failed to save conversion", error);
    return NextResponse.json(
      {
        error: "Unable to save inventory conversion",
        code: "INVENTORY_CONVERSION_SAVE_FAILED",
      },
      { status: 500 }
    );
  }
}
