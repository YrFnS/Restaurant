import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

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
  try {
    const body = await req.json();
    if (body.type === "category") {
      const cat = await db.menuCategory.create({
        data: {
          nameEn: body.nameEn, nameAr: body.nameAr,
          icon: body.icon || "🍽️", color: body.color || "#f59e0b",
          sortOrder: body.sortOrder || 0, stationSlugs: body.stationSlugs || "",
          isAvailable: body.isAvailable !== false,
        },
      });
      return NextResponse.json({ category: cat });
    }
    // menu item
    const item = await db.menuItem.create({
      data: {
        nameEn: body.nameEn, nameAr: body.nameAr,
        descriptionEn: body.descriptionEn || "", descriptionAr: body.descriptionAr || "",
        price: body.price, image: body.image || "",
        isAvailable: body.isAvailable !== false,
        isPopular: !!body.isPopular, isSpecial: !!body.isSpecial, isNew: !!body.isNew,
        preparationTime: body.preparationTime || 15, calories: body.calories || 0,
        allergens: body.allergens || "", dietary: body.dietary || "",
        sortOrder: body.sortOrder || 0, categoryId: body.categoryId,
      },
    });
    if (body.modifierGroups) {
      for (let gi = 0; gi < body.modifierGroups.length; gi++) {
        const g = body.modifierGroups[gi];
        const grp = await db.modifierGroup.create({
          data: {
            nameEn: g.nameEn, nameAr: g.nameAr,
            isRequired: !!g.isRequired, minSelect: g.min || 0, maxSelect: g.max || 1,
            sortOrder: gi, menuItemId: item.id,
          },
        });
        if (g.options) {
          for (const o of g.options) {
            await db.modifierOption.create({
              data: {
                nameEn: o.nameEn, nameAr: o.nameAr,
                price: o.price || 0, isDefault: !!o.isDefault,
                preset: o.preset || "none", groupId: grp.id,
              },
            });
          }
        }
      }
    }
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
