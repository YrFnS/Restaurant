// Assign generated food images to menu items
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const imageMap: Record<string, string> = {
  "Hummus Beiruti": "/images/menu/hummus.png",
  "Falafel Plate": "/images/menu/falafel.png",
  "Lentil Soup": "/images/menu/lentil-soup.png",
  "Mixed Grill Platter": "/images/menu/mixed-grill.png",
  "Shish Tawook": "/images/menu/shish-tawook.png",
  "Spicy Wings": "/images/menu/wings.png",
  "Grilled Salmon": "/images/menu/salmon.png",
  "Truffle Mushroom Pasta": "/images/menu/truffle-pasta.png",
  "Margherita": "/images/menu/margherita.png",
  "Fattoush": "/images/menu/fattoush.png",
  "Kunafa": "/images/menu/kunafa.png",
  "Fresh Mint Lemonade": "/images/menu/lemonade.png",
};

async function main() {
  console.log("🖼️  Assigning food images to menu items...");
  for (const [name, img] of Object.entries(imageMap)) {
    const item = await db.menuItem.findFirst({ where: { nameEn: name } });
    if (item) {
      await db.menuItem.update({ where: { id: item.id }, data: { image: img } });
      console.log(`  ✓ ${name} → ${img}`);
    } else {
      console.log(`  ✗ ${name} not found`);
    }
  }
  // also set hero image
  await db.restaurantSettings.update({ where: { id: "1" }, data: { heroImageUrl: "/images/hero-restaurant.png" } });
  console.log("  ✓ Hero background set");
  console.log("✅ Done");
}
main().finally(() => db.$disconnect());
