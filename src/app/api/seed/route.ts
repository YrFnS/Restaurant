import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPin } from "@/lib/pin-hash";
import { decodeSession } from "@/lib/auth";

async function seed() {
  console.log("🌱 Re-seeding database...");

  // Clear existing data in reverse dependency order
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.kitchenStation.deleteMany();
  await db.kitchenScreen.deleteMany();
  await db.reservation.deleteMany();
  await db.waitlistEntry.deleteMany();
  await db.giftCard.deleteMany();
  await db.specialOffer.deleteMany();
  await db.schedule.deleteMany();
  await db.cashDrawerEntry.deleteMany();
  await db.notification.deleteMany();
  await db.wasteLog.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.ingredient.deleteMany();
  await db.employee.deleteMany();
  await db.feedback.deleteMany();
  await db.modifier.deleteMany();
  await db.menuItem.deleteMany();
  await db.menuCategory.deleteMany();
  await db.restaurantTable.deleteMany();
  await db.customer.deleteMany();
  await db.restaurantSettings.deleteMany();
  await db.testimonial.deleteMany();
  await db.promoCode.deleteMany();
  await db.rewardTier.deleteMany();

  // Seed Restaurant Settings
  const settings = await db.restaurantSettings.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      nameEn: "Saffron Restaurant",
      nameAr: "مطعم الزعفران",
      taglineEn: "A Culinary Journey",
      taglineAr: "رحلة طهي",
      descriptionEn: "Experience the finest flavors crafted with passion and tradition",
      descriptionAr: "اختبر أجود النكهات المصنوعة بشغف وتقاليد",
      phone: "+1 555 123 4567",
      email: "hello@saffron.com",
      addressEn: "123 Gourmet Avenue, Food District",
      addressAr: "١٢٣ شارع الذواقة، حي الطعام",
      taxRate: 0.1,
      deliveryFee: 4.99,
      minDeliveryOrder: 15.0,
      avgPrepTime: 25,
      openTime: "10:00",
      closeTime: "23:00",
      statsOrdersServed: 1500,
      statsHappyCustomers: 800,
      statsYearsService: 5,
    },
  });

  // Seed Menu Categories
  const categories = await Promise.all([
    db.menuCategory.create({ data: { nameEn: "Appetizers", nameAr: "المقبلات", icon: "🥗", sortOrder: 1 } }),
    db.menuCategory.create({ data: { nameEn: "Soups", nameAr: "الشوربات", icon: "🍲", sortOrder: 2 } }),
    db.menuCategory.create({ data: { nameEn: "Grills", nameAr: "المشويات", icon: "🥩", sortOrder: 3 } }),
    db.menuCategory.create({ data: { nameEn: "Seafood", nameAr: "المأكولات البحرية", icon: "🦐", sortOrder: 4 } }),
    db.menuCategory.create({ data: { nameEn: "Pasta", nameAr: "الباستا", icon: "🍝", sortOrder: 5 } }),
    db.menuCategory.create({ data: { nameEn: "Pizza", nameAr: "البيتزا", icon: "🍕", sortOrder: 6 } }),
    db.menuCategory.create({ data: { nameEn: "Salads", nameAr: "السلطات", icon: "🥬", sortOrder: 7 } }),
    db.menuCategory.create({ data: { nameEn: "Desserts", nameAr: "الحلويات", icon: "🍰", sortOrder: 8 } }),
    db.menuCategory.create({ data: { nameEn: "Beverages", nameAr: "المشروبات", icon: "🥤", sortOrder: 9 } }),
    db.menuCategory.create({ data: { nameEn: "Sides", nameAr: "الإضافات", icon: "🍟", sortOrder: 10 } }),
  ]);

  const [appetizers, soups, grills, seafood, pasta, pizza, salads, desserts, beverages, sides] = categories;

  // Seed Menu Items
  const menuItems = [
    // Appetizers
    { nameEn: "Hummus Platter", nameAr: "طبق حمص", descriptionEn: "Creamy chickpea dip with tahini, olive oil, and warm pita", descriptionAr: "حمص كريمي بالطحينة وزيت الزيتون مع خبز دافئ", price: 8.99, categoryId: appetizers.id, isPopular: true, allergens: "sesame", dietary: "vegetarian,vegan,halal", calories: 220, preparationTime: 10, image: "/images/menu/appetizers.jpg" },
    { nameEn: "Falafel Bites", nameAr: "أقراص فلافل", descriptionEn: "Crispy herb-spiced chickpea fritters with tahini sauce", descriptionAr: "أقراص حمص مقرمشة بالأعشاب مع صلصة الطحينة", price: 9.99, categoryId: appetizers.id, isPopular: true, allergens: "sesame", dietary: "vegetarian,vegan,halal", calories: 280, preparationTime: 12, image: "/images/menu/appetizers.jpg" },
    { nameEn: "Stuffed Grape Leaves", nameAr: "ورق عنب محشي", descriptionEn: "Tender grape leaves filled with herbed rice and spices", descriptionAr: "ورق عنب طري محشي بالأرز المتبل", price: 10.99, categoryId: appetizers.id, isSpecial: true, dietary: "vegetarian,vegan,halal", calories: 180, preparationTime: 15, image: "/images/menu/appetizers.jpg" },
    { nameEn: "Crispy Samosas", nameAr: "سمبوسة مقرمشة", descriptionEn: "Golden fried pastries filled with spiced potatoes and peas", descriptionAr: "معجنات مقلية ذهبية محشية بالبطاطس والبازلاء", price: 7.99, categoryId: appetizers.id, allergens: "gluten", dietary: "vegetarian,halal,spicy", calories: 240, preparationTime: 10, image: "/images/menu/appetizers.jpg" },
    { nameEn: "Chicken Wings", nameAr: "أجنحة الدجاج", descriptionEn: "Smoky grilled wings with your choice of sauce", descriptionAr: "أجنحة مشوية مدخنة مع صلصة من اختيارك", price: 12.99, categoryId: appetizers.id, isPopular: true, dietary: "halal", calories: 380, preparationTime: 18, image: "/images/menu/appetizers.jpg" },

    // Soups
    { nameEn: "Lentil Soup", nameAr: "شوربة العدس", descriptionEn: "Hearty red lentil soup with lemon and croutons", descriptionAr: "شوربة عدس حمراء دسمة مع الليمون والخبز المحمص", price: 7.99, categoryId: soups.id, isPopular: true, dietary: "vegetarian,vegan,halal", calories: 200, preparationTime: 8, image: "/images/menu/soups.jpg" },
    { nameEn: "Chicken Soup", nameAr: "شوربة الدجاج", descriptionEn: "Comforting chicken broth with vegetables and herbs", descriptionAr: "مرق دجاج مريح مع الخضروات والأعشاب", price: 8.99, categoryId: soups.id, dietary: "halal", calories: 160, preparationTime: 10, image: "/images/menu/soups.jpg" },
    { nameEn: "Seafood Chowder", nameAr: "شوربة المأكولات البحرية", descriptionEn: "Rich creamy chowder with shrimp, fish, and potatoes", descriptionAr: "شوربة كريمية غنية بالروبيان والسمك والبطاطس", price: 11.99, categoryId: soups.id, isSpecial: true, allergens: "shellfish,fish,dairy", calories: 320, preparationTime: 12, image: "/images/menu/soups.jpg" },

    // Grills
    { nameEn: "Mixed Grill Platter", nameAr: "طبق مشويات مشكلة", descriptionEn: "Assorted kebabs, lamb chops, and grilled chicken with rice", descriptionAr: "مشويات متنوعة من الكباب ولحم الضلع والدجاج مع الأرز", price: 28.99, categoryId: grills.id, isPopular: true, isSpecial: true, dietary: "halal", calories: 850, preparationTime: 25, image: "/images/menu/grills.jpg" },
    { nameEn: "Lamb Kebab", nameAr: "كباب لحم", descriptionEn: "Tender lamb kebabs with grilled vegetables and saffron rice", descriptionAr: "كباب لحم طري مع الخضار المشوية وأرز بالزعفران", price: 22.99, categoryId: grills.id, isPopular: true, dietary: "halal", calories: 680, preparationTime: 22, image: "/images/menu/grills.jpg" },
    { nameEn: "Chicken Shawarma", nameAr: "شاورما دجاج", descriptionEn: "Marinated chicken with garlic sauce in warm pita bread", descriptionAr: "دجاج متبل بصلصة الثوم في خبز عربي دافئ", price: 14.99, categoryId: grills.id, isPopular: true, allergens: "gluten", dietary: "halal", calories: 520, preparationTime: 15, image: "/images/menu/grills.jpg" },
    { nameEn: "Beef Burger", nameAr: "برجر لحم", descriptionEn: "Juicy beef patty with cheddar, pickles, and special sauce", descriptionAr: "لحم بقري مع جبنة شيدر ومخللات وصلصة خاصة", price: 16.99, categoryId: grills.id, allergens: "gluten,dairy", dietary: "halal", calories: 720, preparationTime: 18, image: "/images/menu/grills.jpg" },
    { nameEn: "Lamb Chops", nameAr: "ريش لحم", descriptionEn: "Premium lamb chops with rosemary and mint sauce", descriptionAr: "ريش لحم فاقرة مع إكليل الجبل وصلصة النعناع", price: 32.99, categoryId: grills.id, isSpecial: true, dietary: "halal", calories: 580, preparationTime: 25, image: "/images/menu/grills.jpg" },

    // Seafood
    { nameEn: "Grilled Salmon", nameAr: "سلمون مشوي", descriptionEn: "Atlantic salmon with lemon butter and asparagus", descriptionAr: "سلمون أطلسي مع زبدة الليمون والهليون", price: 26.99, categoryId: seafood.id, isSpecial: true, allergens: "fish", calories: 420, preparationTime: 20, image: "/images/menu/seafood.jpg" },
    { nameEn: "Shrimp Scampi", nameAr: "روبيان سكامبي", descriptionEn: "Garlic butter shrimp with linguine pasta", descriptionAr: "روبيان بزبدة الثوم مع باستا لينجويني", price: 22.99, categoryId: seafood.id, isPopular: true, allergens: "shellfish,gluten", calories: 550, preparationTime: 18, image: "/images/menu/seafood.jpg" },
    { nameEn: "Fish Tacos", nameAr: "تاكوس السمك", descriptionEn: "Beer-battered fish with slaw and chipotle mayo", descriptionAr: "سمك مقلي مع سلطة الملفوف ومايو تشيبوتلي", price: 15.99, categoryId: seafood.id, allergens: "fish,gluten", dietary: "halal,spicy", calories: 380, preparationTime: 15, image: "/images/menu/seafood.jpg" },

    // Pasta
    { nameEn: "Truffle Mushroom Pasta", nameAr: "باستا الفطر بالكمأة", descriptionEn: "Fettuccine in creamy truffle sauce with wild mushrooms", descriptionAr: "فتوتشيني بصلصة الكمأة الكريمية مع الفطر البري", price: 19.99, categoryId: pasta.id, isSpecial: true, allergens: "gluten,dairy", dietary: "vegetarian", calories: 580, preparationTime: 18, image: "/images/menu/pasta.jpg" },
    { nameEn: "Chicken Alfredo", nameAr: "ألفريدو الدجاج", descriptionEn: "Creamy parmesan sauce with grilled chicken over fettuccine", descriptionAr: "صلصة بارميزان كريمية مع الدجاج المشوي على الفتوتشيني", price: 18.99, categoryId: pasta.id, isPopular: true, allergens: "gluten,dairy", dietary: "halal", calories: 720, preparationTime: 16, image: "/images/menu/pasta.jpg" },
    { nameEn: "Spaghetti Bolognese", nameAr: "سباغيتي بولونيز", descriptionEn: "Slow-cooked beef ragù with spaghetti and parmesan", descriptionAr: "صلصة لحم بطيئة مع السباغيتي والبارميزان", price: 16.99, categoryId: pasta.id, allergens: "gluten,dairy", dietary: "halal", calories: 650, preparationTime: 15, image: "/images/menu/pasta.jpg" },

    // Pizza
    { nameEn: "Margherita Pizza", nameAr: "بيتزا مارغريتا", descriptionEn: "Classic pizza with fresh mozzarella, basil, and tomato sauce", descriptionAr: "بيتزا كلاسيكية مع الموزاريلا الطازجة والريحان وصلصة الطماطم", price: 14.99, categoryId: pizza.id, isPopular: true, allergens: "gluten,dairy", dietary: "vegetarian,halal", calories: 680, preparationTime: 15, image: "/images/menu/pizza.jpg" },
    { nameEn: "Meat Lovers Pizza", nameAr: "بيتزا اللحوم", descriptionEn: "Loaded with beef, lamb, chicken, and pepperoni", descriptionAr: "محملة باللحم والضأن والدجاج والبيبروني", price: 19.99, categoryId: pizza.id, allergens: "gluten,dairy", dietary: "halal", calories: 890, preparationTime: 18, image: "/images/menu/pizza.jpg" },
    { nameEn: "Vegetable Supreme", nameAr: "بيتزا الخضروات", descriptionEn: "Garden vegetables with olives, peppers, and mushrooms", descriptionAr: "خضروات طازجة مع الزيتون والفلفل والفطر", price: 16.99, categoryId: pizza.id, allergens: "gluten,dairy", dietary: "vegetarian,halal", calories: 520, preparationTime: 15, image: "/images/menu/pizza.jpg" },

    // Salads
    { nameEn: "Caesar Salad", nameAr: "سلطة سيزر", descriptionEn: "Crisp romaine with parmesan, croutons, and Caesar dressing", descriptionAr: "خس روماني مقرمش مع البارميزان والخبز المحمص وصلصة سيزر", price: 12.99, categoryId: salads.id, isPopular: true, allergens: "gluten,dairy,fish", dietary: "halal", calories: 280, preparationTime: 8, image: "/images/menu/salads.jpg" },
    { nameEn: "Fattoush", nameAr: "فتوش", descriptionEn: "Fresh mixed greens with pomegranate, sumac, and crispy pita", descriptionAr: "خضروات طازجة مع الرمان والسماق والخبز المقرمش", price: 11.99, categoryId: salads.id, isPopular: true, dietary: "vegetarian,vegan,halal", calories: 180, preparationTime: 8, image: "/images/menu/salads.jpg" },
    { nameEn: "Tabbouleh", nameAr: "تبولة", descriptionEn: "Fresh parsley and bulgur salad with tomatoes and mint", descriptionAr: "سلطة بقدونس وبرغل طازجة مع الطماطم والنعناع", price: 10.99, categoryId: salads.id, dietary: "vegetarian,vegan,halal", calories: 150, preparationTime: 8, image: "/images/menu/salads.jpg" },

    // Desserts
    { nameEn: "Baklava", nameAr: "بقلاوة", descriptionEn: "Layers of phyllo pastry with pistachios and honey syrup", descriptionAr: "طبقات عجينة فيلو مع الفستق وشراب العسل", price: 9.99, categoryId: desserts.id, isPopular: true, allergens: "gluten,nuts", dietary: "vegetarian,halal", calories: 320, preparationTime: 5, image: "/images/menu/desserts.jpg" },
    { nameEn: "Kunafa", nameAr: "كنافة", descriptionEn: "Crispy pastry with cheese and sweet rose syrup", descriptionAr: "معجنات مقرمشة بالجبنة وشراب الورد", price: 11.99, categoryId: desserts.id, isSpecial: true, allergens: "gluten,dairy", dietary: "vegetarian,halal", calories: 380, preparationTime: 10, image: "/images/menu/desserts.jpg" },
    { nameEn: "Tiramisu", nameAr: "تيراميسو", descriptionEn: "Classic Italian dessert with espresso-soaked ladyfingers", descriptionAr: "حلوى إيطالية كلاسيكية بسيسرادام المغمور بالقهوة", price: 10.99, categoryId: desserts.id, allergens: "gluten,dairy", dietary: "vegetarian", calories: 340, preparationTime: 5, image: "/images/menu/desserts.jpg" },
    { nameEn: "Chocolate Lava Cake", nameAr: "كيك الشوكولاتة الذائبة", descriptionEn: "Warm chocolate cake with molten center and vanilla ice cream", descriptionAr: "كيك شوكولاتة دافئ بمركز ذائب مع آيس كريم فانيلا", price: 12.99, categoryId: desserts.id, isPopular: true, allergens: "gluten,dairy,eggs", dietary: "vegetarian", calories: 450, preparationTime: 12, image: "/images/menu/desserts.jpg" },

    // Beverages
    { nameEn: "Fresh Lemonade", nameAr: "ليموناضة طازجة", descriptionEn: "Freshly squeezed lemon juice with mint and ice", descriptionAr: "عصير ليمون طازج بالنعناع والثلج", price: 5.99, categoryId: beverages.id, isPopular: true, dietary: "vegetarian,vegan,halal", calories: 120, preparationTime: 5, image: "/images/menu/beverages.jpg" },
    { nameEn: "Mint Tea", nameAr: "شاي بالنعناع", descriptionEn: "Traditional Moroccan mint tea with fresh spearmint", descriptionAr: "شاي مغربي بالنعناع بالنعناع الطازج", price: 4.99, categoryId: beverages.id, isPopular: true, dietary: "vegetarian,vegan,halal", calories: 80, preparationTime: 5, image: "/images/menu/beverages.jpg" },
    { nameEn: "Turkish Coffee", nameAr: "قهوة تركية", descriptionEn: "Strong traditional Turkish coffee with cardamom", descriptionAr: "قهوة تركية تقليدية قوية بالهيل", price: 4.99, categoryId: beverages.id, dietary: "vegetarian,vegan,halal", calories: 15, preparationTime: 8, image: "/images/menu/beverages.jpg" },
    { nameEn: "Mango Smoothie", nameAr: "سموذي المانجو", descriptionEn: "Creamy mango smoothie with yogurt and honey", descriptionAr: "سموذي مانجو كريمي بالزبادي والعسل", price: 7.99, categoryId: beverages.id, allergens: "dairy", dietary: "vegetarian,halal", calories: 220, preparationTime: 5, image: "/images/menu/beverages.jpg" },

    // Sides
    { nameEn: "French Fries", nameAr: "بطاطس مقلية", descriptionEn: "Crispy golden fries with sea salt", descriptionAr: "بطاطس مقرمشة ذهبية بملح البحر", price: 5.99, categoryId: sides.id, isPopular: true, dietary: "vegetarian,vegan,halal", calories: 280, preparationTime: 8, image: "/images/menu/sides.jpg" },
    { nameEn: "Rice Pilaf", nameAr: "أرز بيلاف", descriptionEn: "Fragrant basmati rice with spices and toasted almonds", descriptionAr: "أرز بسمتي عطري بالتوابل واللوز المحمص", price: 5.99, categoryId: sides.id, allergens: "nuts", dietary: "vegetarian,vegan,halal", calories: 220, preparationTime: 10, image: "/images/menu/sides.jpg" },
    { nameEn: "Garlic Bread", nameAr: "خبز بالثوم", descriptionEn: "Toasted bread with garlic butter and herbs", descriptionAr: "خبز محمص بزبدة الثوم والأعشاب", price: 4.99, categoryId: sides.id, allergens: "gluten,dairy", dietary: "vegetarian,halal", calories: 180, preparationTime: 6, image: "/images/menu/sides.jpg" },
    { nameEn: "Grilled Vegetables", nameAr: "خضار مشوية", descriptionEn: "Seasonal vegetables grilled with olive oil and herbs", descriptionAr: "خضار موسمية مشوية بزيت الزيتون والأعشاب", price: 6.99, categoryId: sides.id, dietary: "vegetarian,vegan,halal", calories: 120, preparationTime: 10, image: "/images/menu/sides.jpg" },
  ];

  for (const item of menuItems) {
    await db.menuItem.create({ data: item });
  }

  // Seed Modifiers
  const allItems = await db.menuItem.findMany();

  for (const item of allItems) {
    if (item.categoryId === beverages.id) {
      await db.modifier.createMany({
        data: [
          { nameEn: "Small", nameAr: "صغير", type: "variant", price: 0, menuItemId: item.id },
          { nameEn: "Medium", nameAr: "متوسط", type: "variant", price: 1.5, menuItemId: item.id },
          { nameEn: "Large", nameAr: "كبير", type: "variant", price: 3, menuItemId: item.id },
        ],
      });
    }
    if (item.categoryId === grills.id || item.categoryId === pizza.id) {
      await db.modifier.createMany({
        data: [
          { nameEn: "Extra Spicy", nameAr: "حار جداً", type: "addon", price: 0, menuItemId: item.id },
          { nameEn: "Extra Sauce", nameAr: "صلصة إضافية", type: "addon", price: 1.5, menuItemId: item.id },
          { nameEn: "Double Portion", nameAr: "حجم مزدوج", type: "addon", price: 8, menuItemId: item.id },
        ],
      });
    }
    if (item.categoryId === desserts.id) {
      await db.modifier.createMany({
        data: [
          { nameEn: "Add Ice Cream", nameAr: "إضافة آيس كريم", type: "addon", price: 2.5, menuItemId: item.id },
          { nameEn: "Extra Drizzle", nameAr: "صوص إضافي", type: "addon", price: 1, menuItemId: item.id },
        ],
      });
    }
    if (item.categoryId === pasta.id) {
      await db.modifier.createMany({
        data: [
          { nameEn: "Add Chicken", nameAr: "إضافة دجاج", type: "addon", price: 4, menuItemId: item.id },
          { nameEn: "Add Shrimp", nameAr: "إضافة روبيان", type: "addon", price: 6, menuItemId: item.id },
          { nameEn: "Gluten-Free Pasta", nameAr: "باستا خالية من الغلوتين", type: "variant", price: 2, menuItemId: item.id },
        ],
      });
    }
    if (item.categoryId === salads.id) {
      await db.modifier.createMany({
        data: [
          { nameEn: "Add Grilled Chicken", nameAr: "إضافة دجاج مشوي", type: "addon", price: 5, menuItemId: item.id },
          { nameEn: "Add Salmon", nameAr: "إضافة سلمون", type: "addon", price: 7, menuItemId: item.id },
        ],
      });
    }
  }

  // Seed Tables with floor plan positions
  const tableData = [
    // Main Floor - Section at top-left
    { number: 1, capacity: 2, section: "main", shape: "round", x: 60, y: 80, width: 70, height: 70, status: "open" },
    { number: 2, capacity: 2, section: "main", shape: "round", x: 180, y: 80, width: 70, height: 70, status: "open" },
    { number: 3, capacity: 4, section: "main", shape: "square", x: 310, y: 70, width: 90, height: 90, status: "occupied" },
    { number: 4, capacity: 4, section: "main", shape: "square", x: 440, y: 70, width: 90, height: 90, status: "open" },
    { number: 5, capacity: 4, section: "main", shape: "square", x: 60, y: 220, width: 90, height: 90, status: "occupied" },
    { number: 6, capacity: 6, section: "main", shape: "round", x: 220, y: 220, width: 100, height: 100, status: "open" },
    { number: 7, capacity: 6, section: "main", shape: "round", x: 390, y: 220, width: 100, height: 100, status: "occupied" },
    { number: 8, capacity: 8, section: "main", shape: "square", x: 180, y: 380, width: 120, height: 100, status: "reserved" },
    // Patio - Section at top-right
    { number: 9, capacity: 2, section: "patio", shape: "round", x: 620, y: 80, width: 70, height: 70, status: "open" },
    { number: 10, capacity: 2, section: "patio", shape: "round", x: 740, y: 80, width: 70, height: 70, status: "open" },
    { number: 11, capacity: 4, section: "patio", shape: "square", x: 620, y: 200, width: 90, height: 90, status: "open" },
    { number: 12, capacity: 4, section: "patio", shape: "square", x: 740, y: 200, width: 90, height: 90, status: "open" },
    { number: 13, capacity: 6, section: "patio", shape: "round", x: 680, y: 350, width: 100, height: 100, status: "reserved" },
    // Private Room - Section at bottom-left
    { number: 14, capacity: 4, section: "private", shape: "square", x: 60, y: 540, width: 90, height: 90, status: "open" },
    { number: 15, capacity: 10, section: "private", shape: "square", x: 220, y: 530, width: 140, height: 110, status: "reserved" },
    // Bar - Section at bottom-right
    { number: 16, capacity: 2, section: "bar", shape: "round", x: 560, y: 540, width: 60, height: 60, status: "cleaning" },
    { number: 17, capacity: 2, section: "bar", shape: "round", x: 650, y: 540, width: 60, height: 60, status: "open" },
    { number: 18, capacity: 2, section: "bar", shape: "round", x: 740, y: 540, width: 60, height: 60, status: "open" },
    { number: 19, capacity: 2, section: "bar", shape: "round", x: 560, y: 640, width: 60, height: 60, status: "open" },
    { number: 20, capacity: 2, section: "bar", shape: "round", x: 650, y: 640, width: 60, height: 60, status: "occupied" },
  ];

  for (const table of tableData) {
    await db.restaurantTable.create({ data: table });
  }

  // Seed Special Offers
  await db.specialOffer.createMany({
    data: [
      { titleEn: "Happy Hour", titleAr: "ساعة السعادة", descriptionEn: "20% off all appetizers and drinks", descriptionAr: "خصم ٢٠٪ على جميع المقبلات والمشروبات", discountPercent: 20, image: "happy-hour" },
      { titleEn: "Family Deal", titleAr: "عرض العائلة", descriptionEn: "2 main courses + 2 sides + dessert for $49.99", descriptionAr: "٢ طبق رئيسي + ٢ إضافات + حلوى بـ ٤٩٫٩٩$", discountPercent: 15, image: "family-deal" },
      { titleEn: "Lunch Special", titleAr: "عرض الغداء", descriptionEn: "Any pasta + soup or salad for $16.99", descriptionAr: "أي باستا + شوربة أو سلطة بـ ١٦٫٩٩$", discountPercent: 25, image: "lunch-special" },
    ],
  });

  // ===== Seed Employees (with hashed PINs) =====
  const employees = await Promise.all([
    db.employee.create({ data: { name: "Admin", pin: hashPin("1234"), role: "admin", hourlyWage: 25.0, isActive: true, email: "admin@saffron.com", phone: "+1555000001" } }),
    db.employee.create({ data: { name: "Sarah Manager", pin: hashPin("5678"), role: "manager", hourlyWage: 22.0, isActive: true, email: "sarah@saffron.com", phone: "+1555000002" } }),
    db.employee.create({ data: { name: "Chef Ahmad", pin: hashPin("9999"), role: "staff", hourlyWage: 18.0, isActive: true, email: "ahmad@saffron.com", phone: "+1555000003" } }),
    db.employee.create({ data: { name: "Waiter Sami", pin: hashPin("1111"), role: "staff", hourlyWage: 15.0, isActive: true, email: "sami@saffron.com", phone: "+1555000004" } }),
  ]);

  // ===== Seed Ingredients =====
  await db.ingredient.createMany({
    data: [
      { name: "Chicken Breast", unit: "kg", quantity: 25, lowThreshold: 5, costPerUnit: 8.50, supplier: "Fresh Farms", category: "Proteins" },
      { name: "Rice", unit: "kg", quantity: 50, lowThreshold: 10, costPerUnit: 2.50, supplier: "Grain Co", category: "Grains" },
      { name: "Olive Oil", unit: "liters", quantity: 15, lowThreshold: 3, costPerUnit: 12.00, supplier: "Mediterranean Imports", category: "Oils" },
      { name: "Tomatoes", unit: "kg", quantity: 20, lowThreshold: 5, costPerUnit: 3.00, supplier: "Fresh Farms", category: "Vegetables" },
      { name: "Onions", unit: "kg", quantity: 18, lowThreshold: 4, costPerUnit: 1.50, supplier: "Fresh Farms", category: "Vegetables" },
      { name: "Garlic", unit: "kg", quantity: 3, lowThreshold: 2, costPerUnit: 6.00, supplier: "Fresh Farms", category: "Vegetables" },
      { name: "Flour", unit: "kg", quantity: 30, lowThreshold: 8, costPerUnit: 1.80, supplier: "Grain Co", category: "Grains" },
      { name: "Butter", unit: "kg", quantity: 4, lowThreshold: 3, costPerUnit: 9.00, supplier: "Dairy Direct", category: "Dairy" },
    ],
  });

  // ===== Seed Cash Drawer Entries =====
  await db.cashDrawerEntry.createMany({
    data: [
      { type: "payin", amount: 200.00, note: "Opening cash drawer", createdBy: "Admin" },
      { type: "sale", amount: 67.07, note: "ORD-001 payment", createdBy: "Admin" },
    ],
  });

  // ===== Seed Schedules =====
  await db.schedule.createMany({
    data: [
      { employeeId: employees[0].id, dayOfWeek: 1, startTime: "09:00", endTime: "18:00", role: "Manager" },
      { employeeId: employees[2].id, dayOfWeek: 1, startTime: "10:00", endTime: "20:00", role: "Cook" },
      { employeeId: employees[3].id, dayOfWeek: 1, startTime: "11:00", endTime: "22:00", role: "Server" },
    ],
  });

  // ===== Seed Notifications =====
  await db.notification.createMany({
    data: [
      { type: "warning", title: "Low Stock Alert", message: "Butter stock is below threshold (4 kg remaining, threshold: 3 kg)", isRead: false },
      { type: "order", title: "New Order Received", message: "Order ORD-004 has been placed for delivery", isRead: false },
    ],
  });

  // ===== Seed sample orders with kitchen display data =====
  const hummus = allItems.find(i => i.nameEn === "Hummus Platter");
  const kebab = allItems.find(i => i.nameEn === "Lamb Kebab");
  const shawarma = allItems.find(i => i.nameEn === "Chicken Shawarma");
  const fattoush = allItems.find(i => i.nameEn === "Fattoush");
  const mixedGrill = allItems.find(i => i.nameEn === "Mixed Grill Platter");
  const caesarSalad = allItems.find(i => i.nameEn === "Caesar Salad");
  const salmon = allItems.find(i => i.nameEn === "Grilled Salmon");
  const margherita = allItems.find(i => i.nameEn === "Margherita Pizza");
  const baklava = allItems.find(i => i.nameEn === "Baklava");
  const lemonade = allItems.find(i => i.nameEn === "Fresh Lemonade");
  const chickenAlfredo = allItems.find(i => i.nameEn === "Chicken Alfredo");
  const mojito = allItems.find(i => i.nameEn === "Mango Smoothie");

  const table5 = await db.restaurantTable.findFirst({ where: { number: 5 } });
  const table3 = await db.restaurantTable.findFirst({ where: { number: 3 } });
  const table7 = await db.restaurantTable.findFirst({ where: { number: 7 } });

  // Order 1: Dine-in, preparing - mixed stations
  const order1 = await db.order.create({
    data: {
      orderNumber: "ORD-001",
      type: "dine_in",
      status: "preparing",
      customerName: "Ahmed Hassan",
      customerPhone: "+1234567890",
      subtotal: 60.97,
      taxAmount: 6.10,
      total: 67.07,
      paymentStatus: "paid",
      paymentMethod: "card",
      tableId: table5?.id || null,
      createdAt: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
    },
  });

  if (hummus && kebab && baklava) {
    await db.orderItem.createMany({
      data: [
        { orderId: order1.id, menuItemId: hummus.id, quantity: 1, unitPrice: 8.99, totalPrice: 8.99, status: "preparing", station: "Prep", seatNumber: 1 },
        { orderId: order1.id, menuItemId: kebab.id, quantity: 1, unitPrice: 22.99, totalPrice: 22.99, modifiers: "[]", status: "preparing", station: "Grill", seatNumber: 1 },
        { orderId: order1.id, menuItemId: baklava.id, quantity: 1, unitPrice: 9.99, totalPrice: 9.99, status: "pending", station: "Prep" },
      ],
    });
  }

  // Order 2: Takeout, confirmed - items pending
  const order2 = await db.order.create({
    data: {
      orderNumber: "ORD-002",
      type: "takeout",
      status: "confirmed",
      customerName: "Sara Ali",
      customerPhone: "+1234567891",
      subtotal: 26.98,
      taxAmount: 2.70,
      total: 29.68,
      paymentStatus: "paid",
      paymentMethod: "cash",
      createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
    },
  });

  if (shawarma && fattoush) {
    await db.orderItem.createMany({
      data: [
        { orderId: order2.id, menuItemId: shawarma.id, quantity: 1, unitPrice: 14.99, totalPrice: 14.99, status: "pending", station: "Grill" },
        { orderId: order2.id, menuItemId: fattoush.id, quantity: 1, unitPrice: 11.99, totalPrice: 11.99, status: "pending", station: "Prep" },
      ],
    });
  }

  // Order 3: Dine-in, preparing - some items ready, some held
  const order3 = await db.order.create({
    data: {
      orderNumber: "ORD-003",
      type: "dine_in",
      status: "preparing",
      customerName: "Mohammed Khalil",
      customerPhone: "+1234567892",
      subtotal: 55.97,
      taxAmount: 5.60,
      total: 61.57,
      paymentStatus: "unpaid",
      paymentMethod: "cash",
      tableId: table3?.id || null,
      createdAt: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
    },
  });

  if (mixedGrill && caesarSalad && lemonade) {
    await db.orderItem.createMany({
      data: [
        { orderId: order3.id, menuItemId: mixedGrill.id, quantity: 1, unitPrice: 28.99, totalPrice: 28.99, status: "preparing", station: "Grill", seatNumber: 1, notes: "Medium well please" },
        { orderId: order3.id, menuItemId: caesarSalad.id, quantity: 1, unitPrice: 12.99, totalPrice: 12.99, status: "ready", station: "Prep", seatNumber: 1 },
        { orderId: order3.id, menuItemId: lemonade.id, quantity: 1, unitPrice: 5.99, totalPrice: 5.99, status: "ready", station: "Bar" },
      ],
    });
  }

  // Order 4: Delivery, pending - items on hold
  const order4 = await db.order.create({
    data: {
      orderNumber: "ORD-004",
      type: "delivery",
      status: "confirmed",
      customerName: "Layla Abbas",
      customerPhone: "+1234567895",
      subtotal: 45.98,
      taxAmount: 4.60,
      deliveryFee: 4.99,
      total: 55.57,
      paymentStatus: "paid",
      paymentMethod: "card",
      deliveryAddress: "456 Oak Street, Apt 2B",
      createdAt: new Date(Date.now() - 18 * 60 * 1000), // 18 minutes ago - PRIORITY!
    },
  });

  if (salmon && chickenAlfredo && mojito) {
    await db.orderItem.createMany({
      data: [
        { orderId: order4.id, menuItemId: salmon.id, quantity: 1, unitPrice: 26.99, totalPrice: 26.99, status: "pending", station: "Grill", hold: true, notes: "No butter" },
        { orderId: order4.id, menuItemId: chickenAlfredo.id, quantity: 1, unitPrice: 18.99, totalPrice: 18.99, status: "pending", station: "Prep" },
        { orderId: order4.id, menuItemId: mojito.id, quantity: 1, unitPrice: 7.99, totalPrice: 7.99, status: "ready", station: "Bar" },
      ],
    });
  }

  // Order 5: Dine-in, preparing - bar heavy order
  const order5 = await db.order.create({
    data: {
      orderNumber: "ORD-005",
      type: "dine_in",
      status: "preparing",
      customerName: "Omar Youssef",
      customerPhone: "+1234567894",
      subtotal: 35.98,
      taxAmount: 3.60,
      total: 39.58,
      paymentStatus: "paid",
      paymentMethod: "card",
      tableId: table7?.id || null,
      createdAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
    },
  });

  if (margherita && lemonade) {
    await db.orderItem.createMany({
      data: [
        { orderId: order5.id, menuItemId: margherita.id, quantity: 1, unitPrice: 14.99, totalPrice: 14.99, status: "fired", station: "Grill", seatNumber: 2 },
        { orderId: order5.id, menuItemId: lemonade.id, quantity: 2, unitPrice: 5.99, totalPrice: 11.98, status: "preparing", station: "Bar", seatNumber: 2 },
        { orderId: order5.id, menuItemId: baklava?.id || margherita.id, quantity: 1, unitPrice: 9.99, totalPrice: 9.98, status: "pending", station: "Prep", hold: true },
      ],
    });
  }

  // Seed reservation (table3 already declared above)
  if (table3) {
    await db.reservation.create({
      data: {
        customerName: "Mohammed Khalil",
        customerPhone: "+1234567892",
        partySize: 4,
        tableId: table3.id,
        dateTime: new Date(Date.now() + 3600000 * 2),
        status: "confirmed",
        occasion: "anniversary",
        preference: "indoor",
      },
    });
  }

  // Seed waitlist entries
  await db.waitlistEntry.createMany({
    data: [
      { customerName: "Fatima Nour", customerPhone: "+1234567893", partySize: 3, status: "waiting", estimatedWait: 15 },
      { customerName: "Omar Youssef", customerPhone: "+1234567894", partySize: 2, status: "waiting", estimatedWait: 25 },
    ],
  });

  // Seed a customer with loyalty
  await db.customer.create({
    data: {
      name: "Layla Abbas",
      phone: "+1234567895",
      email: "layla@example.com",
      loyaltyPoints: 450,
      totalSpent: 450.50,
      visits: 12,
    },
  });

  // ===== Seed Kitchen Stations =====
  await db.kitchenStation.createMany({
    data: [
      {
        name: "Grill Station",
        slug: "grill",
        icon: "Flame",
        color: "#ef4444",
        sortOrder: 1,
        isActive: true,
      },
      {
        name: "Prep Station",
        slug: "prep",
        icon: "ChefHat",
        color: "#f59e0b",
        sortOrder: 2,
        isActive: true,
      },
      {
        name: "Bar Station",
        slug: "bar",
        icon: "Wine",
        color: "#8b5cf6",
        sortOrder: 3,
        isActive: true,
      },
    ],
  });

  // ===== Seed Kitchen Screens =====
  await db.kitchenScreen.createMany({
    data: [
      {
        name: "All Stations",
        slug: "all-stations",
        description: "Shows all active orders across all stations",
        stationFilter: "",
        layoutType: "grid",
        autoRefreshInterval: 10,
        showCompleted: false,
        maxOrders: 0,
        sortOrder: 0,
        isActive: true,
      },
      {
        name: "Grill Station",
        slug: "grill",
        description: "Grill station - kebabs, shawarma, burgers, mixed grill",
        stationFilter: "Grill",
        layoutType: "grid",
        autoRefreshInterval: 8,
        showCompleted: false,
        maxOrders: 0,
        sortOrder: 1,
        isActive: true,
      },
      {
        name: "Prep Station",
        slug: "prep",
        description: "Prep station - appetizers, salads, soups, sides",
        stationFilter: "Prep",
        layoutType: "grid",
        autoRefreshInterval: 10,
        showCompleted: false,
        maxOrders: 0,
        sortOrder: 2,
        isActive: true,
      },
      {
        name: "Bar Station",
        slug: "bar",
        description: "Bar station - beverages, drinks",
        stationFilter: "Bar",
        layoutType: "grid",
        autoRefreshInterval: 10,
        showCompleted: false,
        maxOrders: 0,
        sortOrder: 3,
        isActive: true,
      },
    ],
  });

  // ===== Seed Testimonials =====
  await db.testimonial.createMany({
    data: [
      { nameEn: "Sarah M.", nameAr: "سارة م.", commentEn: "Absolutely incredible dining experience! The Mixed Grill Platter is a must-try. The flavors are authentic and the service is top-notch.", commentAr: "تجربة طعام لا تُصدق! طبق المشويات المشكلة لا بد من تجربته. النكهات أصيلة والخدمة ممتازة.", avatar: "👩", stars: 5, sortOrder: 1 },
      { nameEn: "Ahmed K.", nameAr: "أحمد ك.", commentEn: "Best Middle Eastern food in town. The Hummus Trio and Lamb Kebab are outstanding. Will definitely be coming back!", commentAr: "أفضل طعام شرق أوسطي في المدينة. حمص الثلاثي وكباب اللحم ممتازان. سأعود بالتأكيد!", avatar: "👨", stars: 5, sortOrder: 2 },
      { nameEn: "Maria L.", nameAr: "ماريا ل.", commentEn: "Beautiful atmosphere and delicious food. The vegetarian options are amazing — finally a restaurant that takes plant-based seriously!", commentAr: "أجواء جميلة وطعام لذيذ. الخيارات النباتية رائعة — أخيراً مطعم يأخذ النباتيين على محمل الجد!", avatar: "👩‍🦰", stars: 4, sortOrder: 3 },
    ],
  });

  // ===== Seed Promo Codes =====
  await db.promoCode.createMany({
    data: [
      { code: "SAFFRON20", discountPercent: 20, isActive: true },
      { code: "WELCOME10", discountPercent: 10, isActive: true },
      { code: "DELIVERY", discountPercent: 15, isActive: true },
    ],
  });

  // ===== Seed Reward Tiers =====
  await db.rewardTier.createMany({
    data: [
      { nameEn: "Free Appetizer", nameAr: "مقبلات مجانية", points: 100, icon: "🥗", tier: "bronze", sortOrder: 1 },
      { nameEn: "Free Dessert", nameAr: "حلوى مجانية", points: 250, icon: "🍰", tier: "silver", sortOrder: 2 },
      { nameEn: "$10 Off", nameAr: "خصم ١٠$", points: 500, icon: "💰", tier: "gold", sortOrder: 3 },
      { nameEn: "Free Main Course", nameAr: "طبق رئيسي مجاني", points: 1000, icon: "🍽️", tier: "platinum", sortOrder: 4 },
    ],
  });

  console.log("✅ Re-seed completed successfully!");
  return { settings, categoriesCount: categories.length, menuItemsCount: menuItems.length, tablesCount: tableData.length };
}

export async function POST(request: NextRequest) {
  try {
    // Explicit auth check: require admin role (middleware also checks this)
    const cookieValue = request.cookies.get('staff_session')?.value;
    if (!cookieValue) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const session = decodeSession(cookieValue);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const result = await seed();

    return NextResponse.json({
      message: "Database re-seeded successfully",
      stats: {
        categories: result.categoriesCount,
        menuItems: result.menuItemsCount,
        tables: result.tablesCount,
      },
    });
  } catch (error) {
    console.error("Error seeding database:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
