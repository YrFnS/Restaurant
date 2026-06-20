import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const db = new PrismaClient();

function uid() { return randomUUID().slice(0, 12); }
function futureDate(days: number) { return new Date(Date.now() + days * 86400000); }
function pastDate(days: number) { return new Date(Date.now() - days * 86400000); }

async function main() {
  console.log("🌱 Seeding database...");

  const tables = [
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer",
    "ModifierOption", "ModifierGroup", "MenuItem", "MenuCategory",
    "RestaurantTable", "KitchenScreen", "KitchenStation",
    "Employee", "Schedule", "Ingredient", "WasteLog", "PurchaseOrder",
    "CashDrawerEntry", "Notification", "SpecialOffer", "PromoCode",
    "RewardTier", "GiftCard", "Feedback", "Testimonial",
    "NewsletterSubscription", "DynamicPricing", "ComboMeal",
  ];
  for (const t of tables) {
    await (db as any)[t[0].toLowerCase() + t.slice(1)].deleteMany();
  }
  await db.restaurantSettings.deleteMany();

  // ── 1. SETTINGS ──
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
      deliveryFee: 4.99, minDeliveryOrder: 15.0, deliveryRadiusKm: 10.0,
      avgPrepTimeMin: 25, tipPresets: "15,18,20", openTime: "10:00", closeTime: "23:00",
      logoUrl: "/images/logo.png", heroImageUrl: "/images/hero-restaurant.png",
      facebookUrl: "https://facebook.com/saffronspice", instagramUrl: "https://instagram.com/saffronspice",
      twitterUrl: "https://twitter.com/saffronspice", whatsappUrl: "https://wa.me/9647501234567",
      giftCardAmounts: "25,50,75,100",
      statsOrdersServed: 48250, statsHappyCustomers: 12300, statsYearsService: 12,
      kdsGreenMin: 10, kdsYellowMin: 18, kdsRedMin: 25, soundOnNewTicket: true,
    },
  });
  console.log("  ✓ Settings");

  // ── 2. KITCHEN STATIONS ──
  const stations = [
    { name: "Grill", slug: "grill", icon: "Flame", color: "#ef4444", targetPrepMin: 15, sortOrder: 0 },
    { name: "Prep", slug: "prep", icon: "ChefHat", color: "#f59e0b", targetPrepMin: 12, sortOrder: 1 },
    { name: "Bar", slug: "bar", icon: "Wine", color: "#8b5cf6", targetPrepMin: 8, sortOrder: 2 },
    { name: "Dessert", slug: "dessert", icon: "Cake", color: "#ec4899", targetPrepMin: 10, sortOrder: 3 },
  ];
  for (const s of stations) { await db.kitchenStation.create({ data: s }); }
  console.log(`  ✓ ${stations.length} stations`);

  // ── 3. KITCHEN SCREENS ──
  const screens = [
    { name: "Grill Station", slug: "grill", description: "Grill & hot kitchen", stationFilter: "grill", screenType: "prep", sortOrder: 0 },
    { name: "Prep Station", slug: "prep", description: "Cold prep & appetizers", stationFilter: "prep", screenType: "prep", sortOrder: 1 },
    { name: "Bar Station", slug: "bar", description: "Beverages & drinks", stationFilter: "bar", screenType: "prep", sortOrder: 2 },
    { name: "Dessert Station", slug: "dessert", description: "Desserts & sweets", stationFilter: "dessert", screenType: "prep", sortOrder: 3 },
    { name: "Expo View", slug: "expo", description: "All stations consolidated", stationFilter: "", screenType: "expo", sortOrder: 4 },
  ];
  for (const sc of screens) { await db.kitchenScreen.create({ data: { ...sc, layoutType: "grid", autoRefreshSec: 10, showCompleted: false, maxOrders: 0, isActive: true } }); }
  console.log(`  ✓ ${screens.length} KDS screens`);

  // ── 4. MENU CATEGORIES ──
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
  console.log(`  ✓ ${cats.length} categories`);

  // ── 5. MENU ITEMS + MODIFIERS ──
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
  console.log(`  ✓ ${items.length} menu items`);

  // ── 6. TABLES ──
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
  const tableRecords: any[] = [];
  for (const t of tbls) {
    const r = await db.restaurantTable.create({ data: { number: t.n, capacity: t.c, section: t.s, shape: t.sh, status: t.n <= 5 ? "seated" : "open", x: t.x, y: t.y, width: t.w, height: t.h, serverName: t.n <= 5 ? "Sarah" : "", seatedAt: t.n <= 5 ? pastDate(0) : null } });
    tableRecords.push(r);
  }
  console.log(`  ✓ ${tbls.length} tables`);

  // ── 7. EMPLOYEES + SCHEDULES ──
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
  console.log(`  ✓ ${emps.length} employees + schedules`);

  // ── 8. CUSTOMERS ──
  const custs = [
    { name: "Ahmed Khalil", phone: "+9647501111111", email: "ahmed@email.com", loyaltyPoints: 1200, totalSpent: 450, visits: 15, notes: "Prefers window seats" },
    { name: "Fatima Ali", phone: "+9647502222222", email: "fatima@email.com", loyaltyPoints: 800, totalSpent: 320, visits: 10, notes: "Allergic to nuts" },
    { name: "Omar Hassan", phone: "+9647503333333", email: "omar@email.com", loyaltyPoints: 2500, totalSpent: 890, visits: 30, notes: "VIP customer" },
    { name: "Layla Mahmoud", phone: "+9647504444444", email: "layla@email.com", loyaltyPoints: 300, totalSpent: 120, visits: 5, notes: "" },
    { name: "Yusuf Ibrahim", phone: "+9647505555555", email: "yusuf@email.com", loyaltyPoints: 150, totalSpent: 75, visits: 3, notes: "First-time visitor" },
  ];
  const custMap: Record<string, string> = {};
  for (const c of custs) { const r = await db.customer.create({ data: c }); custMap[c.phone] = r.id; }
  console.log(`  ✓ ${custs.length} customers`);

  // ── 9. RESERVATIONS ──
  const resData = [
    { name: "Ahmed Khalil", phone: "+9647501111111", email: "ahmed@email.com", party: 4, tableNum: 6, date: futureDate(1), status: "confirmed", occasion: "birthday", pref: "window", notes: "Birthday cake needed" },
    { name: "Fatima Ali", phone: "+9647502222222", email: "fatima@email.com", party: 2, tableNum: 1, date: futureDate(2), status: "confirmed", occasion: "date", pref: "quiet", notes: "" },
    { name: "Omar Hassan", phone: "+9647503333333", email: "omar@email.com", party: 8, tableNum: 17, date: futureDate(3), status: "confirmed", occasion: "business", pref: "private", notes: "Business dinner" },
    { name: "Layla Mahmoud", phone: "+9647504444444", email: "layla@email.com", party: 3, tableNum: 10, date: futureDate(0), status: "seated", occasion: "", pref: "", notes: "" },
    { name: "John Smith", phone: "+9647509999999", email: "john@email.com", party: 2, tableNum: 2, date: pastDate(1), status: "completed", occasion: "date", pref: "", notes: "" },
  ];
  for (const r of resData) {
    const tbl = tableRecords.find((t: any) => t.number === r.tableNum);
    await db.reservation.create({ data: { customerName: r.name, customerPhone: r.phone, customerEmail: r.email, partySize: r.party, tableId: tbl?.id, customerId: custMap[r.phone], dateTime: r.date, status: r.status, occasion: r.occasion, preference: r.pref, notes: r.notes } });
  }
  console.log(`  ✓ ${resData.length} reservations`);

  // ── 10. WAITLIST ──
  const wlData = [
    { customerName: "Ali Mustafa", customerPhone: "+9647506666666", partySize: 4, status: "waiting", estimatedWait: 20, notes: "Called ahead" },
    { customerName: "Sara Nabil", customerPhone: "+9647507777777", partySize: 2, status: "notified", estimatedWait: 5, notes: "Waiting at bar" },
    { customerName: "Karim Fadel", customerPhone: "+9647508888888", partySize: 6, status: "waiting", estimatedWait: 35, notes: "Large group" },
  ];
  for (const w of wlData) { await db.waitlistEntry.create({ data: w }); }
  console.log(`  ✓ ${wlData.length} waitlist entries`);

  // ── 11. ORDERS + ORDER ITEMS ──
  const allMI = await db.menuItem.findMany({ include: { category: true } });
  const stByCat: Record<string, string> = {};
  for (const it of allMI) { stByCat[it.id] = it.category.stationSlugs || "prep"; }
  const orderDefs = [
    { type: "dine_in", tN: 3, status: "preparing", items: ["Shish Tawook", "Hummus Beiruti", "Fresh Mint Lemonade"] },
    { type: "dine_in", tN: 5, status: "preparing", items: ["Mixed Grill Platter", "Truffle Fries", "Turkish Coffee"] },
    { type: "dine_in", tN: 1, status: "ready", items: ["Margherita", "Caesar Salad"] },
    { type: "takeout", tN: 0, status: "confirmed", items: ["Spicy Wings", "Falafel Plate", "Pomegranate Mocktail"] },
    { type: "delivery", tN: 0, status: "preparing", items: ["Grilled Salmon", "Truffle Mushroom Pasta", "Soft Drinks"] },
    { type: "dine_in", tN: 7, status: "pending", items: ["Lamb Kebab", "Garlic Rice", "Grilled Vegetables"] },
  ];
  let oCnt = 1001;
  for (const od of orderDefs) {
    const oi = od.items.map((n: string) => allMI.find((i: any) => i.nameEn === n)).filter(Boolean);
    if (!oi.length) continue;
    const sub = oi.reduce((s: number, i: any) => s + i.price, 0);
    const tax = sub * 0.1;
    const tbl = od.tN ? tableRecords.find((t: any) => t.number === od.tN) : null;
    const ord = await db.order.create({ data: { orderNumber: `#${oCnt++}`, type: od.type, status: od.status, customerName: od.type === "dine_in" ? `Table ${od.tN}` : "Walk-in", customerPhone: "", subtotal: sub, taxAmount: tax, deliveryFee: od.type === "delivery" ? 4.99 : 0, total: sub + tax + (od.type === "delivery" ? 4.99 : 0), paymentStatus: od.status === "ready" ? "paid" : "unpaid", serverName: "Sarah", tableId: tbl?.id, estimatedReady: futureDate(0) } });
    for (let k = 0; k < oi.length; k++) {
      const it = oi[k];
      await db.orderItem.create({ data: { orderId: ord.id, menuItemId: it.id, quantity: 1, unitPrice: it.price, totalPrice: it.price, modifiers: "[]", status: k === 0 ? "preparing" : "pending", stationSlug: stByCat[it.id] || "prep", course: k < 2 ? 1 : 2, hold: false, firedAt: k === 0 ? pastDate(0) : null } });
    }
  }
  console.log(`  ✓ ${orderDefs.length} orders`);

  // ── 12. SPECIAL OFFERS ──
  const offers = [
    { titleEn: "Happy Hour", titleAr: "ساعة السعادة", descriptionEn: "30% off all beverages", descriptionAr: "خصم ٣٠٪ على كل المشروبات", discountPercent: 30, image: "" },
    { titleEn: "Family Feast", titleAr: "وليمة العائلة", descriptionEn: "Mixed grill for 4 + 4 drinks — save 20%", descriptionAr: "مشاوي مشكل لـ٤ + ٤ مشروبات — وفّر ٢٠٪", discountPercent: 20, image: "" },
    { titleEn: "Lunch Special", titleAr: "عرض الغداء", descriptionEn: "Pasta + soup + drink for $15", descriptionAr: "معكرونة + شوربة + مشروب بـ١٥ دولار", discountPercent: 15, image: "" },
  ];
  for (const o of offers) { await db.specialOffer.create({ data: { ...o, isActive: true, validFrom: pastDate(30), validUntil: futureDate(30) } }); }
  console.log(`  ✓ ${offers.length} special offers`);

  // ── 13. PROMO CODES ──
  const promos = [
    { code: "WELCOME10", discountPercent: 10 }, { code: "SPICE20", discountPercent: 20 }, { code: "FAMILY15", discountPercent: 15 },
  ];
  for (const p of promos) { await db.promoCode.create({ data: { ...p, isActive: true, validFrom: pastDate(30), validUntil: futureDate(90) } }); }
  console.log(`  ✓ ${promos.length} promo codes`);

  // ── 14. REWARD TIERS ──
  const tiers = [
    { nameEn: "Bronze", nameAr: "برونزي", points: 0, tier: "bronze", icon: "🥉", perkEn: "5% off after 500 pts", perkAr: "خصم ٥٪ بعد ٥٠٠ نقطة", sortOrder: 0 },
    { nameEn: "Silver", nameAr: "فضي", points: 500, tier: "silver", icon: "🥈", perkEn: "10% off + free dessert", perkAr: "خصم ١٠٪ + حلوى مجانية", sortOrder: 1 },
    { nameEn: "Gold", nameAr: "ذهبي", points: 1500, tier: "gold", icon: "🥇", perkEn: "15% off + priority reservations", perkAr: "خصم ١٥٪ + حجوزات أولوية", sortOrder: 2 },
    { nameEn: "Platinum", nameAr: "بلاتيني", points: 3000, tier: "platinum", icon: "💎", perkEn: "20% off + chef's tasting menu", perkAr: "خصم ٢٠٪ + قائمة تذوق الشيف", sortOrder: 3 },
  ];
  for (const t of tiers) { await db.rewardTier.create({ data: { ...t, isActive: true } }); }
  console.log(`  ✓ ${tiers.length} reward tiers`);

  // ── 15. GIFT CARDS ──
  const gcData = [
    { code: `GC-${uid()}`, amount: 50, balance: 50, purchaserName: "Ahmed Khalil", recipientName: "Fatima Ali", message: "Happy Birthday!", template: "birthday" },
    { code: `GC-${uid()}`, amount: 100, balance: 75, purchaserName: "Omar Hassan", recipientName: "Layla Mahmoud", message: "Thank you for your business", template: "thank_you" },
    { code: `GC-${uid()}`, amount: 25, balance: 25, purchaserName: "John Smith", recipientName: "Sara Nabil", message: "", template: "classic" },
  ];
  for (const g of gcData) { await db.giftCard.create({ data: { ...g, isRedeemed: false } }); }
  console.log(`  ✓ ${gcData.length} gift cards`);

  // ── 16. TESTIMONIALS ──
  const testimonials = [
    { nameEn: "Ahmed K.", nameAr: "أحمد ك.", commentEn: "Best grill in town! The mixed platter is enormous and delicious.", commentAr: "أفضل مشاوي في المدينة! الصحن المشكل ضخم ولذيذ.", stars: 5, avatar: "👨" },
    { nameEn: "Fatima A.", nameAr: "فاطمة ع.", commentEn: "The kunafa is to die for. Service was warm and fast.", commentAr: "الكنافة لا تُقاوم. الخدمة كانت ودودة وسريعة.", stars: 5, avatar: "👩" },
    { nameEn: "John M.", nameAr: "جون م.", commentEn: "Came for lunch special — incredible value. Will return.", commentAr: "جئت لعرض الغداء — قيمة رائعة. سأعود.", stars: 5, avatar: "👨" },
    { nameEn: "Noor H.", nameAr: "نور ح.", commentEn: "Beautiful ambiance and the staff remembered my name.", commentAr: "أجواء جميلة والموظفون تذكروا اسمي. خدمة راقية.", stars: 5, avatar: "👩" },
  ];
  for (const t of testimonials) { await db.testimonial.create({ data: { ...t, sortOrder: 0, isActive: true } }); }
  console.log(`  ✓ ${testimonials.length} testimonials`);

  // ── 17. FEEDBACK ──
  const feedbackData = [
    { name: "Ahmed Khalil", email: "ahmed@email.com", rating: 5, comment: "Amazing food and great service!" },
    { name: "Fatima Ali", email: "fatima@email.com", rating: 4, comment: "Love the kunafa, will come again." },
    { name: "John Smith", email: "john@email.com", rating: 5, comment: "Best restaurant in Baghdad." },
    { name: "Layla Mahmoud", email: "layla@email.com", rating: 3, comment: "Good food but wait time was long." },
  ];
  for (const f of feedbackData) { await db.feedback.create({ data: f }); }
  console.log(`  ✓ ${feedbackData.length} feedback entries`);

  // ── 18. NEWSLETTER SUBSCRIPTIONS ──
  const nlEmails = ["ahmed@email.com", "fatima@email.com", "john@email.com", "newsletter@test.com"];
  for (const e of nlEmails) { await db.newsletterSubscription.create({ data: { email: e } }); }
  console.log(`  ✓ ${nlEmails.length} newsletter subscriptions`);

  // ── 19. INGREDIENTS (INVENTORY) ──
  const ingredients = [
    { name: "Chicken Breast", unit: "kg", qty: 25, low: 10, cost: 6.5, supplier: "Baghdad Poultry", cat: "Meat" },
    { name: "Lamb", unit: "kg", qty: 18, low: 8, cost: 14, supplier: "Local Farms", cat: "Meat" },
    { name: "Beef Mince", unit: "kg", qty: 6, low: 8, cost: 11, supplier: "Local Farms", cat: "Meat" },
    { name: "Salmon Fillet", unit: "kg", qty: 4, low: 5, cost: 22, supplier: "Gulf Seafood", cat: "Seafood" },
    { name: "Shrimp", unit: "kg", qty: 8, low: 4, cost: 18, supplier: "Gulf Seafood", cat: "Seafood" },
    { name: "Mozzarella", unit: "kg", qty: 12, low: 5, cost: 7, supplier: "Dairy Co", cat: "Dairy" },
    { name: "Pita Bread", unit: "pcs", qty: 120, low: 40, cost: 0.3, supplier: "Bakery", cat: "Bakery" },
    { name: "Tomatoes", unit: "kg", qty: 30, low: 10, cost: 1.5, supplier: "Vegetable Market", cat: "Produce" },
    { name: "Lemons", unit: "pcs", qty: 60, low: 30, cost: 0.2, supplier: "Vegetable Market", cat: "Produce" },
    { name: "Rice Basmati", unit: "kg", qty: 40, low: 15, cost: 2.5, supplier: "Grain Co", cat: "Grains" },
    { name: "Olive Oil", unit: "liters", qty: 8, low: 4, cost: 9, supplier: "Oil Importers", cat: "Oils" },
    { name: "Pistachios", unit: "kg", qty: 3, low: 2, cost: 25, supplier: "Nut Importers", cat: "Nuts" },
  ];
  for (const i of ingredients) { await db.ingredient.create({ data: { name: i.name, unit: i.unit, quantity: i.qty, lowThreshold: i.low, costPerUnit: i.cost, supplier: i.supplier, category: i.cat } }); }
  console.log(`  ✓ ${ingredients.length} ingredients`);

  // ── 20. WASTE LOGS ──
  const wasteData = [
    { ingredientName: "Tomatoes", quantity: 2, reason: "expired", notes: "Overripe", reportedBy: "Yusuf" },
    { ingredientName: "Pita Bread", quantity: 10, reason: "burned", notes: "Overcooked in oven", reportedBy: "Yusuf" },
    { ingredientName: "Lamb", quantity: 0.5, reason: "trimming", notes: "Fat trimming waste", reportedBy: "Yusuf" },
  ];
  for (const w of wasteData) { await db.wasteLog.create({ data: w }); }
  console.log(`  ✓ ${wasteData.length} waste logs`);

  // ── 21. PURCHASE ORDERS ──
  const poData = [
    { supplier: "Baghdad Poultry", notes: "Weekly chicken order", status: "ordered", totalCost: 325 },
    { supplier: "Gulf Seafood", notes: "Salmon and shrimp restock", status: "draft", totalCost: 480 },
    { supplier: "Vegetable Market", notes: "Fresh produce delivery", status: "received", totalCost: 120 },
  ];
  for (const p of poData) { await db.purchaseOrder.create({ data: p }); }
  console.log(`  ✓ ${poData.length} purchase orders`);

  // ── 22. CASH DRAWER ──
  const cashData = [
    { type: "payin", amount: 500, note: "Opening balance", createdBy: "Admin" },
    { type: "sale", amount: 45.5, note: "Order #1001", createdBy: "Sarah" },
    { type: "sale", amount: 72.99, note: "Order #1002", createdBy: "Sarah" },
    { type: "payout", amount: 50, note: "Supplier payment", createdBy: "Omar Manager" },
    { type: "drop", amount: 100, note: "Cash drop to safe", createdBy: "Admin" },
  ];
  for (const c of cashData) { await db.cashDrawerEntry.create({ data: c }); }
  console.log(`  ✓ ${cashData.length} cash drawer entries`);

  // ── 23. NOTIFICATIONS ──
  const notifData = [
    { type: "info", title: "Welcome", message: "Restaurant management system is ready", isRead: false },
    { type: "warning", title: "Low Stock", message: "Salmon Fillet is below threshold (4kg left)", isRead: false },
    { type: "success", title: "Order Completed", message: "Order #1003 has been completed", isRead: true },
    { type: "info", title: "New Reservation", message: "Ahmed Khalil reserved table 6 for tomorrow", isRead: false },
  ];
  for (const n of notifData) { await db.notification.create({ data: n }); }
  console.log(`  ✓ ${notifData.length} notifications`);

  // ── 24. DYNAMIC PRICING ──
  const dpData = [
    { nameEn: "Happy Hour Beverages", nameAr: "مشروبات ساعة السعادة", type: "happy_hour", multiplier: 0.7, dayOfWeek: -1, startTime: "14:00", endTime: "17:00", isActive: true },
    { nameEn: "Weekend Surge", nameAr: "زيادة عطلة نهاية الأسبوع", type: "surge", multiplier: 1.15, dayOfWeek: 5, startTime: "18:00", endTime: "22:00", isActive: true },
    { nameEn: "Tuesday Lunch", nameAr: "غداء الثلاثاء", type: "lunch_special", multiplier: 0.85, dayOfWeek: 2, startTime: "12:00", endTime: "15:00", isActive: true },
  ];
  for (const d of dpData) { await db.dynamicPricing.create({ data: d }); }
  console.log(`  ✓ ${dpData.length} dynamic pricing rules`);

  // ── 25. COMBO MEALS ──
  const comboData = [
    { nameEn: "Grill Combo", nameAr: "كومبو المشاوي", descriptionEn: "Mixed grill + rice + salad + drink for 4 people", descriptionAr: "مشاوي مشكل + أرز + سلطة + مشروب لـ٤ أشخاص", price: 85, items: "[]", isActive: true, sortOrder: 0 },
    { nameEn: "Pizza Night", nameAr: "ليلة البيتزا", descriptionEn: "2 large pizzas + 4 drinks + sides", descriptionAr: "٢ بيتزا كبيرة + ٤ مشروبات + إضافات", price: 45, items: "[]", isActive: true, sortOrder: 1 },
    { nameEn: "Family Feast", nameAr: "وليمة العائلة", descriptionEn: "Appetizer platter + grill platter + desserts + drinks for 6", descriptionAr: "مقبلات + مشاوي + حلويات + مشروبات لـ٦", price: 120, items: "[]", isActive: true, sortOrder: 2 },
  ];
  for (const c of comboData) { await db.comboMeal.create({ data: c }); }
  console.log(`  ✓ ${comboData.length} combo meals`);

  // ── Summary ──
  console.log("\n✅ Seed complete!");
  console.log(`   ${await db.restaurantSettings.count()} settings`);
  console.log(`   ${await db.kitchenStation.count()} stations`);
  console.log(`   ${await db.kitchenScreen.count()} KDS screens`);
  console.log(`   ${await db.menuCategory.count()} categories`);
  console.log(`   ${await db.menuItem.count()} menu items`);
  console.log(`   ${await db.modifierGroup.count()} modifier groups`);
  console.log(`   ${await db.modifierOption.count()} modifier options`);
  console.log(`   ${await db.restaurantTable.count()} tables`);
  console.log(`   ${await db.employee.count()} employees`);
  console.log(`   ${await db.schedule.count()} schedules`);
  console.log(`   ${await db.customer.count()} customers`);
  console.log(`   ${await db.reservation.count()} reservations`);
  console.log(`   ${await db.waitlistEntry.count()} waitlist entries`);
  console.log(`   ${await db.order.count()} orders`);
  console.log(`   ${await db.orderItem.count()} order items`);
  console.log(`   ${await db.specialOffer.count()} special offers`);
  console.log(`   ${await db.promoCode.count()} promo codes`);
  console.log(`   ${await db.rewardTier.count()} reward tiers`);
  console.log(`   ${await db.giftCard.count()} gift cards`);
  console.log(`   ${await db.testimonial.count()} testimonials`);
  console.log(`   ${await db.feedback.count()} feedback entries`);
  console.log(`   ${await db.newsletterSubscription.count()} newsletter subs`);
  console.log(`   ${await db.ingredient.count()} ingredients`);
  console.log(`   ${await db.wasteLog.count()} waste logs`);
  console.log(`   ${await db.purchaseOrder.count()} purchase orders`);
  console.log(`   ${await db.cashDrawerEntry.count()} cash drawer entries`);
  console.log(`   ${await db.notification.count()} notifications`);
  console.log(`   ${await db.dynamicPricing.count()} dynamic pricing rules`);
  console.log(`   ${await db.comboMeal.count()} combo meals`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
