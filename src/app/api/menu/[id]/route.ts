import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  MENU_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";

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

const categoryUpdateSchema = z
  .object({
    type: z.literal("category"),
    nameEn: z.string().trim().min(1).max(160).optional(),
    nameAr: z.string().trim().min(1).max(160).optional(),
    icon: z.string().trim().min(1).max(32).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
    stationSlugs: z.string().trim().max(500).optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

const itemUpdateSchema = z
  .object({
    type: z.literal("item").optional(),
    nameEn: z.string().trim().min(1).max(160).optional(),
    nameAr: z.string().trim().min(1).max(160).optional(),
    descriptionEn: z.string().trim().max(5_000).optional(),
    descriptionAr: z.string().trim().max(5_000).optional(),
    price: z.number().min(0).max(1_000_000).optional(),
    image: mediaPathSchema.optional(),
    isAvailable: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    isSpecial: z.boolean().optional(),
    isNew: z.boolean().optional(),
    preparationTime: z.number().int().min(0).max(1_440).optional(),
    calories: z.number().int().min(0).max(100_000).optional(),
    allergens: z.string().trim().max(1_000).optional(),
    dietary: z.string().trim().max(1_000).optional(),
    sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
    categoryId: z.string().trim().min(1).max(191).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "type"),
    "At least one editable field is required"
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();

    if (body?.type === "category") {
      const parsed = categoryUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Invalid menu category update",
            code: "VALIDATION_ERROR",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { type: _type, ...data } = parsed.data;
      const category = await db.menuCategory.update({ where: { id }, data });
      return NextResponse.json({ category });
    }

    const parsed = itemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid menu item update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type: _type, ...data } = parsed.data;
    const item = await db.menuItem.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[menu] Failed to update menu record", error);
    return NextResponse.json(
      { error: "Unable to update menu record", code: "MENU_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");

    if (kind !== "category" && kind !== "item") {
      return NextResponse.json(
        { error: "A valid menu record kind is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (kind === "category") {
      await db.menuCategory.delete({ where: { id } });
    } else {
      await db.menuItem.delete({ where: { id } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[menu] Failed to delete menu record", error);
    return NextResponse.json(
      { error: "Unable to delete menu record", code: "MENU_DELETE_FAILED" },
      { status: 500 }
    );
  }
}
