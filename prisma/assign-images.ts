// Assign a small curated set of remote food images to existing menu items.
import { PrismaClient } from "@prisma/client";
import { assertMappedNeon, MENU_IMAGE_URLS, REMOTE_HERO_URL, REMOTE_LOGO_URL } from "./remote-assets";

const db = new PrismaClient();
const imageMap: Record<string, string> = {
  "Hummus Beiruti": MENU_IMAGE_URLS["hummus.png"],
  "Falafel Plate": MENU_IMAGE_URLS["falafel.png"],
  "Lentil Soup": MENU_IMAGE_URLS["lentil-soup.png"],
  "Mixed Grill Platter": MENU_IMAGE_URLS["mixed-grill.png"],
  "Shish Tawook": MENU_IMAGE_URLS["shish-tawook.png"],
  "Spicy Wings": MENU_IMAGE_URLS["wings.png"],
  "Grilled Salmon": MENU_IMAGE_URLS["salmon.png"],
  "Truffle Mushroom Pasta": MENU_IMAGE_URLS["truffle-pasta.png"],
  Margherita: MENU_IMAGE_URLS["margherita.png"],
  Fattoush: MENU_IMAGE_URLS["fattoush.png"],
  Kunafa: MENU_IMAGE_URLS["kunafa.png"],
  "Fresh Mint Lemonade": MENU_IMAGE_URLS["lemonade.png"],
};

async function main() {
  await assertMappedNeon(db);
  console.log("🖼️  Assigning curated remote food images to menu items...");
  for (const [name, image] of Object.entries(imageMap)) {
    const item = await db.menuItem.findFirst({ where: { nameEn: name }, select: { id: true } });
    if (!item) throw new Error(`Missing mapped menu item: ${name}`);
    await db.menuItem.update({ where: { id: item.id }, data: { image } });
    console.log(`  ✓ ${name}`);
  }
  await db.restaurantSettings.update({ where: { id: "1" }, data: { logoUrl: REMOTE_LOGO_URL, heroImageUrl: REMOTE_HERO_URL } });
  console.log("✅ Done");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
