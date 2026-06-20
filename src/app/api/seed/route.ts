import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Simple seed endpoint — call GET /api/seed to populate an empty database.
// Protected by a secret key to prevent abuse.

const SEED_SECRET = process.env.SEED_SECRET || "seed-me-once";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key !== SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if already seeded
    const existing = await db.restaurantSettings.count();
    if (existing > 0) {
      return NextResponse.json({ message: "Already seeded", counts: await getCounts() });
    }

    // Run inline seed (same data as prisma/seed.ts but inline for serverless)
    const result = await runSeed();
    return NextResponse.json({ message: "Seed complete", ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function getCounts() {
  return {
    settings: await db.restaurantSettings.count(),
    categories: await db.menuCategory.count(),
    items: await db.menuItem.count(),
    tables: await db.restaurantTable.count(),
    employees: await db.employee.count(),
    customers: await db.customer.count(),
    orders: await db.order.count(),
  };
}

async function runSeed() {
  const uid = () => Math.random().toString(36).slice(2, 14);
  const futureDate = (d: number) => new Date(Date.now() + d * 86400000);
  const pastDate = (d: number) => new Date(Date.now() - d * 86400000);

  // Settings
  await db.restaurantSettings.create({
    data: {
      id: "1", nameEn: "Saffron & Spice", nameAr: "زعفران وبهارات",
      taglineEn: "Flavors worth savoring", taglineAr: "نكهات تستحق التذوق",
      descriptionEn: "Experience the finest flavors crafted with passion and tradition.",
      descriptionAr: "اختبر أجود النكهات المصنوعة بشغف وتقاليد.",
      phone: "+964 750 123 4567", email: "hello@saffronspice.com",
      addressEn: "Al-Rasheed Street, Baghdad, Iraq", addressAr: "شارع الرشيد، بغداد، العراق",
      latitude: 33.3152, longitude: 44.3661,
      taxRate: 0.1, currency: "USD", currencySymbol: "$",
      deliveryFee: 4.99, minDeliveryOrder: 15, deliveryRadiusKm: 10,
      avgPrepTimeMin: 25, tipPresets: "15,18,20", openTime: "10:00", closeTime: "23:00",
      logoUrl: "/images/logo.png", heroImageUrl: "/images/hero-restaurant.png",
      facebookUrl: "https://facebook.com/saffronspice", instagramUrl: "https://instagram.com/saffronspice",
      twitterUrl: "https://twitter.com/saffronspice", whatsappUrl: "https://wa.me/9647501234567",
      giftCardAmounts: "25,50,75,100",
      statsOrdersServed: 48250, statsHappyCustomers: 12300, statsYearsService: 12,
      kdsGreenMin: 10, kdsYellowMin: 18, kdsRedMin: 25, soundOnNewTicket: true,
    },
  });

  // Stations
  const stations = [
    { name: "Grill", slug: "grill", icon: "Flame", color: "#ef4444", targetPrepMin: 15, sortOrder: 0 },
    { name: "Prep", slug: "prep", icon: "ChefHat", color: "#f59e0b", targetPrepMin: 12, sortOrder: 1 },
    { name: "Bar", slug: "bar", icon: "Wine", color: "#8b5cf6", targetPrepMin: 8, sortOrder: 2 },
    { name: "Dessert", slug: "dessert", icon: "Cake", color: "#ec4899", targetPrepMin: 10, sortOrder: 3 },
  ];
  for (const s of stations) { await db.kitchenStation.create({ data: s }); }

  // KDS Screens
  const screens = [
    { name: "Grill Station", slug: "grill", description: "Grill & hot kitchen", stationFilter: "grill", screenType: "prep", sortOrder: 0 },
    { name: "Prep Station", slug: "prep", description: "Cold prep & appetizers", stationFilter: "prep", screenType: "prep", sortOrder: 1 },
    { name: "Bar Station", slug: "bar", description: "Beverages & drinks", stationFilter: "bar", screenType: "prep", sortOrder: 2 },
    { name: "Dessert Station", slug: "dessert", description: "Desserts & sweets", stationFilter: "dessert", screenType: "prep", sortOrder: 3 },
    { name: "Expo View", slug: "expo", description: "All stations consolidated", stationFilter: "", screenType: "expo", sortOrder: 4 },
  ];
  for (const sc of screens) { await db.kitchenScreen.create({ data: { ...sc, layoutType: "grid", autoRefreshSec: 10, showCompleted: false, maxOrders: 0, isActive: true } }); }

  // Categories
  const cats = [
    { nameEn: "Appetizers", nameAr: "المقبلات", icon: "🥗", color: "#84cc16", sortOrder: 0, stationSlugs: "prep" },
    { nameEn: "Soups", nameAr: "الشوربات", icon: "🍲", color: "#f59e0b", sortOrder: 1, stationSlugs: "prep" },
    { nameEn: "Grills", nameAr: "المشاوي", icon: "🔥", color: "#ef4444", sortOrder: 2, stationSlugs: "grill" },
    { nameEn: "Seafood", nameAr: "المأكولات البحرية", icon: "🦐", color: "#06b6d4", sortOrder: 3, stationSlugs: "grill" },
    { nameEn: "Pasta", nameAr: "المعكرونة", icon: "🍝", color: "#f97316", sortOrder: 4, stationSlugs: "prep" },
    { nameEn: "Pizza", nameAr: "البيتزا", icon: "🍕", color: "#dc2626", sortOrder: 5, stationSlugs: "prep" },
    { nameEn: "Salads", nameAr: "السلطات", icon: "🥬", color: "#22c55e", sortOrder: 6, stationSlugs: "prep" },
    { nameEn: "Desserts", nameAr: "الحلويات", icon: "🍰", color: "#ec4899", sortOrder: 7, stationSlugs: "dessert" },
    { nameEn: "Beverages", nameAr: "المشروبات", icon: "🥤", color: "#3b82f6", sortOrder: 8, stationSlugs: "bar" },
    { nameEn: "Sides", nameAr: "الإضافات الجانبية", icon: "🍟", color: "#a855f7", sortOrder: 9, stationSlugs: "prep" },
  ];
  const catMap: Record<string, string> = {};
  for (const c of cats) { const r = await db.menuCategory.create({ data: c }); catMap[c.nameEn] = r.id; }

  // Menu Items (abbreviated — key items with modifiers)
  const items: any[] = [
    { nameEn: "Hummus Beiruti", nameAr: "حمص بيروتي", cat: "Appetizers", descEn: "Creamy chickpea purée with tahini, lemon, and olive oil.", descAr: "مهروش الحمص مع الطحينة والليمون وزيت الزيتون.", price: 7.5, popular: true, prep: 8, cal: 320, allergens: "sesame,gluten", dietary: "vegetarian,vegan,halal", img: "hummus.png",
      groups: [{ nameEn: "Size", nameAr: "الحجم", required: true, max: 1, opts: [{ nameEn: "Regular", nameAr: "عادي", d: true }, { nameEn: "Large", nameAr: "كبير", price: 3 }] }, { nameEn: "Add-ons", nameAr: "إضافات", max: 3, opts: [{ nameEn: "Extra olive oil", nameAr: "زيت زيتون إضافي", price: 1 }, { nameEn: "Pine nuts", nameAr: "صنوبر", price: 2 }, { nameEn: "Spicy", nameAr: "حار", price: 0.5, p: "spicy" }] }] },
    { nameEn: "Falafel Plate", nameAr: "صحن الفلافل", cat: "Appetizers", descEn: "Crispy chickpea fritters with herbs and tahini sauce.", descAr: "أقراص الحمص المقلية مع الأعشاب وصلصة الطحينة.", price: 8, prep: 10, cal: 410, allergens: "gluten", dietary: "vegetarian,vegan,halal", img: "falafel.png" },
    { nameEn: "Stuffed Grape Leaves", nameAr: "ورق عنب محشي", cat: "Appetizers", descEn: "Hand-rolled vine leaves stuffed with spiced rice and herbs.", descAr: "ورق عنب محشو يدوياً بالأرز المتبل والأعشاب.", price: 9.5, special: true, prep: 12, cal: 280, allergens: "", dietary: "vegetarian,vegan,halal", img: "grape-leaves.png" },
    { nameEn: "Lentil Soup", nameAr: "شوربة العدس", cat: "Soups", descEn: "Hearty red lentil soup with cumin and lemon.", descAr: "شوربة العدس الأحمر الغنية بالكمون والليمون.", price: 5.5, popular: true, prep: 6, cal: 220, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free", img: "lentil-soup.png" },
    { nameEn: "Seafood Chowder", nameAr: "شوربة المأكولات البحرية", cat: "Soups", descEn: "Creamy chowder with shrimp, fish, and potatoes.", descAr: "شوربة كريمية بالروبيان والسمك والبطاطا.", price: 8.5, prep: 10, cal: 380, allergens: "dairy,seafood", dietary: "halal", img: "seafood-chowder.png" },
    { nameEn: "Mixed Grill Platter", nameAr: "صحن مشاوي مشكل", cat: "Grills", descEn: "Shish tawook, kebab, and lamb chops with grilled vegetables.", descAr: "شيش طاووق وكباب وأضلاع خاروف مع الخضار المشوية.", price: 28, popular: true, prep: 20, cal: 950, allergens: "", dietary: "halal", img: "mixed-grill.png",
      groups: [{ nameEn: "Doneness", nameAr: "نضج اللحم", required: true, max: 1, opts: [{ nameEn: "Medium", nameAr: "متوسط", d: true }, { nameEn: "Well done", nameAr: "ناضج تماماً" }, { nameEn: "Medium rare", nameAr: "نصف ناضج" }] }, { nameEn: "Sides", nameAr: "إضافات جانبية", max: 2, opts: [{ nameEn: "Garlic sauce", nameAr: "صلصة الثوم", price: 1.5 }, { nameEn: "Grilled vegetables", nameAr: "خضار مشوية", price: 3 }, { nameEn: "Rice", nameAr: "أرز", price: 2.5 }] }] },
    { nameEn: "Shish Tawook", nameAr: "شيش طاووق", cat: "Grills", descEn: "Marinated chicken skewers grilled to perfection.", descAr: "أسياخ الدجاج المتتبلة المشوية.", price: 16, popular: true, prep: 16, cal: 620, allergens: "", dietary: "halal", img: "shish-tawook.png" },
    { nameEn: "Lamb Kebab", nameAr: "كباب خاروف", cat: "Grills", descEn: "Hand-minced lamb with parsley, onion, and seven spices.", descAr: "خاروف مفروم يدوياً مع البقدونس والبصل وسبع بهارات.", price: 18, prep: 18, cal: 720, allergens: "", dietary: "halal", img: "lamb-kebab.png" },
    { nameEn: "Spicy Wings", nameAr: "أجنحة حارة", cat: "Grills", descEn: "Char-grilled chicken wings tossed in spicy glaze.", descAr: "أجنحة دجاج مشوية مع صلصتنا الحارة.", price: 12, special: true, prep: 14, cal: 480, allergens: "", dietary: "spicy,halal", img: "wings.png",
      groups: [{ nameEn: "Spice Level", nameAr: "مستوى الحرارة", required: true, max: 1, opts: [{ nameEn: "Mild", nameAr: "خفيف" }, { nameEn: "Medium", nameAr: "متوسط", d: true, p: "spicy" }, { nameEn: "Hot", nameAr: "حار", p: "spicy" }, { nameEn: "Inferno", nameAr: "جحيم", p: "spicy" }] }] },
    { nameEn: "Grilled Salmon", nameAr: "سمك السلمون المشوي", cat: "Seafood", descEn: "Atlantic salmon fillet with lemon butter and dill.", descAr: "فيليه سلمون أطلسي مع زبدة الليمون والشبت.", price: 24, special: true, prep: 18, cal: 540, allergens: "fish,dairy", dietary: "halal,gluten_free", img: "salmon.png" },
    { nameEn: "Shrimp Linguine", nameAr: "لينغويني بالروبيان", cat: "Seafood", descEn: "Sautéed shrimp with garlic, chili, and cherry tomatoes.", descAr: "روبيان سوتيه مع الثوم والفلفل وطماطم الكرز.", price: 21, prep: 16, cal: 680, allergens: "gluten,seafood", dietary: "halal", img: "shrimp-linguine.png" },
    { nameEn: "Truffle Mushroom Pasta", nameAr: "معكرونة الفطر بالكمأة", cat: "Pasta", descEn: "Fettuccine in creamy truffle sauce with wild mushrooms.", descAr: "فيتوتشيني بصلصة الكمأة الكريمية مع الفطر البري.", price: 19, popular: true, prep: 15, cal: 720, allergens: "gluten,dairy", dietary: "vegetarian", img: "truffle-pasta.png" },
    { nameEn: "Spicy Arrabbiata", nameAr: "أرابياتا الحارة", cat: "Pasta", descEn: "Penne in spicy tomato sauce with garlic and basil.", descAr: "بيني بصلصة الطماطم الحارة مع الثوم والريحان.", price: 15, prep: 14, cal: 580, allergens: "gluten", dietary: "vegetarian,vegan,spicy", img: "arrabbiata.png" },
    { nameEn: "Margherita", nameAr: "مارغريتا", cat: "Pizza", descEn: "San Marzano tomato, fresh mozzarella, and basil.", descAr: "طماطم سان مارزانو وموزاريلا طازجة وريحان.", price: 14, popular: true, prep: 15, cal: 850, allergens: "gluten,dairy", dietary: "vegetarian", img: "margherita.png",
      groups: [{ nameEn: "Size", nameAr: "الحجم", required: true, max: 1, opts: [{ nameEn: "Medium (10\")", nameAr: "وسط", d: true }, { nameEn: "Large (14\")", nameAr: "كبير", price: 5 }] }, { nameEn: "Crust", nameAr: "العجينة", required: true, max: 1, opts: [{ nameEn: "Classic", nameAr: "كلاسيكية", d: true }, { nameEn: "Thin", nameAr: "رفيعة" }, { nameEn: "Stuffed crust", nameAr: "محشية الأطراف", price: 3 }] }] },
    { nameEn: "Spicy Pepperoni", nameAr: "بيبروني الحارة", cat: "Pizza", descEn: "Spicy beef pepperoni, mozzarella, and chili flakes.", descAr: "بيبروني لحم البقر الحار وموزاريلا.", price: 17, prep: 16, cal: 980, allergens: "gluten,dairy", dietary: "spicy,halal", img: "pepperoni-pizza.png" },
    { nameEn: "Fattoush", nameAr: "فتوش", cat: "Salads", descEn: "Crisp romaine, radish, sumac with pomegranate dressing.", descAr: "خس روماني مقرمش مع صلصة الرمان.", price: 9, popular: true, prep: 8, cal: 240, allergens: "gluten", dietary: "vegetarian,vegan,halal", img: "fattoush.png" },
    { nameEn: "Caesar Salad", nameAr: "سلطة سيزر", cat: "Salads", descEn: "Romaine, croutons, parmesan, and grilled chicken.", descAr: "خس روماني وخبز محمص وبارميزان ودجاج مشوي.", price: 11, prep: 10, cal: 380, allergens: "gluten,dairy,eggs", dietary: "halal", img: "caesar-salad.png" },
    { nameEn: "Kunafa", nameAr: "كنافة", cat: "Desserts", descEn: "Warm knafeh with melted cheese and pistachios.", descAr: "كنافة دافئة بالجبن الذائب والفستق.", price: 9.5, popular: true, special: true, prep: 12, cal: 520, allergens: "gluten,dairy,nuts", dietary: "vegetarian,halal", img: "kunafa.png" },
    { nameEn: "Baklava (4 pcs)", nameAr: "بقلاوة (٤ قطع)", cat: "Desserts", descEn: "Layered filo with pistachios and honey syrup.", descAr: "عجينة الفيلو الطبقات مع الفستق وشراب العسل.", price: 7, prep: 5, cal: 380, allergens: "gluten,dairy,nuts", dietary: "vegetarian,halal", img: "baklava.png" },
    { nameEn: "Chocolate Lava Cake", nameAr: "كيكة الشوكولاتة البركانية", cat: "Desserts", descEn: "Warm chocolate cake with molten center and vanilla ice cream.", descAr: "كيكة شوكولاتة دافئة بقلب ذائب مع آيس كريم.", price: 8.5, isNew: true, prep: 10, cal: 610, allergens: "gluten,dairy,eggs", dietary: "vegetarian", img: "lava-cake.png" },
    { nameEn: "Fresh Mint Lemonade", nameAr: "ليموناضة بالنعناع الطازج", cat: "Beverages", descEn: "Hand-pressed lemonade with crushed mint.", descAr: "ليموناضة معصورة يدوياً مع النعناع.", price: 4.5, popular: true, prep: 4, cal: 140, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free", img: "lemonade.png" },
    { nameEn: "Turkish Coffee", nameAr: "قهوة تركية", cat: "Beverages", descEn: "Traditional finely-ground coffee brewed in a cezve.", descAr: "قهوة مطحونة ناعماً تقليدياً.", price: 3.5, prep: 5, cal: 5, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free", img: "turkish-coffee.png" },
    { nameEn: "Pomegranate Mocktail", nameAr: "موكتيل الرمان", cat: "Beverages", descEn: "Pomegranate, lime, and soda with rosemary.", descAr: "رمان وليمون وصودا مع إكليل الجبل.", price: 6, isNew: true, prep: 5, cal: 120, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free", img: "pomegranate-mocktail.png" },
    { nameEn: "Soft Drinks", nameAr: "مشروبات غازية", cat: "Beverages", descEn: "Choice of cola, lemon-lime, or orange.", descAr: "اختيار من الكولا أو الليمون أو البرتقال.", price: 2.5, prep: 1, cal: 150, allergens: "", dietary: "vegetarian,halal", img: "soft-drink.png",
      groups: [{ nameEn: "Flavor", nameAr: "النكهة", required: true, max: 1, opts: [{ nameEn: "Cola", nameAr: "كولا", d: true }, { nameEn: "Lemon-Lime", nameAr: "ليمون" }, { nameEn: "Orange", nameAr: "برتقال" }] }] },
    { nameEn: "Truffle Fries", nameAr: "بطاطا الكمأة", cat: "Sides", descEn: "Hand-cut fries with truffle oil and parmesan.", descAr: "بطاطا مقطعة يدوياً مع زيت الكمأة.", price: 6.5, popular: true, prep: 8, cal: 420, allergens: "dairy", dietary: "vegetarian,halal", img: "truffle-fries.png" },
    { nameEn: "Garlic Rice", nameAr: "أرز بالثوم", cat: "Sides", descEn: "Fragrant basmati rice toasted with garlic.", descAr: "أرز بسمتي عطري محمص بالثوم.", price: 4, prep: 6, cal: 280, allergens: "", dietary: "vegetarian,vegan,halal", img: "garlic-rice.png" },
    { nameEn: "Grilled Vegetables", nameAr: "خضار مشوية", cat: "Sides", descEn: "Seasonal vegetables char-grilled with herbs.", descAr: "خضار موسمية مشوية بالأعشاب.", price: 5.5, prep: 7, cal: 160, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free", img: "grilled-veg.png" },
  ];

  for (const it of items) {
    const catId = catMap[it.cat];
    if (!catId) continue;
    const item = await db.menuItem.create({ data: { nameEn: it.nameEn, nameAr: it.nameAr, descriptionEn: it.descEn, descriptionAr: it.descAr, price: it.price, isAvailable: true, isPopular: !!it.popular, isSpecial: !!it.special, isNew: !!it.isNew, preparationTime: it.prep, calories: it.cal, allergens: it.allergens, dietary: it.dietary, categoryId: catId, image: it.img ? `/images/menu/${it.img}` : "", sortOrder: 0 } });
    if (it.groups) {
      for (let gi = 0; gi < it.groups.length; gi++) {
        const g = it.groups[gi];
        const grp = await db.modifierGroup.create({ data: { nameEn: g.nameEn, nameAr: g.nameAr, isRequired: !!g.required, minSelect: g.min ?? 0, maxSelect: g.max ?? 1, sortOrder: gi, menuItemId: item.id } });
        for (const o of g.opts) {
          await db.modifierOption.create({ data: { nameEn: o.nameEn, nameAr: o.nameAr, price: o.price ?? 0, isDefault: !!o.d, preset: o.p ?? "none", groupId: grp.id } });
        }
      }
    }
  }

  // Tables
  const tbls = [
    { n: 1, c: 2, s: "main", sh: "round", x: 60, y: 60, w: 70, h: 70 },
    { n: 2, c: 2, s: "main", sh: "round", x: 220, y: 60, w: 70, h: 70 },
    { n: 3, c: 4, s: "main", sh: "square", x: 60, y: 180, w: 90, h: 90 },
    { n: 4, c: 4, s: "main", sh: "square", x: 220, y: 180, w: 90, h: 90 },
    { n: 5, c: 4, s: "main", sh: "square", x: 380, y: 180, w: 90, h: 90 },
    { n: 6, c: 6, s: "main", sh: "square", x: 60, y: 320, w: 90, h: 90 },
    { n: 7, c: 6, s: "main", sh: "square", x: 220, y: 320, w: 90, h: 90 },
    { n: 8, c: 8, s: "main", sh: "square", x: 380, y: 320, w: 90, h: 90 },
    { n: 9, c: 2, s: "patio", sh: "round", x: 560, y: 60, w: 70, h: 70 },
    { n: 10, c: 4, s: "patio", sh: "round", x: 560, y: 180, w: 80, h: 80 },
    { n: 11, c: 4, s: "patio", sh: "round", x: 700, y: 180, w: 80, h: 80 },
    { n: 12, c: 6, s: "patio", sh: "square", x: 560, y: 320, w: 90, h: 90 },
    { n: 13, c: 1, s: "bar", sh: "square", x: 60, y: 460, w: 60, h: 60 },
    { n: 14, c: 1, s: "bar", sh: "square", x: 140, y: 460, w: 60, h: 60 },
    { n: 15, c: 1, s: "bar", sh: "square", x: 220, y: 460, w: 60, h: 60 },
    { n: 16, c: 1, s: "bar", sh: "square", x: 300, y: 460, w: 60, h: 60 },
    { n: 17, c: 8, s: "private", sh: "square", x: 560, y: 460, w: 100, h: 100 },
    { n: 18, c: 10, s: "private", sh: "square", x: 700, y: 460, w: 110, h: 110 },
    { n: 19, c: 4, s: "private", sh: "square", x: 840, y: 180, w: 90, h: 90 },
    { n: 20, c: 6, s: "private", sh: "square", x: 840, y: 320, w: 90, h: 90 },
  ];
  for (const t of tbls) {
    await db.restaurantTable.create({ data: { number: t.n, capacity: t.c, section: t.s, shape: t.sh, status: t.n <= 5 ? "seated" : "open", x: t.x, y: t.y, width: t.w, height: t.h, serverName: t.n <= 5 ? "Sarah" : "", seatedAt: t.n <= 5 ? pastDate(0) : null } });
  }

  // Employees
  const emps = [
    { name: "Admin", pin: "1234", role: "admin", wage: 25, email: "admin@restaurant.com", phone: "+9647500000001" },
    { name: "Omar Manager", pin: "2222", role: "manager", wage: 20, email: "omar@restaurant.com", phone: "+9647500000002" },
    { name: "Sarah", pin: "1111", role: "server", wage: 12, email: "sarah@restaurant.com", phone: "+9647500000003" },
    { name: "Layla", pin: "3333", role: "server", wage: 12, email: "layla@restaurant.com", phone: "+9647500000004" },
    { name: "Yusuf", pin: "4444", role: "cook", wage: 16, email: "yusuf@restaurant.com", phone: "+9647500000005" },
    { name: "Mariam", pin: "5555", role: "bartender", wage: 14, email: "mariam@restaurant.com", phone: "+9647500000006" },
    { name: "Hassan", pin: "6666", role: "host", wage: 11, email: "hassan@restaurant.com", phone: "+9647500000007" },
  ];
  for (const e of emps) {
    const emp = await db.employee.create({ data: { name: e.name, pin: e.pin, role: e.role, hourlyWage: e.wage, isActive: true, email: e.email, phone: e.phone } });
    for (let day = 1; day <= 6; day++) {
      await db.schedule.create({ data: { employeeId: emp.id, dayOfWeek: day, startTime: "09:00", endTime: "17:00", role: e.role === "cook" ? "Cook" : e.role === "bartender" ? "Bartender" : e.role === "host" ? "Host" : "Server" } });
    }
  }

  // Customers
  const custs = [
    { name: "Ahmed Khalil", phone: "+9647501111111", email: "ahmed@email.com", loyaltyPoints: 1200, totalSpent: 450, visits: 15, notes: "Prefers window seats" },
    { name: "Fatima Ali", phone: "+9647502222222", email: "fatima@email.com", loyaltyPoints: 800, totalSpent: 320, visits: 10, notes: "Allergic to nuts" },
    { name: "Omar Hassan", phone: "+9647503333333", email: "omar@email.com", loyaltyPoints: 2500, totalSpent: 890, visits: 30, notes: "VIP customer" },
    { name: "Layla Mahmoud", phone: "+9647504444444", email: "layla@email.com", loyaltyPoints: 300, totalSpent: 120, visits: 5, notes: "" },
  ];
  for (const c of custs) { await db.customer.create({ data: c }); }

  // Special Offers
  for (const o of [
    { titleEn: "Happy Hour", titleAr: "ساعة السعادة", descriptionEn: "30% off all beverages", descriptionAr: "خصم ٣٠٪ على كل المشروبات", discountPercent: 30, image: "", isActive: true, validFrom: pastDate(30), validUntil: futureDate(30) },
    { titleEn: "Family Feast", titleAr: "وليمة العائلة", descriptionEn: "Mixed grill for 4 + 4 drinks — save 20%", descriptionAr: "مشاوي مشكل لـ٤ + ٤ مشروبات — وفّر ٢٠٪", discountPercent: 20, image: "", isActive: true, validFrom: pastDate(30), validUntil: futureDate(30) },
    { titleEn: "Lunch Special", titleAr: "عرض الغداء", descriptionEn: "Pasta + soup + drink for $15", descriptionAr: "معكرونة + شوربة + مشروب بـ١٥ دولار", discountPercent: 15, image: "", isActive: true, validFrom: pastDate(30), validUntil: futureDate(30) },
  ]) { await db.specialOffer.create({ data: o }); }

  // Promo Codes
  for (const p of [
    { code: "WELCOME10", discountPercent: 10, isActive: true, validFrom: pastDate(30), validUntil: futureDate(90) },
    { code: "SPICE20", discountPercent: 20, isActive: true, validFrom: pastDate(30), validUntil: futureDate(90) },
    { code: "FAMILY15", discountPercent: 15, isActive: true, validFrom: pastDate(30), validUntil: futureDate(90) },
  ]) { await db.promoCode.create({ data: p }); }

  // Reward Tiers
  for (const t of [
    { nameEn: "Bronze", nameAr: "برونزي", points: 0, tier: "bronze", icon: "🥉", perkEn: "5% off after 500 pts", perkAr: "خصم ٥٪ بعد ٥٠٠ نقطة", sortOrder: 0, isActive: true },
    { nameEn: "Silver", nameAr: "فضي", points: 500, tier: "silver", icon: "🥈", perkEn: "10% off + free dessert", perkAr: "خصم ١٠٪ + حلوى مجانية", sortOrder: 1, isActive: true },
    { nameEn: "Gold", nameAr: "ذهبي", points: 1500, tier: "gold", icon: "🥇", perkEn: "15% off + priority reservations", perkAr: "خصم ١٥٪ + حجوزات أولوية", sortOrder: 2, isActive: true },
    { nameEn: "Platinum", nameAr: "بلاتيني", points: 3000, tier: "platinum", icon: "💎", perkEn: "20% off + chef's tasting menu", perkAr: "خصم ٢٠٪ + قائمة تذوق الشيف", sortOrder: 3, isActive: true },
  ]) { await db.rewardTier.create({ data: t }); }

  // Testimonials
  for (const t of [
    { nameEn: "Ahmed K.", nameAr: "أحمد ك.", commentEn: "Best grill in town!", commentAr: "أفضل مشاوي في المدينة!", stars: 5, avatar: "👨", sortOrder: 0, isActive: true },
    { nameEn: "Fatima A.", nameAr: "فاطمة ع.", commentEn: "The kunafa is to die for.", commentAr: "الكنافة لا تُقاوم.", stars: 5, avatar: "👩", sortOrder: 1, isActive: true },
    { nameEn: "John M.", nameAr: "جون م.", commentEn: "Incredible value lunch special.", commentAr: "عرض الغداء قيمة رائعة.", stars: 5, avatar: "👨", sortOrder: 2, isActive: true },
    { nameEn: "Noor H.", nameAr: "نور ح.", commentEn: "Beautiful ambiance.", commentAr: "أجواء جميلة.", stars: 5, avatar: "👩", sortOrder: 3, isActive: true },
  ]) { await db.testimonial.create({ data: t }); }

  // Ingredients
  for (const i of [
    { name: "Chicken Breast", unit: "kg", quantity: 25, lowThreshold: 10, costPerUnit: 6.5, supplier: "Baghdad Poultry", category: "Meat" },
    { name: "Lamb", unit: "kg", quantity: 18, lowThreshold: 8, costPerUnit: 14, supplier: "Local Farms", category: "Meat" },
    { name: "Salmon Fillet", unit: "kg", quantity: 4, lowThreshold: 5, costPerUnit: 22, supplier: "Gulf Seafood", category: "Seafood" },
    { name: "Shrimp", unit: "kg", quantity: 8, lowThreshold: 4, costPerUnit: 18, supplier: "Gulf Seafood", category: "Seafood" },
    { name: "Mozzarella", unit: "kg", quantity: 12, lowThreshold: 5, costPerUnit: 7, supplier: "Dairy Co", category: "Dairy" },
    { name: "Pita Bread", unit: "pcs", quantity: 120, lowThreshold: 40, costPerUnit: 0.3, supplier: "Bakery", category: "Bakery" },
    { name: "Tomatoes", unit: "kg", quantity: 30, lowThreshold: 10, costPerUnit: 1.5, supplier: "Vegetable Market", category: "Produce" },
    { name: "Lemons", unit: "pcs", quantity: 60, lowThreshold: 30, costPerUnit: 0.2, supplier: "Vegetable Market", category: "Produce" },
    { name: "Rice Basmati", unit: "kg", quantity: 40, lowThreshold: 15, costPerUnit: 2.5, supplier: "Grain Co", category: "Grains" },
    { name: "Olive Oil", unit: "liters", quantity: 8, lowThreshold: 4, costPerUnit: 9, supplier: "Oil Importers", category: "Oils" },
    { name: "Pistachios", unit: "kg", quantity: 3, lowThreshold: 2, costPerUnit: 25, supplier: "Nut Importers", category: "Nuts" },
    { name: "Beef Mince", unit: "kg", quantity: 6, lowThreshold: 8, costPerUnit: 11, supplier: "Local Farms", category: "Meat" },
  ]) { await db.ingredient.create({ data: i }); }

  // Dynamic Pricing
  for (const d of [
    { nameEn: "Happy Hour Beverages", nameAr: "مشروبات ساعة السعادة", type: "happy_hour", multiplier: 0.7, dayOfWeek: -1, startTime: "14:00", endTime: "17:00", isActive: true },
    { nameEn: "Weekend Surge", nameAr: "زيادة عطلة نهاية الأسبوع", type: "surge", multiplier: 1.15, dayOfWeek: 5, startTime: "18:00", endTime: "22:00", isActive: true },
  ]) { await db.dynamicPricing.create({ data: d }); }

  // Combo Meals
  for (const c of [
    { nameEn: "Grill Combo", nameAr: "كومبو المشاوي", descriptionEn: "Mixed grill + rice + salad + drink for 4", descriptionAr: "مشاوي مشكل + أرز + سلطة + مشروب لـ٤", price: 85, items: "[]", isActive: true, sortOrder: 0 },
    { nameEn: "Pizza Night", nameAr: "ليلة البيتزا", descriptionEn: "2 large pizzas + 4 drinks + sides", descriptionAr: "٢ بيتزا كبيرة + ٤ مشروبات + إضافات", price: 45, items: "[]", isActive: true, sortOrder: 1 },
  ]) { await db.comboMeal.create({ data: c }); }

  return { counts: await getCounts() };
}
