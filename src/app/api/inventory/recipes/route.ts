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
  publishRecipeVersion,
  readRecipes,
  serializeRecipe,
} from "@/lib/inventory/stock-ledger";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const querySchema = z
  .object({
    menuItemId: z.string().trim().min(1).max(191).optional(),
    includeSuperseded: z.enum(["true", "false"]).default("false"),
  })
  .strict();

const componentSchema = z
  .object({
    ingredientId: z.string().trim().min(1).max(191),
    quantity: z.number().finite().positive().max(1_000_000_000),
    unit: z.string().trim().min(1).max(40),
    modifierOptionId: z.string().trim().min(1).max(191).nullable().optional(),
  })
  .strict();

const recipeSchema = z
  .object({
    menuItemId: z.string().trim().min(1).max(191),
    yieldQuantity: z.number().finite().positive().max(1_000_000).default(1),
    components: z.array(componentSchema).min(1).max(200),
  })
  .strict();

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
      { error: "Invalid recipe query", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const recipes = await readRecipes(db, {
      menuItemId: parsed.data.menuItemId,
      includeSuperseded: parsed.data.includeSuperseded === "true",
    });
    return NextResponse.json(
      { recipes: recipes.map(serializeRecipe) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/recipes] Failed to load recipes", error);
    return NextResponse.json(
      { error: "Unable to load recipes", code: "RECIPES_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const creationKey = idempotencyKey(req);
    const parsed = recipeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid recipe",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const published = await publishRecipeVersion(tx, {
        creationKey,
        menuItemId: parsed.data.menuItemId,
        yieldQuantity: parsed.data.yieldQuantity,
        components: parsed.data.components,
        actor: auth.session,
      });

      if (!published.replayed) {
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "inventory.recipe.publish",
          entityType: "Recipe",
          entityId: published.recipe.id,
          context,
          metadata: {
            menuItemId: published.recipe.menuItemId,
            version: published.recipe.version,
            yieldMicros: published.recipe.yieldMicros.toString(),
            componentCount: published.recipe.components.length,
            components: published.recipe.components.map((component) => ({
              ingredientId: component.ingredientId,
              modifierOptionId: component.modifierOptionId,
              quantityMicros: component.quantityMicros.toString(),
            })),
          },
        });
      }
      return published;
    });

    return NextResponse.json(
      { recipe: serializeRecipe(result.recipe), replayed: result.replayed },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (error instanceof InventoryLedgerError) return errorResponse(error);
    const mapped = inventoryLedgerErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[inventory/recipes] Failed to publish recipe", error);
    return NextResponse.json(
      { error: "Unable to publish recipe", code: "RECIPE_PUBLISH_FAILED" },
      { status: 500 }
    );
  }
}
