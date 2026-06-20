// Assign generated food images to ALL menu items
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const imageMap: Record<string, string> = {
  // Existing (already assigned, but re-assign to be safe)
  "Hummus Beiruti": "/images/menu/hummus.png",
  "Falafel Plate": "/images/menu/falafel.png",
  "Stuffed Grape Leaves": "/images/menu/grape-leaves.png",
  "Lentil Soup": "/images/menu/lentil-soup.png",
  "Seafood Chowder": "/images/menu/seafood-chowder.png",
  "Mixed Grill Platter": "/images/menu/mixed-grill.png",
  "Shish Tawook": "/images/menu/shish-tawook.png",
  "Lamb Kebab": "/images/menu/lamb-kebab.png",
  "Spicy Wings": "/images/menu/wings.png",
  "Grilled Salmon": "/images/menu/salmon.png",
  "Shrimp Linguine": "/images/menu/shrimp-linguine.png",
  "Truffle Mushroom Pasta": "/images/menu/truffle-pasta.png",
  "Spicy Arrabbiata": "/images/menu/arrabbiata.png",
  "Margherita": "/images/menu/margherita.png",
  "Spicy Pepperoni": "/images/menu/pepperoni-pizza.png",
  "Fattoush": "/images/menu/fattoush.png",
  "Caesar Salad": "/images/menu/caesar-salad.png",
  "Kunafa": "/images/menu/kunafa.png",
  "Baklava (4 pcs)": "/images/menu/baklava.png",
  "Chocolate Lava Cake": "/images/menu/lava-cake.png",
  "Fresh Mint Lemonade": "/images/menu/lemonade.png",
  "Turkish Coffee": "/images/menu/turkish-coffee.png",
  "Pomegranate Mocktail": "/images/menu/pomegranate-mocktail.png",
  "Soft Drinks": "/images/menu/soft-drink.png",
  "Truffle Fries": "/images/menu/truffle-fries.png",
  "Garlic Rice": "/images/menu/garlic-rice.png",
  "Grilled Vegetables": "/images/menu/grilled-veg.png",
};

async function main() {
  console.log("🖼️  Assigning food images to ALL menu items...");
  let updated = 0;
  for (const [name, img] of Object.entries(imageMap)) {
    const item = await db.menuItem.findFirst({ where: { nameEn: name } });
    if (item) {
      await db.menuItem.update({ where: { id: item.id }, data: { image: img } });
      updated++;
      console.log(`  ✓ ${name} → ${img}`);
    } else {
      console.log(`  ✗ ${name} not found`);
    }
  }
  console.log(`✅ Done — ${updated} items updated`);
}
main().finally(() => db.$disconnect());
