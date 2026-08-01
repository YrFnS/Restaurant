import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  MENU_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

const mediaPathSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      /^https?:\/\//i.test(value),
    "Image must be empty, a site-relative path, or an HTTP(S) URL"
  );

const categorySchema = z
  .object({
    type: z.literal("category"),
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160),
    icon: z.string().trim().min(1).max(32).default("🍽️"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f59e0b"),
    sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
    stationSlugs: z.string().trim().max(500).default(""),
    isAvailable: z.boolean().default(true),
  })
  .strict();

const modifierOptionSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160),
    price: z.number().min(0).max(1_000_000).default(0),
    isDefault: z.boolean().default(false),
    preset: z.string().trim().max(40).default("none"),
  })
  .strict();

const modifierGroupSchema = z
  .object({
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160),
    isRequired: z.boolean().default(false),
    min: z.number().int().min(0).max(100).default(0),
    max: z.number().int().min(1).max(100).default(1),
    options: z.array(modifierOptionSchema).max(100).default([]),
  })
  .strict()
  .refine((group) => group.min <= group.max, {
    message: "Minimum selections cannot exceed maximum selections",
    path: ["min"],
  });

const menuItemSchema = z
  .object({
    type: z.literal("item").optional(),
    nameEn: z.string().trim().min(1).max(160),
    nameAr: z.string().trim().min(1).max(160),
    descriptionEn: z.string().trim().max(5_000).default(""),
    descriptionAr: z.string().trim().max(5_000).default(""),
    price: z.number().min(0).max(1_000_000),
    image: mediaPathSchema.default(""),
    isAvailable: z.boolean().default(true),
    isPopular: z.boolean().default(false),
    isSpecial: z.boolean().default(false),
    isNew: z.boolean().default(false),
    preparationTime: z.number().int().min(0).max(1_440).default(15),
    calories: z.number().int().min(0).max(100_000).default(0),
    allergens: z.string().trim().max(1_000).default(""),
    dietary: z.string().trim().max(1_000).default(""),
    sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
    categoryId: z.string().trim().min(1).max(191),
    modifierGroups: z.array(modifierGroupSchema).max(50).optional(),
  })
  .strict();

function moneyMinor(value: number): bigint {
  return parseNonNegativeDecimalToScaledInteger(
    String(value),
    CURRENCY_MINOR_DIGITS,
    BigInt(Number.MAX_SAFE_INTEGER)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  if (all) {
    const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
    if ("response" in auth) return auth.response;
  }

  const categories = await db.menuCategory.findMany({
    where: all ? undefined : { isAvailable: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: all ? undefined : { isAvailable: true },
        orderBy: { sortOrder: "asc" },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: { options: true },
          },
        },
      },
    },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const body = await req.json();
    const context = auditContextFromRequest(req);

    if (body?.type === "category") {
      const parsed = categorySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Invalid menu category",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { type: _type, ...categoryData } = parsed.data;
      const category = await db.$transaction(async (tx) => {
        const created = await tx.menuCategory.create({ data: categoryData });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "menu.category.create",
          entityType: "MenuCategory",
          entityId: created.id,
          context,
          metadata: {
            nameEn: created.nameEn,
            nameAr: created.nameAr,
            isAvailable: created.isAvailable,
            stationSlugs: created.stationSlugs,
          },
        });
        return created;
      });

      return NextResponse.json({ category }, { status: 201 });
    }

    const parsed = menuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid menu item",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type: _type, modifierGroups = [], ...itemData } = parsed.data;
    const itemPriceMinor = moneyMinor(itemData.price);
    const item = await db.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: {
          ...itemData,
          priceMinor: itemPriceMinor,
          modifierGroups: {
            create: modifierGroups.map((group, groupIndex) => ({
              nameEn: group.nameEn,
              nameAr: group.nameAr,
              isRequired: group.isRequired,
              minSelect: group.min,
              maxSelect: group.max,
              sortOrder: groupIndex,
              options: {
                create: group.options.map((option) => ({
                  nameEn: option.nameEn,
                  nameAr: option.nameAr,
                  price: option.price,
                  priceMinor: moneyMinor(option.price),
                  isDefault: option.isDefault,
                  preset: option.preset,
                })),
              },
            })),
          },
        },
        include: {
          modifierGroups: { include: { options: true } },
        },
      });

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "menu.item.create",
        entityType: "MenuItem",
        entityId: created.id,
        context,
        metadata: {
          nameEn: created.nameEn,
          nameAr: created.nameAr,
          categoryId: created.categoryId,
          price: created.price,
          priceMinor: itemPriceMinor.toString(),
          isAvailable: created.isAvailable,
          modifierGroupCount: created.modifierGroups.length,
        },
      });

      return created;
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[menu] Failed to create menu record", error);
    return NextResponse.json(
      { error: "Unable to create menu record", code: "MENU_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
