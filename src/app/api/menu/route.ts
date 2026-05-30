import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoriesOnly = searchParams.get("categoriesOnly");
    const all = searchParams.get("all"); // include unavailable items for admin

    if (categoriesOnly) {
      const categories = await db.menuCategory.findMany({
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(categories);
    }

    if (all) {
      // Admin mode: return all items flat with categories
      const items = await db.menuItem.findMany({
        where: {},
        include: { category: true },
        orderBy: { nameEn: "asc" },
      });
      const categories = await db.menuCategory.findMany({
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(items, { headers: { "X-Categories": JSON.stringify(categories.length) } });
    }

    // Customer mode: only available items grouped by category
    const categories = await db.menuCategory.findMany({
      where: { isAvailable: true },
      include: {
        items: {
          where: { isAvailable: true },
          include: {
            modifiers: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching menu:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { nameEn, nameAr, price, categoryId, descriptionEn, descriptionAr, isAvailable, calories, preparationTime, isPopular, isSpecial, image, allergens, dietary } = data;

    if (!nameEn || !categoryId || price === undefined) {
      return NextResponse.json({ error: "Name, category, and price are required" }, { status: 400 });
    }

    const menuItem = await db.menuItem.create({
      data: {
        nameEn,
        nameAr: nameAr || "",
        price: parseFloat(String(price)) || 0,
        categoryId,
        descriptionEn: descriptionEn || "",
        descriptionAr: descriptionAr || "",
        isAvailable: isAvailable !== false,
        calories: calories || 0,
        preparationTime: preparationTime || 0,
        isPopular: isPopular || false,
        isSpecial: isSpecial || false,
        image: image || "",
        allergens: allergens || "",
        dietary: dietary || "",
      },
    });

    return NextResponse.json(menuItem);
  } catch (error) {
    console.error("Error creating menu item:", error);
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}
