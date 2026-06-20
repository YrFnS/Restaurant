import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const db = new PrismaClient();

function rid(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data (idempotent)
  const tablenames = [
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer",
    "ModifierOption", "ModifierGroup", "MenuItem", "MenuCategory",
    "RestaurantTable", "KitchenScreen", "KitchenStation",
    "Employee", "Schedule", "Ingredient", "WasteLog", "PurchaseOrder",
    "CashDrawerEntry", "Notification", "SpecialOffer", "PromoCode",
    "RewardTier", "GiftCard", "Feedback", "Testimonial",
    "NewsletterSubscription", "DynamicPricing", "ComboMeal",
  ];
  for (const t of tablenames) {
    await (db as any)[t[0].toLowerCase() + t.slice(1)].deleteMany();
  }
  await db.restaurantSettings.deleteMany();

  // ─── Settings ───
  await db.restaurantSettings.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      nameEn: "Saffron & Spice",
      nameAr: "زعفران وبهارات",
      taglineEn: "Flavors worth savoring",
      taglineAr: "نكهات تستحق التذوق",
      descriptionEn:
        "Experience the finest flavors crafted with passion and tradition. From sizzling grills to delicate desserts, every dish tells a story.",
      descriptionAr:
        "اختبر أجود النكهات المصنوعة بشغف وتقاليد. من المشاوي المشتعلة إلى الحلويات الرقيقة، كل طبق يحكي قصة.",
      phone: "+964 750 123 4567",
      email: "hello@saffronspice.com",
      addressEn: "Al-Rasheed Street, Baghdad",
      addressAr: "شارع الرشيد، بغداد",
      latitude: 33.3152,
      longitude: 44.3661,
      taxRate: 0.1,
      currency: "USD",
      currencySymbol: "$",
      deliveryFee: 4.99,
      minDeliveryOrder: 15.0,
      deliveryRadiusKm: 10.0,
      avgPrepTimeMin: 25,
      tipPresets: "15,18,20",
      openTime: "10:00",
      closeTime: "23:00",
      facebookUrl: "https://facebook.com/saffronspice",
      instagramUrl: "https://instagram.com/saffronspice",
      whatsappUrl: "https://wa.me/9647501234567",
      statsOrdersServed: 48250,
      statsHappyCustomers: 12300,
      statsYearsService: 12,
      kdsGreenMin: 10,
      kdsYellowMin: 18,
      kdsRedMin: 25,
      soundOnNewTicket: true,
    },
  });

  // ─── Kitchen Stations ───
  const stations = [
    { name: "Grill", slug: "grill", icon: "Flame", color: "#ef4444", targetPrepMin: 15, sortOrder: 0 },
    { name: "Prep", slug: "prep", icon: "ChefHat", color: "#f59e0b", targetPrepMin: 12, sortOrder: 1 },
    { name: "Bar", slug: "bar", icon: "Wine", color: "#8b5cf6", targetPrepMin: 8, sortOrder: 2 },
    { name: "Dessert", slug: "dessert", icon: "Cake", color: "#ec4899", targetPrepMin: 10, sortOrder: 3 },
  ];
  for (const s of stations) {
    await db.kitchenStation.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }

  // ─── Kitchen Screens (unique URLs) ───
  const screens = [
    { name: "Grill Station", slug: "grill", description: "Grill & hot kitchen display", stationFilter: "grill", screenType: "prep", sortOrder: 0 },
    { name: "Prep Station", slug: "prep", description: "Cold prep & appetizers", stationFilter: "prep", screenType: "prep", sortOrder: 1 },
    { name: "Bar Station", slug: "bar", description: "Beverages & drinks", stationFilter: "bar", screenType: "prep", sortOrder: 2 },
    { name: "Dessert Station", slug: "dessert", description: "Desserts & sweets", stationFilter: "dessert", screenType: "prep", sortOrder: 3 },
    { name: "Expo View", slug: "expo", description: "Expeditor — all stations consolidated", stationFilter: "", screenType: "expo", sortOrder: 4 },
  ];
  for (const sc of screens) {
    await db.kitchenScreen.upsert({
      where: { slug: sc.slug },
      update: {},
      create: { ...sc, autoRefreshSec: 10, layoutType: "grid", showCompleted: false, maxOrders: 0, isActive: true },
    });
  }

  // ─── Menu Categories ───
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
  for (const c of cats) {
    const cat = await db.menuCategory.create({ data: c });
    catMap[c.nameEn] = cat.id;
  }

  // ─── Menu Items with modifiers ───
  type ItemInput = {
    nameEn: string; nameAr: string; descEn: string; descAr: string; price: number;
    cat: string; popular?: boolean; special?: boolean; isNew?: boolean;
    prep: number; cal: number; allergens: string; dietary: string;
    groups?: { nameEn: string; nameAr: string; required?: boolean; min?: number; max?: number;
      options: { nameEn: string; nameAr: string; price?: number; preset?: string }[] }[];
  };

  const items: ItemInput[] = [
    // Appetizers
    {
      nameEn: "Hummus Beiruti", nameAr: "حمص بيروتي", cat: "Appetizers",
      descEn: "Creamy chickpea purée with tahini, lemon, and olive oil. Served with warm pita.",
      descAr: "مهروش الحمص مع الطحينة والليمون وزيت الزيتون. يقدم مع الخبز الدافئ.",
      price: 7.5, popular: true, prep: 8, cal: 320, allergens: "sesame,gluten", dietary: "vegetarian,vegan,halal",
      groups: [
        { nameEn: "Size", nameAr: "الحجم", required: true, max: 1, options: [
          { nameEn: "Regular", nameAr: "عادي" }, { nameEn: "Large", nameAr: "كبير", price: 3 } ] },
        { nameEn: "Add-ons", nameAr: "إضافات", max: 3, options: [
          { nameEn: "Extra olive oil", nameAr: "زيت زيتون إضافي", price: 1 },
          { nameEn: "Pine nuts", nameAr: "صنوبر", price: 2 },
          { nameEn: "Spicy", nameAr: "حار", price: 0.5, preset: "spicy" } ] },
      ],
    },
    {
      nameEn: "Falafel Plate", nameAr: "صحن الفلافل", cat: "Appetizers",
      descEn: "Crispy chickpea fritters with herbs, tahini sauce, and pickles.",
      descAr: "أقراص الحمص المقلية مع الأعشاب وصلصة الطحينة والمخللات.",
      price: 8.0, prep: 10, cal: 410, allergens: "gluten", dietary: "vegetarian,vegan,halal",
    },
    {
      nameEn: "Stuffed Grape Leaves", nameAr: "ورق عنب محشي", cat: "Appetizers",
      descEn: "Hand-rolled vine leaves stuffed with spiced rice and herbs.",
      descAr: "ورق عنب محشو يدوياً بالأرز المتبل والأعشاب.",
      price: 9.5, special: true, prep: 12, cal: 280, allergens: "", dietary: "vegetarian,vegan,halal",
    },
    // Soups
    {
      nameEn: "Lentil Soup", nameAr: "شوربة العدس", cat: "Soups",
      descEn: "Hearty red lentil soup with cumin and a squeeze of lemon.",
      descAr: "شوربة العدس الأحمر الغنية بالكمون وقطرة الليمون.",
      price: 5.5, popular: true, prep: 6, cal: 220, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free",
    },
    {
      nameEn: "Seafood Chowder", nameAr: "شوربة المأكولات البحرية", cat: "Soups",
      descEn: "Creamy chowder with shrimp, fish, and potatoes.",
      descAr: "شوربة كريمية بالروبيان والسمك والبطاطا.",
      price: 8.5, prep: 10, cal: 380, allergens: "dairy,seafood", dietary: "halal",
    },
    // Grills
    {
      nameEn: "Mixed Grill Platter", nameAr: "صحن مشاوي مشكل", cat: "Grills",
      descEn: "Shish tawook, kebab, and lamb chops with grilled tomatoes and onions.",
      descAr: "شيش طاووق وكباب وأضلاع خاروف مع الطماطم والبصل المشوي.",
      price: 28.0, popular: true, prep: 20, cal: 950, allergens: "", dietary: "halal",
      groups: [
        { nameEn: "Doneness", nameAr: "نضج اللحم", required: true, max: 1, options: [
          { nameEn: "Medium", nameAr: "متوسط" }, { nameEn: "Well done", nameAr: "ناضج تماماً" },
          { nameEn: "Medium rare", nameAr: "نصف ناضج" } ] },
        { nameEn: "Sides", nameAr: "إضافات جانبية", max: 2, options: [
          { nameEn: "Garlic sauce", nameAr: "صلصة الثوم", price: 1.5 },
          { nameEn: "Grilled vegetables", nameAr: "خضار مشوية", price: 3 },
          { nameEn: "Rice", nameAr: "أرز", price: 2.5 } ] },
      ],
    },
    {
      nameEn: "Shish Tawook", nameAr: "شيش طاووق", cat: "Grills",
      descEn: "Marinated chicken skewers grilled to perfection with garlic toum.",
      descAr: "أسياخ الدجاج المتتبلة المشوية مع ثوم الطحينة.",
      price: 16.0, popular: true, prep: 16, cal: 620, allergens: "", dietary: "halal",
    },
    {
      nameEn: "Lamb Kebab", nameAr: "كباب خاروف", cat: "Grills",
      descEn: "Hand-minced lamb with parsley, onion, and seven spices.",
      descAr: "خاروف مفروم يدوياً مع البقدونس والبصل وسبع بهارات.",
      price: 18.0, prep: 18, cal: 720, allergens: "", dietary: "halal",
    },
    {
      nameEn: "Spicy Wings", nameAr: "أجنحة حارة", cat: "Grills",
      descEn: "Char-grilled chicken wings tossed in our signature spicy glaze.",
      descAr: "أجنحة دجاج مشوية مع صلصتنا الحارة المميزة.",
      price: 12.0, special: true, prep: 14, cal: 480, allergens: "", dietary: "spicy,halal",
      groups: [
        { nameEn: "Spice Level", nameAr: "مستوى الحرارة", required: true, max: 1, options: [
          { nameEn: "Mild", nameAr: "خفيف" }, { nameEn: "Medium", nameAr: "متوسط", preset: "spicy" },
          { nameEn: "Hot", nameAr: "حار", preset: "spicy" }, { nameEn: "Inferno", nameAr: "جحيم", preset: "spicy" } ] },
      ],
    },
    // Seafood
    {
      nameEn: "Grilled Salmon", nameAr: "سمك السلمون المشوي", cat: "Seafood",
      descEn: "Atlantic salmon fillet with lemon butter and dill.",
      descAr: "فيليه سلمون أطلسي مع زبدة الليمون والشبت.",
      price: 24.0, special: true, prep: 18, cal: 540, allergens: "fish,dairy", dietary: "halal,gluten_free",
    },
    {
      nameEn: "Shrimp Linguine", nameAr: "لينغويني بالروبيان", cat: "Seafood",
      descEn: "Sautéed shrimp with garlic, chili, and cherry tomatoes over linguine.",
      descAr: "روبيان سوتيه مع الثوم والفلفل وطماطم الكرز فوق لينغويني.",
      price: 21.0, prep: 16, cal: 680, allergens: "gluten,seafood", dietary: "halal",
    },
    // Pasta
    {
      nameEn: "Truffle Mushroom Pasta", nameAr: "معكرونة الفطر بالكمأة", cat: "Pasta",
      descEn: "Fettuccine in a creamy truffle sauce with wild mushrooms.",
      descAr: "فيتوتشيني بصلصة الكمأة الكريمية مع الفطر البري.",
      price: 19.0, popular: true, prep: 15, cal: 720, allergens: "gluten,dairy", dietary: "vegetarian",
    },
    {
      nameEn: "Spicy Arrabbiata", nameAr: "أرابياتا الحارة", cat: "Pasta",
      descEn: "Penne in a spicy tomato sauce with garlic and basil.",
      descAr: "بيني بصلصة الطماطم الحارة مع الثوم والريحان.",
      price: 15.0, prep: 14, cal: 580, allergens: "gluten", dietary: "vegetarian,vegan,spicy",
    },
    // Pizza
    {
      nameEn: "Margherita", nameAr: "مارغريتا", cat: "Pizza",
      descEn: "San Marzano tomato, fresh mozzarella, and basil.",
      descAr: "طماطم سان مارزانو وموزاريلا طازجة وريحان.",
      price: 14.0, popular: true, prep: 15, cal: 850, allergens: "gluten,dairy", dietary: "vegetarian",
      groups: [
        { nameEn: "Size", nameAr: "الحجم", required: true, max: 1, options: [
          { nameEn: "Medium (10\")", nameAr: "وسط" }, { nameEn: "Large (14\")", nameAr: "كبير", price: 5 } ] },
        { nameEn: "Crust", nameAr: "العجينة", required: true, max: 1, options: [
          { nameEn: "Classic", nameAr: "كلاسيكية" }, { nameEn: "Thin", nameAr: "رفيعة" },
          { nameEn: "Stuffed crust", nameAr: "محشية الأطراف", price: 3 } ] },
      ],
    },
    {
      nameEn: "Spicy Pepperoni", nameAr: "بيبروني الحارة", cat: "Pizza",
      descEn: "Spicy beef pepperoni, mozzarella, and chili flakes.",
      descAr: "بيبروني لحم البقر الحار وموزاريلا ورقائق الفلفل الحار.",
      price: 17.0, prep: 16, cal: 980, allergens: "gluten,dairy", dietary: "spicy,halal",
    },
    // Salads
    {
      nameEn: "Fattoush", nameAr: "فتوش", cat: "Salads",
      descEn: "Crisp romaine, radish, sumac, and crispy pita with pomegranate dressing.",
      descAr: "خس روماني مقرمش وفجل وسماق وخبز مقرمز مع صلصة الرمان.",
      price: 9.0, popular: true, prep: 8, cal: 240, allergens: "gluten", dietary: "vegetarian,vegan,halal",
    },
    {
      nameEn: "Caesar Salad", nameAr: "سلطة سيزر", cat: "Salads",
      descEn: "Romaine, croutons, parmesan, and grilled chicken.",
      descAr: "خس روماني وخبز محمص وبارميزان ودجاج مشوي.",
      price: 11.0, prep: 10, cal: 380, allergens: "gluten,dairy,eggs", dietary: "halal",
    },
    // Desserts
    {
      nameEn: "Kunafa", nameAr: "كنافة", cat: "Desserts",
      descEn: "Warm knafeh with melted cheese, pistachios, and orange-blossom syrup.",
      descAr: "كنافة دافئة بالجبن الذائب والفستق وشراب ماء الزهر.",
      price: 9.5, popular: true, special: true, prep: 12, cal: 520, allergens: "gluten,dairy,nuts", dietary: "vegetarian,halal",
    },
    {
      nameEn: "Baklava (4 pcs)", nameAr: "بقلاوة (٤ قطع)", cat: "Desserts",
      descEn: "Layered filo with pistachios and honey syrup.",
      descAr: "عجينة الفيلو الطبقات مع الفستق وشراب العسل.",
      price: 7.0, prep: 5, cal: 380, allergens: "gluten,dairy,nuts", dietary: "vegetarian,halal",
    },
    {
      nameEn: "Chocolate Lava Cake", nameAr: "كيكة الشوكولاتة البركانية", cat: "Desserts",
      descEn: "Warm chocolate cake with a molten center, vanilla ice cream.",
      descAr: "كيكة شوكولاتة دافئة بقلب ذائب مع آيس كريم الفانيليا.",
      price: 8.5, isNew: true, prep: 10, cal: 610, allergens: "gluten,dairy,eggs", dietary: "vegetarian",
    },
    // Beverages
    {
      nameEn: "Fresh Mint Lemonade", nameAr: "ليموناضة بالنعناع الطازج", cat: "Beverages",
      descEn: "Hand-pressed lemonade with crushed mint.",
      descAr: "ليموناضة معصورة يدوياً مع النعناع المهروس.",
      price: 4.5, popular: true, prep: 4, cal: 140, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free",
    },
    {
      nameEn: "Turkish Coffee", nameAr: "قهوة تركية", cat: "Beverages",
      descEn: "Traditional finely-ground coffee brewed in a cezve.",
      descAr: "قهوة مطحونة ناعماً تقليدياً مطبوخة في ركوة.",
      price: 3.5, prep: 5, cal: 5, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free",
    },
    {
      nameEn: "Pomegranate Mocktail", nameAr: "موكتيل الرمان", cat: "Beverages",
      descEn: "Pomegranate, lime, and soda with rosemary.",
      descAr: "رمان وليمون وصودا مع إكليل الجبل.",
      price: 6.0, isNew: true, prep: 5, cal: 120, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free",
    },
    {
      nameEn: "Soft Drinks", nameAr: "مشروبات غازية", cat: "Beverages",
      descEn: "Choice of cola, lemon-lime, or orange.",
      descAr: "اختيار من الكولا أو الليمون أو البرتقال.",
      price: 2.5, prep: 1, cal: 150, allergens: "", dietary: "vegetarian,halal",
      groups: [
        { nameEn: "Flavor", nameAr: "النكهة", required: true, max: 1, options: [
          { nameEn: "Cola", nameAr: "كولا" }, { nameEn: "Lemon-Lime", nameAr: "ليمون" },
          { nameEn: "Orange", nameAr: "برتقال" } ] },
      ],
    },
    // Sides
    {
      nameEn: "Truffle Fries", nameAr: "بطاطا الكمأة", cat: "Sides",
      descEn: "Hand-cut fries with truffle oil and parmesan.",
      descAr: "بطاطا مقطعة يدوياً مع زيت الكمأة والبارميزان.",
      price: 6.5, popular: true, prep: 8, cal: 420, allergens: "dairy", dietary: "vegetarian,halal",
    },
    {
      nameEn: "Garlic Rice", nameAr: "أرز بالثوم", cat: "Sides",
      descEn: "Fragrant basmati rice toasted with garlic.",
      descAr: "أرز بسمتي عطري محمص بالثوم.",
      price: 4.0, prep: 6, cal: 280, allergens: "", dietary: "vegetarian,vegan,halal",
    },
    {
      nameEn: "Grilled Vegetables", nameAr: "خضار مشوية", cat: "Sides",
      descEn: "Seasonal vegetables char-grilled with herbs.",
      descAr: "خضار موسمية مشوية بالأعشاب.",
      price: 5.5, prep: 7, cal: 160, allergens: "", dietary: "vegetarian,vegan,halal,gluten_free",
    },
  ];

  for (const it of items) {
    const catId = catMap[it.cat];
    if (!catId) continue;
    const item = await db.menuItem.create({
      data: {
        nameEn: it.nameEn, nameAr: it.nameAr,
        descriptionEn: it.descEn, descriptionAr: it.descAr,
        price: it.price,
        isAvailable: true,
        isPopular: !!it.popular,
        isSpecial: !!it.special,
        isNew: !!it.isNew,
        preparationTime: it.prep,
        calories: it.cal,
        allergens: it.allergens,
        dietary: it.dietary,
        categoryId: catId,
        image: "",
      },
    });
    if (it.groups) {
      for (let gi = 0; gi < it.groups.length; gi++) {
        const g = it.groups[gi];
        const grp = await db.modifierGroup.create({
          data: {
            nameEn: g.nameEn, nameAr: g.nameAr,
            isRequired: !!g.required, minSelect: g.min ?? 0, maxSelect: g.max ?? 1,
            sortOrder: gi, menuItemId: item.id,
          },
        });
        for (const o of g.options) {
          await db.modifierOption.create({
            data: {
              nameEn: o.nameEn, nameAr: o.nameAr,
              price: o.price ?? 0, isDefault: false,
              preset: o.preset ?? "none", groupId: grp.id,
            },
          });
        }
      }
    }
  }

  // ─── Tables (floor plan) ───
  const tableLayout = [
    // Main section
    { n: 1, cap: 2, sec: "main", x: 60, y: 60, shape: "round" },
    { n: 2, cap: 2, sec: "main", x: 220, y: 60, shape: "round" },
    { n: 3, cap: 4, sec: "main", x: 60, y: 180, shape: "square" },
    { n: 4, cap: 4, sec: "main", x: 220, y: 180, shape: "square" },
    { n: 5, cap: 4, sec: "main", x: 380, y: 180, shape: "square" },
    { n: 6, cap: 6, sec: "main", x: 60, y: 320, shape: "square" },
    { n: 7, cap: 6, sec: "main", x: 220, y: 320, shape: "square" },
    { n: 8, cap: 8, sec: "main", x: 380, y: 320, shape: "square" },
    // Patio
    { n: 9, cap: 2, sec: "patio", x: 560, y: 60, shape: "round" },
    { n: 10, cap: 4, sec: "patio", x: 560, y: 180, shape: "round" },
    { n: 11, cap: 4, sec: "patio", x: 700, y: 180, shape: "round" },
    { n: 12, cap: 6, sec: "patio", x: 560, y: 320, shape: "square" },
    // Bar
    { n: 13, cap: 1, sec: "bar", x: 60, y: 460, shape: "square" },
    { n: 14, cap: 1, sec: "bar", x: 140, y: 460, shape: "square" },
    { n: 15, cap: 1, sec: "bar", x: 220, y: 460, shape: "square" },
    { n: 16, cap: 1, sec: "bar", x: 300, y: 460, shape: "square" },
    // Private
    { n: 17, cap: 8, sec: "private", x: 560, y: 460, shape: "square" },
    { n: 18, cap: 10, sec: "private", x: 700, y: 460, shape: "square" },
    { n: 19, cap: 4, sec: "private", x: 840, y: 180, shape: "square" },
    { n: 20, cap: 6, sec: "private", x: 840, y: 320, shape: "square" },
  ];
  for (const t of tableLayout) {
    await db.restaurantTable.create({
      data: {
        number: t.n, capacity: t.cap, section: t.sec, shape: t.shape,
        x: t.x, y: t.y, width: t.cap <= 2 ? 70 : 90, height: t.cap <= 2 ? 70 : 90,
        status: t.n <= 5 ? "seated" : "open",
        serverName: t.n <= 5 ? "Sarah" : "",
        seatedAt: t.n <= 5 ? new Date(Date.now() - 15 * 60 * 1000) : null,
      },
    });
  }

  // ─── Employees ───
  const emps = [
    { name: "Admin", pin: "1234", role: "admin", hourlyWage: 25 },
    { name: "Omar Manager", pin: "2222", role: "manager", hourlyWage: 20 },
    { name: "Sarah", pin: "1111", role: "server", hourlyWage: 12 },
    { name: "Layla", pin: "3333", role: "server", hourlyWage: 12 },
    { name: "Yusuf", pin: "4444", role: "cook", hourlyWage: 16 },
    { name: "Mariam", pin: "5555", role: "bartender", hourlyWage: 14 },
    { name: "Hassan", pin: "6666", role: "host", hourlyWage: 11 },
  ];
  for (const e of emps) {
    await db.employee.create({ data: e });
  }

  // ─── Special Offers ───
  const offers = [
    { titleEn: "Happy Hour", titleAr: "ساعة السعادة", descEn: "30% off all beverages", descAr: "خصم ٣٠٪ على كل المشروبات", discount: 30 },
    { titleEn: "Family Feast", titleAr: "وليمة العائلة", descEn: "Mixed grill for 4 + 4 drinks — save 20%", descAr: "مشاوي مشكل لـ٤ + ٤ مشروبات — وفّر ٢٠٪", discount: 20 },
    { titleEn: "Lunch Special", titleAr: "عرض الغداء", descEn: "Pasta + soup + drink for $15", descAr: "معكرونة + شوربة + مشروب بـ١٥ دولار", discount: 15 },
  ];
  for (const o of offers) {
    await db.specialOffer.create({
      data: {
        titleEn: o.titleEn, titleAr: o.titleAr,
        descriptionEn: o.descEn, descriptionAr: o.descAr,
        discountPercent: o.discount, isActive: true,
      },
    });
  }

  // ─── Promo Codes ───
  const promos = [
    { code: "WELCOME10", discount: 10 },
    { code: "SPICE20", discount: 20 },
    { code: "FAMILY15", discount: 15 },
  ];
  for (const p of promos) {
    await db.promoCode.create({ data: { code: p.code, discountPercent: p.discount, isActive: true } });
  }

  // ─── Reward Tiers ───
  const tiers = [
    { nameEn: "Bronze", nameAr: "برونزي", points: 0, tier: "bronze", icon: "🥉", perkEn: "5% off after 500 pts", perkAr: "خصم ٥٪ بعد ٥٠٠ نقطة", sortOrder: 0 },
    { nameEn: "Silver", nameAr: "فضي", points: 500, tier: "silver", icon: "🥈", perkEn: "10% off + free dessert", perkAr: "خصم ١٠٪ + حلوى مجانية", sortOrder: 1 },
    { nameEn: "Gold", nameAr: "ذهبي", points: 1500, tier: "gold", icon: "🥇", perkEn: "15% off + priority reservations", perkAr: "خصم ١٥٪ + حجوزات أولوية", sortOrder: 2 },
    { nameEn: "Platinum", nameAr: "بلاتيني", points: 3000, tier: "platinum", icon: "💎", perkEn: "20% off + chef's tasting menu", perkAr: "خصم ٢٠٪ + قائمة تذوق الشيف", sortOrder: 3 },
  ];
  for (const t of tiers) {
    await db.rewardTier.create({ data: t });
  }

  // ─── Testimonials ───
  const testimonials = [
    { nameEn: "Ahmed K.", nameAr: "أحمد ك.", commentEn: "Best grill in town! The mixed platter is enormous and delicious.", commentAr: "أفضل مشاوي في المدينة! الصحن المشكل ضخم ولذيذ.", stars: 5, avatar: "👨" },
    { nameEn: "Fatima A.", nameAr: "فاطمة ع.", commentEn: "The kunafa is to die for. Service was warm and fast.", commentAr: "الكنافة لا تُقاوم. الخدمة كانت ودودة وسريعة.", stars: 5, avatar: "👩" },
    { nameEn: "John M.", nameAr: "جون م.", commentEn: "Came for lunch special — incredible value. Will return.", commentAr: "جئت لعرض الغداء — قيمة رائعة. سأعود.", stars: 5, avatar: "👨" },
    { nameEn: "Noor H.", nameAr: "نور ح.", commentEn: "Beautiful ambiance and the staff remembered my name. Class act.", commentAr: "أجواء جميلة والموظفون تذكروا اسمي. خدمة راقية.", stars: 5, avatar: "👩" },
  ];
  for (const t of testimonials) {
    await db.testimonial.create({ data: t });
  }

  // ─── Ingredients (inventory) ───
  const ingredients = [
    { name: "Chicken Breast", unit: "kg", quantity: 25, lowThreshold: 10, costPerUnit: 6.5, supplier: "Baghdad Poultry", category: "Meat" },
    { name: "Lamb", unit: "kg", quantity: 18, lowThreshold: 8, costPerUnit: 14, supplier: "Local Farms", category: "Meat" },
    { name: "Beef Mince", unit: "kg", quantity: 6, lowThreshold: 8, costPerUnit: 11, supplier: "Local Farms", category: "Meat" },
    { name: "Salmon Fillet", unit: "kg", quantity: 4, lowThreshold: 5, costPerUnit: 22, supplier: "Gulf Seafood", category: "Seafood" },
    { name: "Shrimp", unit: "kg", quantity: 8, lowThreshold: 4, costPerUnit: 18, supplier: "Gulf Seafood", category: "Seafood" },
    { name: "Mozzarella", unit: "kg", quantity: 12, lowThreshold: 5, costPerUnit: 7, supplier: "Dairy Co", category: "Dairy" },
    { name: "Pita Bread", unit: "pcs", quantity: 120, lowThreshold: 40, costPerUnit: 0.3, supplier: "Bakery", category: "Bakery" },
    { name: "Tomatoes", unit: "kg", quantity: 30, lowThreshold: 10, costPerUnit: 1.5, supplier: "Vegetable Market", category: "Produce" },
    { name: "Lemons", unit: "pcs", quantity: 60, lowThreshold: 30, costPerUnit: 0.2, supplier: "Vegetable Market", category: "Produce" },
    { name: "Rice Basmati", unit: "kg", quantity: 40, lowThreshold: 15, costPerUnit: 2.5, supplier: "Grain Co", category: "Grains" },
    { name: "Olive Oil", unit: "liters", quantity: 8, lowThreshold: 4, costPerUnit: 9, supplier: "Oil Importers", category: "Oils" },
    { name: "Pistachios", unit: "kg", quantity: 3, lowThreshold: 2, costPerUnit: 25, supplier: "Nut Importers", category: "Nuts" },
  ];
  for (const i of ingredients) {
    await db.ingredient.create({ data: i });
  }

  // ─── Sample orders for KDS demo ───
  const allItems = await db.menuItem.findMany({ include: { category: true } });
  const stationsByCat: Record<string, string> = {};
  for (const it of allItems) {
    stationsByCat[it.id] = it.category.stationSlugs || "prep";
  }

  const sampleOrders = [
    { type: "dine_in", tableNum: 3, items: ["Shish Tawook", "Hummus Beiruti", "Fresh Mint Lemonade"] },
    { type: "dine_in", tableNum: 5, items: ["Mixed Grill Platter", "Truffle Fries", "Turkish Coffee"] },
    { type: "dine_in", tableNum: 1, items: ["Margherita", "Caesar Salad"] },
    { type: "takeout", tableNum: 0, items: ["Spicy Wings", "Falafel Plate", "Pomegranate Mocktail"] },
  ];

  let orderCounter = 1001;
  for (const so of sampleOrders) {
    const orderItems = so.items.map((name) => allItems.find((i) => i.nameEn === name)).filter(Boolean);
    if (orderItems.length === 0) continue;
    const subtotal = orderItems.reduce((s, i) => s + (i!.price), 0);
    const tax = subtotal * 0.1;
    const table = so.tableNum ? await db.restaurantTable.findUnique({ where: { number: so.tableNum } }) : null;
    const order = await db.order.create({
      data: {
        orderNumber: `#${orderCounter++}`,
        type: so.type,
        status: "preparing",
        customerName: so.type === "dine_in" ? `Table ${so.tableNum}` : "Walk-in",
        customerPhone: "",
        subtotal,
        taxAmount: tax,
        total: subtotal + tax,
        paymentStatus: "unpaid",
        serverName: "Sarah",
        tableId: table?.id,
        estimatedReady: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    for (let k = 0; k < orderItems.length; k++) {
      const it = orderItems[k]!;
      await db.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: it.id,
          quantity: 1,
          unitPrice: it.price,
          totalPrice: it.price,
          status: k === 0 ? "preparing" : "pending",
          stationSlug: stationsByCat[it.id] || "prep",
          course: k < 2 ? 1 : 2,
          firedAt: k === 0 ? new Date(Date.now() - 5 * 60 * 1000) : null,
        },
      });
    }
  }

  // ─── Dynamic Pricing ───
  await db.dynamicPricing.create({
    data: {
      nameEn: "Happy Hour Beverages", nameAr: "مشروبات ساعة السعادة",
      type: "happy_hour", multiplier: 0.7, dayOfWeek: -1,
      startTime: "14:00", endTime: "17:00", isActive: true,
    },
  });

  console.log("✅ Seed complete!");
  console.log(`   - ${await db.menuCategory.count()} categories`);
  console.log(`   - ${await db.menuItem.count()} menu items`);
  console.log(`   - ${await db.restaurantTable.count()} tables`);
  console.log(`   - ${await db.kitchenStation.count()} kitchen stations`);
  console.log(`   - ${await db.kitchenScreen.count()} KDS screens`);
  console.log(`   - ${await db.employee.count()} employees`);
  console.log(`   - ${await db.order.count()} sample orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
