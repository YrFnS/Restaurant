import { db } from "@/lib/db";

async function seed() {
	console.log("🌱 Seeding database...");

	// Clear existing data in reverse dependency order (for idempotent re-runs)
	await db.orderItem.deleteMany();
	await db.order.deleteMany();
	await db.kitchenStation.deleteMany();
	await db.kitchenScreen.deleteMany();
	await db.reservation.deleteMany();
	await db.waitlistEntry.deleteMany();
	await db.specialOffer.deleteMany();
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
			descriptionEn:
				"Experience the finest flavors crafted with passion and tradition",
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
		},
	});

	// Seed Menu Categories
	const categories = await Promise.all([
		db.menuCategory.create({
			data: {
				nameEn: "Appetizers",
				nameAr: "المقبلات",
				icon: "🥗",
				sortOrder: 1,
			},
		}),
		db.menuCategory.create({
			data: { nameEn: "Soups", nameAr: "الشوربات", icon: "🍲", sortOrder: 2 },
		}),
		db.menuCategory.create({
			data: { nameEn: "Grills", nameAr: "المشويات", icon: "🥩", sortOrder: 3 },
		}),
		db.menuCategory.create({
			data: {
				nameEn: "Seafood",
				nameAr: "المأكولات البحرية",
				icon: "🦐",
				sortOrder: 4,
			},
		}),
		db.menuCategory.create({
			data: { nameEn: "Pasta", nameAr: "الباستا", icon: "🍝", sortOrder: 5 },
		}),
		db.menuCategory.create({
			data: { nameEn: "Pizza", nameAr: "البيتزا", icon: "🍕", sortOrder: 6 },
		}),
		db.menuCategory.create({
			data: { nameEn: "Salads", nameAr: "السلطات", icon: "🥬", sortOrder: 7 },
		}),
		db.menuCategory.create({
			data: {
				nameEn: "Desserts",
				nameAr: "الحلويات",
				icon: "🍰",
				sortOrder: 8,
			},
		}),
		db.menuCategory.create({
			data: {
				nameEn: "Beverages",
				nameAr: "المشروبات",
				icon: "🥤",
				sortOrder: 9,
			},
		}),
		db.menuCategory.create({
			data: { nameEn: "Sides", nameAr: "الإضافات", icon: "🍟", sortOrder: 10 },
		}),
	]);

	const [
		appetizers,
		soups,
		grills,
		seafood,
		pasta,
		pizza,
		salads,
		desserts,
		beverages,
		sides,
	] = categories;

	// Seed Menu Items
	const menuItems = [
		// Appetizers
		{
			nameEn: "Hummus Platter",
			nameAr: "طبق حمص",
			descriptionEn:
				"Creamy chickpea dip with tahini, olive oil, and warm pita",
			descriptionAr: "حمص كريمي بالطحينة وزيت الزيتون مع خبز دافئ",
			price: 8.99,
			categoryId: appetizers.id,
			isPopular: true,
			allergens: "sesame",
			dietary: "vegetarian,vegan,halal",
			calories: 220,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Falafel Bites",
			nameAr: "أقراص فلافل",
			descriptionEn: "Crispy herb-spiced chickpea fritters with tahini sauce",
			descriptionAr: "أقراص حمص مقرمشة بالأعشاب مع صلصة الطحينة",
			price: 9.99,
			categoryId: appetizers.id,
			isPopular: true,
			allergens: "sesame",
			dietary: "vegetarian,vegan,halal",
			calories: 280,
			preparationTime: 12,
			image:
				"https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Stuffed Grape Leaves",
			nameAr: "ورق عنب محشي",
			descriptionEn: "Tender grape leaves filled with herbed rice and spices",
			descriptionAr: "ورق عنب طري محشي بالأرز المتبل",
			price: 10.99,
			categoryId: appetizers.id,
			isSpecial: true,
			dietary: "vegetarian,vegan,halal",
			calories: 180,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Crispy Samosas",
			nameAr: "سمبوسة مقرمشة",
			descriptionEn:
				"Golden fried pastries filled with spiced potatoes and peas",
			descriptionAr: "معجنات مقلية ذهبية محشية بالبطاطس والبازلاء",
			price: 7.99,
			categoryId: appetizers.id,
			allergens: "gluten",
			dietary: "vegetarian,halal,spicy",
			calories: 240,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Chicken Wings",
			nameAr: "أجنحة الدجاج",
			descriptionEn: "Smoky grilled wings with your choice of sauce",
			descriptionAr: "أجنحة مشوية مدخنة مع صلصة من اختيارك",
			price: 12.99,
			categoryId: appetizers.id,
			isPopular: true,
			dietary: "halal",
			calories: 380,
			preparationTime: 18,
			image:
				"https://images.unsplash.com/photo-1577805947697-89e18249d767?w=400&h=300&fit=crop",
		},

		// Soups
		{
			nameEn: "Lentil Soup",
			nameAr: "شوربة العدس",
			descriptionEn: "Hearty red lentil soup with lemon and croutons",
			descriptionAr: "شوربة عدس حمراء دسمة مع الليمون والخبز المحمص",
			price: 7.99,
			categoryId: soups.id,
			isPopular: true,
			dietary: "vegetarian,vegan,halal",
			calories: 200,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Chicken Soup",
			nameAr: "شوربة الدجاج",
			descriptionEn: "Comforting chicken broth with vegetables and herbs",
			descriptionAr: "مرق دجاج مريح مع الخضروات والأعشاب",
			price: 8.99,
			categoryId: soups.id,
			dietary: "halal",
			calories: 160,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Seafood Chowder",
			nameAr: "شوربة المأكولات البحرية",
			descriptionEn: "Rich creamy chowder with shrimp, fish, and potatoes",
			descriptionAr: "شوربة كريمية غنية بالروبيان والسمك والبطاطس",
			price: 11.99,
			categoryId: soups.id,
			isSpecial: true,
			allergens: "shellfish,fish,dairy",
			calories: 320,
			preparationTime: 12,
			image:
				"https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
		},

		// Grills
		{
			nameEn: "Mixed Grill Platter",
			nameAr: "طبق مشويات مشكلة",
			descriptionEn:
				"Assorted kebabs, lamb chops, and grilled chicken with rice",
			descriptionAr: "مشويات متنوعة من الكباب ولحم الضلع والدجاج مع الأرز",
			price: 28.99,
			categoryId: grills.id,
			isPopular: true,
			isSpecial: true,
			dietary: "halal",
			calories: 850,
			preparationTime: 25,
			image:
				"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Lamb Kebab",
			nameAr: "كباب لحم",
			descriptionEn:
				"Tender lamb kebabs with grilled vegetables and saffron rice",
			descriptionAr: "كباب لحم طري مع الخضار المشوية وأرز بالزعفران",
			price: 22.99,
			categoryId: grills.id,
			isPopular: true,
			dietary: "halal",
			calories: 680,
			preparationTime: 22,
			image:
				"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Chicken Shawarma",
			nameAr: "شاورما دجاج",
			descriptionEn: "Marinated chicken with garlic sauce in warm pita bread",
			descriptionAr: "دجاج متبل بصلصة الثوم في خبز عربي دافئ",
			price: 14.99,
			categoryId: grills.id,
			isPopular: true,
			allergens: "gluten",
			dietary: "halal",
			calories: 520,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Beef Burger",
			nameAr: "برجر لحم",
			descriptionEn:
				"Juicy beef patty with cheddar, pickles, and special sauce",
			descriptionAr: "لحم بقري مع جبنة شيدر ومخللات وصلصة خاصة",
			price: 16.99,
			categoryId: grills.id,
			allergens: "gluten,dairy",
			dietary: "halal",
			calories: 720,
			preparationTime: 18,
			image:
				"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Lamb Chops",
			nameAr: "ريش لحم",
			descriptionEn: "Premium lamb chops with rosemary and mint sauce",
			descriptionAr: "ريش لحم فاخرة مع إكليل الجبل وصلصة النعناع",
			price: 32.99,
			categoryId: grills.id,
			isSpecial: true,
			dietary: "halal",
			calories: 580,
			preparationTime: 25,
			image:
				"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
		},

		// Seafood
		{
			nameEn: "Grilled Salmon",
			nameAr: "سلمون مشوي",
			descriptionEn: "Atlantic salmon with lemon butter and asparagus",
			descriptionAr: "سلمون أطلسي مع زبدة الليمون والهليون",
			price: 26.99,
			categoryId: seafood.id,
			isSpecial: true,
			allergens: "fish",
			calories: 420,
			preparationTime: 20,
			image:
				"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Shrimp Scampi",
			nameAr: "روبيان سكامبي",
			descriptionEn: "Garlic butter shrimp with linguine pasta",
			descriptionAr: "روبيان بزبدة الثوم مع باستا لينجويني",
			price: 22.99,
			categoryId: seafood.id,
			isPopular: true,
			allergens: "shellfish,gluten",
			calories: 550,
			preparationTime: 18,
			image:
				"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Fish Tacos",
			nameAr: "تاكوس السمك",
			descriptionEn: "Beer-battered fish with slaw and chipotle mayo",
			descriptionAr: "سمك مقلي مع سلطة الملفوف ومايو تشيبوتلي",
			price: 15.99,
			categoryId: seafood.id,
			allergens: "fish,gluten",
			dietary: "halal,spicy",
			calories: 380,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
		},

		// Pasta
		{
			nameEn: "Truffle Mushroom Pasta",
			nameAr: "باستا الفطر بالكمأة",
			descriptionEn: "Fettuccine in creamy truffle sauce with wild mushrooms",
			descriptionAr: "فتوتشيني بصلصة الكمأة الكريمية مع الفطر البري",
			price: 19.99,
			categoryId: pasta.id,
			isSpecial: true,
			allergens: "gluten,dairy",
			dietary: "vegetarian",
			calories: 580,
			preparationTime: 18,
			image:
				"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Chicken Alfredo",
			nameAr: "ألفريدو الدجاج",
			descriptionEn:
				"Creamy parmesan sauce with grilled chicken over fettuccine",
			descriptionAr: "صلصة بارميزان كريمية مع الدجاج المشوي على الفتوتشيني",
			price: 18.99,
			categoryId: pasta.id,
			isPopular: true,
			allergens: "gluten,dairy",
			dietary: "halal",
			calories: 720,
			preparationTime: 16,
			image:
				"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Spaghetti Bolognese",
			nameAr: "سباغيتي بولونيز",
			descriptionEn: "Slow-cooked beef ragù with spaghetti and parmesan",
			descriptionAr: "صلصة لحم بطيئة مع السباغيتي والبارميزان",
			price: 16.99,
			categoryId: pasta.id,
			allergens: "gluten,dairy",
			dietary: "halal",
			calories: 650,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
		},

		// Pizza
		{
			nameEn: "Margherita Pizza",
			nameAr: "بيتزا مارغريتا",
			descriptionEn:
				"Classic pizza with fresh mozzarella, basil, and tomato sauce",
			descriptionAr:
				"بيتزا كلاسيكية مع الموزاريلا الطازجة والريحان وصلصة الطماطم",
			price: 14.99,
			categoryId: pizza.id,
			isPopular: true,
			allergens: "gluten,dairy",
			dietary: "vegetarian,halal",
			calories: 680,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Meat Lovers Pizza",
			nameAr: "بيتزا اللحوم",
			descriptionEn: "Loaded with beef, lamb, chicken, and pepperoni",
			descriptionAr: "محملة باللحم والضأن والدجاج والبيبروني",
			price: 19.99,
			categoryId: pizza.id,
			allergens: "gluten,dairy",
			dietary: "halal",
			calories: 890,
			preparationTime: 18,
			image:
				"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Vegetable Supreme",
			nameAr: "بيتزا الخضروات",
			descriptionEn: "Garden vegetables with olives, peppers, and mushrooms",
			descriptionAr: "خضروات طازجة مع الزيتون والفلفل والفطر",
			price: 16.99,
			categoryId: pizza.id,
			allergens: "gluten,dairy",
			dietary: "vegetarian,halal",
			calories: 520,
			preparationTime: 15,
			image:
				"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
		},

		// Salads
		{
			nameEn: "Caesar Salad",
			nameAr: "سلطة سيزر",
			descriptionEn:
				"Crisp romaine with parmesan, croutons, and Caesar dressing",
			descriptionAr: "خس روماني مقرمش مع البارميزان والخبز المحمص وصلصة سيزر",
			price: 12.99,
			categoryId: salads.id,
			isPopular: true,
			allergens: "gluten,dairy,fish",
			dietary: "halal",
			calories: 280,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Fattoush",
			nameAr: "فتوش",
			descriptionEn:
				"Fresh mixed greens with pomegranate, sumac, and crispy pita",
			descriptionAr: "خضروات طازجة مع الرمان والسماق والخبز المقرمش",
			price: 11.99,
			categoryId: salads.id,
			isPopular: true,
			dietary: "vegetarian,vegan,halal",
			calories: 180,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Tabbouleh",
			nameAr: "تبولة",
			descriptionEn: "Fresh parsley and bulgur salad with tomatoes and mint",
			descriptionAr: "سلطة بقدونس وبرغل طازجة مع الطماطم والنعناع",
			price: 10.99,
			categoryId: salads.id,
			dietary: "vegetarian,vegan,halal",
			calories: 150,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
		},

		// Desserts
		{
			nameEn: "Baklava",
			nameAr: "بقلاوة",
			descriptionEn: "Layers of phyllo pastry with pistachios and honey syrup",
			descriptionAr: "طبقات عجينة فيلو مع الفستق وشراب العسل",
			price: 9.99,
			categoryId: desserts.id,
			isPopular: true,
			allergens: "gluten,nuts",
			dietary: "vegetarian,halal",
			calories: 320,
			preparationTime: 5,
			image:
				"https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Kunafa",
			nameAr: "كنافة",
			descriptionEn: "Crispy pastry with cheese and sweet rose syrup",
			descriptionAr: "معجنات مقرمشة بالجبنة وشراب الورد",
			price: 11.99,
			categoryId: desserts.id,
			isSpecial: true,
			allergens: "gluten,dairy",
			dietary: "vegetarian,halal",
			calories: 380,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Tiramisu",
			nameAr: "تيراميسو",
			descriptionEn: "Classic Italian dessert with espresso-soaked ladyfingers",
			descriptionAr: "حلوى إيطالية كلاسيكية بسيسرادام المغمور بالقهوة",
			price: 10.99,
			categoryId: desserts.id,
			allergens: "gluten,dairy",
			dietary: "vegetarian",
			calories: 340,
			preparationTime: 5,
			image:
				"https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Chocolate Lava Cake",
			nameAr: "كيك الشوكولاتة الذائبة",
			descriptionEn:
				"Warm chocolate cake with molten center and vanilla ice cream",
			descriptionAr: "كيك شوكولاتة دافئ بمركز ذائب مع آيس كريم فانيلا",
			price: 12.99,
			categoryId: desserts.id,
			isPopular: true,
			allergens: "gluten,dairy,eggs",
			dietary: "vegetarian",
			calories: 450,
			preparationTime: 12,
			image:
				"https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&h=300&fit=crop",
		},

		// Beverages
		{
			nameEn: "Fresh Lemonade",
			nameAr: "ليموناضة طازجة",
			descriptionEn: "Freshly squeezed lemon juice with mint and ice",
			descriptionAr: "عصير ليمون طازج بالنعناع والثلج",
			price: 5.99,
			categoryId: beverages.id,
			isPopular: true,
			dietary: "vegetarian,vegan,halal",
			calories: 120,
			preparationTime: 5,
			image:
				"https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Mint Tea",
			nameAr: "شاي بالنعناع",
			descriptionEn: "Traditional Moroccan mint tea with fresh spearmint",
			descriptionAr: "شاي مغربي بالنعناع بالنعناع الطازج",
			price: 4.99,
			categoryId: beverages.id,
			isPopular: true,
			dietary: "vegetarian,vegan,halal",
			calories: 80,
			preparationTime: 5,
			image:
				"https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Turkish Coffee",
			nameAr: "قهوة تركية",
			descriptionEn: "Strong traditional Turkish coffee with cardamom",
			descriptionAr: "قهوة تركية تقليدية قوية بالهيل",
			price: 4.99,
			categoryId: beverages.id,
			dietary: "vegetarian,vegan,halal",
			calories: 15,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Mango Smoothie",
			nameAr: "سموذي المانجو",
			descriptionEn: "Creamy mango smoothie with yogurt and honey",
			descriptionAr: "سموذي مانجو كريمي بالزبادي والعسل",
			price: 7.99,
			categoryId: beverages.id,
			allergens: "dairy",
			dietary: "vegetarian,halal",
			calories: 220,
			preparationTime: 5,
			image:
				"https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
		},

		// Sides
		{
			nameEn: "French Fries",
			nameAr: "بطاطس مقلية",
			descriptionEn: "Crispy golden fries with sea salt",
			descriptionAr: "بطاطس مقرمشة ذهبية بملح البحر",
			price: 5.99,
			categoryId: sides.id,
			isPopular: true,
			dietary: "vegetarian,vegan,halal",
			calories: 280,
			preparationTime: 8,
			image:
				"https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Rice Pilaf",
			nameAr: "أرز بيلاف",
			descriptionEn: "Fragrant basmati rice with spices and toasted almonds",
			descriptionAr: "أرز بسمتي عطري بالتوابل واللوز المحمص",
			price: 5.99,
			categoryId: sides.id,
			allergens: "nuts",
			dietary: "vegetarian,vegan,halal",
			calories: 220,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Garlic Bread",
			nameAr: "خبز بالثوم",
			descriptionEn: "Toasted bread with garlic butter and herbs",
			descriptionAr: "خبز محمص بزبدة الثوم والأعشاب",
			price: 4.99,
			categoryId: sides.id,
			allergens: "gluten,dairy",
			dietary: "vegetarian,halal",
			calories: 180,
			preparationTime: 6,
			image:
				"https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=400&h=300&fit=crop",
		},
		{
			nameEn: "Grilled Vegetables",
			nameAr: "خضار مشوية",
			descriptionEn: "Seasonal vegetables grilled with olive oil and herbs",
			descriptionAr: "خضار موسمية مشوية بزيت الزيتون والأعشاب",
			price: 6.99,
			categoryId: sides.id,
			dietary: "vegetarian,vegan,halal",
			calories: 120,
			preparationTime: 10,
			image:
				"https://images.unsplash.com/photo-1576107232684-1279f390b2d0?w=400&h=300&fit=crop",
		},
	];

	for (const item of menuItems) {
		await db.menuItem.create({ data: item });
	}

	// Seed Modifiers for some items
	const allItems = await db.menuItem.findMany();

	// Add size variants to some items
	for (const item of allItems) {
		if (item.categoryId === beverages.id) {
			await db.modifier.createMany({
				data: [
					{
						nameEn: "Small",
						nameAr: "صغير",
						type: "variant",
						price: 0,
						menuItemId: item.id,
					},
					{
						nameEn: "Medium",
						nameAr: "متوسط",
						type: "variant",
						price: 1.5,
						menuItemId: item.id,
					},
					{
						nameEn: "Large",
						nameAr: "كبير",
						type: "variant",
						price: 3,
						menuItemId: item.id,
					},
				],
			});
		}
		if (item.categoryId === grills.id || item.categoryId === pizza.id) {
			await db.modifier.createMany({
				data: [
					{
						nameEn: "Extra Spicy",
						nameAr: "حار جداً",
						type: "addon",
						price: 0,
						menuItemId: item.id,
					},
					{
						nameEn: "Extra Sauce",
						nameAr: "صلصة إضافية",
						type: "addon",
						price: 1.5,
						menuItemId: item.id,
					},
					{
						nameEn: "Double Portion",
						nameAr: "حجم مزدوج",
						type: "addon",
						price: 8,
						menuItemId: item.id,
					},
				],
			});
		}
		if (item.categoryId === desserts.id) {
			await db.modifier.createMany({
				data: [
					{
						nameEn: "Add Ice Cream",
						nameAr: "إضافة آيس كريم",
						type: "addon",
						price: 2.5,
						menuItemId: item.id,
					},
					{
						nameEn: "Extra Drizzle",
						nameAr: "صوص إضافي",
						type: "addon",
						price: 1,
						menuItemId: item.id,
					},
				],
			});
		}
		if (item.categoryId === pasta.id) {
			await db.modifier.createMany({
				data: [
					{
						nameEn: "Add Chicken",
						nameAr: "إضافة دجاج",
						type: "addon",
						price: 4,
						menuItemId: item.id,
					},
					{
						nameEn: "Add Shrimp",
						nameAr: "إضافة روبيان",
						type: "addon",
						price: 6,
						menuItemId: item.id,
					},
					{
						nameEn: "Gluten-Free Pasta",
						nameAr: "باستا خالية من الغلوتين",
						type: "variant",
						price: 2,
						menuItemId: item.id,
					},
				],
			});
		}
		if (item.categoryId === salads.id) {
			await db.modifier.createMany({
				data: [
					{
						nameEn: "Add Grilled Chicken",
						nameAr: "إضافة دجاج مشوي",
						type: "addon",
						price: 5,
						menuItemId: item.id,
					},
					{
						nameEn: "Add Salmon",
						nameAr: "إضافة سلمون",
						type: "addon",
						price: 7,
						menuItemId: item.id,
					},
				],
			});
		}
	}

	// Seed Tables
	const tableData = [
		{ number: 1, capacity: 2, section: "main" },
		{ number: 2, capacity: 2, section: "main" },
		{ number: 3, capacity: 4, section: "main" },
		{ number: 4, capacity: 4, section: "main" },
		{ number: 5, capacity: 4, section: "main" },
		{ number: 6, capacity: 6, section: "main" },
		{ number: 7, capacity: 6, section: "main" },
		{ number: 8, capacity: 8, section: "main" },
		{ number: 9, capacity: 2, section: "patio" },
		{ number: 10, capacity: 2, section: "patio" },
		{ number: 11, capacity: 4, section: "patio" },
		{ number: 12, capacity: 4, section: "patio" },
		{ number: 13, capacity: 6, section: "patio" },
		{ number: 14, capacity: 4, section: "private" },
		{ number: 15, capacity: 10, section: "private" },
		{ number: 16, capacity: 2, section: "bar" },
		{ number: 17, capacity: 2, section: "bar" },
		{ number: 18, capacity: 2, section: "bar" },
		{ number: 19, capacity: 2, section: "bar" },
		{ number: 20, capacity: 2, section: "bar" },
	];

	for (const table of tableData) {
		await db.restaurantTable.create({ data: table });
	}

	// Seed Special Offers
	await db.specialOffer.createMany({
		data: [
			{
				titleEn: "Happy Hour",
				titleAr: "ساعة السعادة",
				descriptionEn: "20% off all appetizers and drinks",
				descriptionAr: "خصم ٢٠٪ على جميع المقبلات والمشروبات",
				discountPercent: 20,
				image: "happy-hour",
			},
			{
				titleEn: "Family Deal",
				titleAr: "عرض العائلة",
				descriptionEn: "2 main courses + 2 sides + dessert for $49.99",
				descriptionAr: "٢ طبق رئيسي + ٢ إضافات + حلوى بـ ٤٩٫٩٩$",
				discountPercent: 15,
				image: "family-deal",
			},
			{
				titleEn: "Lunch Special",
				titleAr: "عرض الغداء",
				descriptionEn: "Any pasta + soup or salad for $16.99",
				descriptionAr: "أي باستا + شوربة أو سلطة بـ ١٦٫٩٩$",
				discountPercent: 25,
				image: "lunch-special",
			},
		],
	});

	// Seed some sample orders
	const order1 = await db.order.create({
		data: {
			orderNumber: "ORD-001",
			type: "dine_in",
			status: "preparing",
			customerName: "Ahmed Hassan",
			customerPhone: "+1234567890",
			subtotal: 37.98,
			taxAmount: 3.8,
			total: 41.78,
			paymentStatus: "paid",
			paymentMethod: "card",
		},
	});

	const hummus = allItems.find((i) => i.nameEn === "Hummus Platter");
	const kebab = allItems.find((i) => i.nameEn === "Lamb Kebab");
	if (hummus && kebab) {
		await db.orderItem.createMany({
			data: [
				{
					orderId: order1.id,
					menuItemId: hummus.id,
					quantity: 1,
					unitPrice: 8.99,
					totalPrice: 8.99,
				},
				{
					orderId: order1.id,
					menuItemId: kebab.id,
					quantity: 1,
					unitPrice: 22.99,
					totalPrice: 22.99,
					modifiers: "[]",
				},
			],
		});
	}

	const order2 = await db.order.create({
		data: {
			orderNumber: "ORD-002",
			type: "takeout",
			status: "ready",
			customerName: "Sara Ali",
			customerPhone: "+1234567891",
			subtotal: 25.98,
			taxAmount: 2.6,
			total: 28.58,
			paymentStatus: "paid",
			paymentMethod: "cash",
		},
	});

	const shawarma = allItems.find((i) => i.nameEn === "Chicken Shawarma");
	const fattoush = allItems.find((i) => i.nameEn === "Fattoush");
	if (shawarma && fattoush) {
		await db.orderItem.createMany({
			data: [
				{
					orderId: order2.id,
					menuItemId: shawarma.id,
					quantity: 1,
					unitPrice: 14.99,
					totalPrice: 14.99,
				},
				{
					orderId: order2.id,
					menuItemId: fattoush.id,
					quantity: 1,
					unitPrice: 11.99,
					totalPrice: 11.99,
				},
			],
		});
	}

	// Seed some reservations
	const table3 = await db.restaurantTable.findFirst({ where: { number: 3 } });
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
			{
				customerName: "Fatima Nour",
				customerPhone: "+1234567893",
				partySize: 3,
				status: "waiting",
				estimatedWait: 15,
			},
			{
				customerName: "Omar Youssef",
				customerPhone: "+1234567894",
				partySize: 2,
				status: "waiting",
				estimatedWait: 25,
			},
		],
	});

	// Seed a customer with loyalty
	await db.customer.create({
		data: {
			name: "Layla Abbas",
			phone: "+1234567895",
			email: "layla@example.com",
			loyaltyPoints: 450,
			totalSpent: 450.5,
			visits: 12,
		},
	});

	console.log("✅ Seed completed successfully!");
	console.log(`  - ${categories.length} categories`);
	console.log(`  - ${menuItems.length} menu items`);
	console.log(`  - ${tableData.length} tables`);
	console.log(`  - 3 special offers`);
	console.log(`  - 2 sample orders`);
	console.log(`  - 1 reservation`);
	console.log(`  - 2 waitlist entries`);
	console.log(`  - 1 loyalty customer`);
}

seed()
	.catch((e) => {
		console.error("❌ Seed failed:", e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
