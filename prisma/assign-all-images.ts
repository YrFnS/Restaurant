// Assign remote images to every seeded menu item and testimonial avatar.
import { PrismaClient } from "@prisma/client";
import {
  assertMappedNeon,
  MENU_IMAGE_URLS,
  REMOTE_HERO_URL,
  REMOTE_LOGO_URL,
  TESTIMONIAL_AVATAR_URLS,
} from "./remote-assets";

const db = new PrismaClient();
const imageMap: Record<string, string> = {
  "Hummus Beiruti": MENU_IMAGE_URLS["hummus.png"],
  "Falafel Plate": MENU_IMAGE_URLS["falafel.png"],
  "Stuffed Grape Leaves": MENU_IMAGE_URLS["grape-leaves.png"],
  "Lentil Soup": MENU_IMAGE_URLS["lentil-soup.png"],
  "Seafood Chowder": MENU_IMAGE_URLS["seafood-chowder.png"],
  "Mixed Grill Platter": MENU_IMAGE_URLS["mixed-grill.png"],
  "Shish Tawook": MENU_IMAGE_URLS["shish-tawook.png"],
  "Lamb Kebab": MENU_IMAGE_URLS["lamb-kebab.png"],
  "Spicy Wings": MENU_IMAGE_URLS["wings.png"],
  "Grilled Salmon": MENU_IMAGE_URLS["salmon.png"],
  "Shrimp Linguine": MENU_IMAGE_URLS["shrimp-linguine.png"],
  "Truffle Mushroom Pasta": MENU_IMAGE_URLS["truffle-pasta.png"],
  "Spicy Arrabbiata": MENU_IMAGE_URLS["arrabbiata.png"],
  Margherita: MENU_IMAGE_URLS["margherita.png"],
  "Spicy Pepperoni": MENU_IMAGE_URLS["pepperoni-pizza.png"],
  Fattoush: MENU_IMAGE_URLS["fattoush.png"],
  "Caesar Salad": MENU_IMAGE_URLS["caesar-salad.png"],
  Kunafa: MENU_IMAGE_URLS["kunafa.png"],
  "Baklava (4 pcs)": MENU_IMAGE_URLS["baklava.png"],
  "Chocolate Lava Cake": MENU_IMAGE_URLS["lava-cake.png"],
  "Fresh Mint Lemonade": MENU_IMAGE_URLS["lemonade.png"],
  "Turkish Coffee": MENU_IMAGE_URLS["turkish-coffee.png"],
  "Pomegranate Mocktail": MENU_IMAGE_URLS["pomegranate-mocktail.png"],
  "Soft Drinks": MENU_IMAGE_URLS["soft-drink.png"],
  "Truffle Fries": MENU_IMAGE_URLS["truffle-fries.png"],
  "Garlic Rice": MENU_IMAGE_URLS["garlic-rice.png"],
  "Grilled Vegetables": MENU_IMAGE_URLS["grilled-veg.png"],
};

async function main() {
  await assertMappedNeon(db);
  const names = Object.keys(imageMap);
  const existing = await db.menuItem.findMany({ where: { nameEn: { in: names } }, select: { id: true, nameEn: true } });
  if (existing.length !== names.length) {
    const found = new Set(existing.map((item) => item.nameEn));
    throw new Error(`Missing mapped menu items: ${names.filter((name) => !found.has(name)).join(", ")}`);
  }

  console.log("🖼️  Assigning remote images to all menu items...");
  for (const item of existing) {
    await db.menuItem.update({ where: { id: item.id }, data: { image: imageMap[item.nameEn] } });
  }
  await db.restaurantSettings.update({ where: { id: "1" }, data: { logoUrl: REMOTE_LOGO_URL, heroImageUrl: REMOTE_HERO_URL } });

  const testimonials = await db.testimonial.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  for (const [index, testimonial] of testimonials.entries()) {
    const avatar = TESTIMONIAL_AVATAR_URLS[index % TESTIMONIAL_AVATAR_URLS.length];
    await db.testimonial.update({ where: { id: testimonial.id }, data: { avatar } });
  }
  console.log(`✅ Done — ${existing.length} menu items, 1 settings row, ${testimonials.length} testimonials updated`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
