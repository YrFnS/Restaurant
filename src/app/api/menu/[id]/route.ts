import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  MENU_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";

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

const categoryAuditSelect = {
  id: true,
  nameEn: true,
  nameAr: true,
  icon: true,
  color: true,
  sortOrder: true,
  stationSlugs: true,
  isAvailable: true,
} as const;

const itemAuditSelect = {
  id: true,
  nameEn: true,
  nameAr: true,
  price: true,
  categoryId: true,
  isAvailable: true,
  isPopular: true,
  isSpecial: true,
  isNew: true,
  preparationTime: true,
  sortOrder: true,
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(MENU_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const body = await req.json();
    const context = auditContextFromRequest(req);

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

      const existing = await db.menuCategory.findUnique({
        where: { id },
        select: categoryAuditSelect,
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Menu category not found", code: "MENU_CATEGORY_NOT_FOUND" },
          { status: 404 }
        );
      }

      const { type: _type, ...data } = parsed.data;
      const category = await db.$transaction(async (tx) => {
        const updated = await tx.menuCategory.update({
          where: { id },
          data,
          select: categoryAuditSelect,
        });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "menu.category.update",
          entityType: "MenuCategory",
          entityId: id,
          context,
          metadata: { before: existing, after: updated },
        });
        return updated;
      });

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

    const existing = await db.menuItem.findUnique({
      where: { id },
      select: itemAuditSelect,
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found", code: "MENU_ITEM_NOT_FOUND" },
        { status: 404 }
      );
    }

    const { type: _type, ...data } = parsed.data;
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.menuItem.update({
        where: { id },
        data,
        select: itemAuditSelect,
      });
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "menu.item.update",
        entityType: "MenuItem",
        entityId: id,
        context,
        metadata: { before: existing, after: updated },
      });
      return updated;
    });

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
    const context = auditContextFromRequest(req);

    if (kind !== "category" && kind !== "item") {
      return NextResponse.json(
        { error: "A valid menu record kind is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (kind === "category") {
      const existing = await db.menuCategory.findUnique({
        where: { id },
        select: categoryAuditSelect,
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Menu category not found", code: "MENU_CATEGORY_NOT_FOUND" },
          { status: 404 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.menuCategory.delete({ where: { id } });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "menu.category.delete",
          entityType: "MenuCategory",
          entityId: id,
          context,
          metadata: { before: existing },
        });
      });
    } else {
      const existing = await db.menuItem.findUnique({
        where: { id },
        select: itemAuditSelect,
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Menu item not found", code: "MENU_ITEM_NOT_FOUND" },
          { status: 404 }
        );
      }

      await db.$transaction(async (tx) => {
        await tx.menuItem.delete({ where: { id } });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: "menu.item.delete",
          entityType: "MenuItem",
          entityId: id,
          context,
          metadata: { before: existing },
        });
      });
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
