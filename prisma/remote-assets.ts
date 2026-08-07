import type { PrismaClient } from "@prisma/client";

export const REMOTE_LOGO_URL =
  "https://api.iconify.design/lucide:utensils-crossed.svg?color=%23f59e0b";
export const REMOTE_HERO_URL =
  "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=1600&q=85";

export const MENU_IMAGE_URLS: Record<string, string> = {
  "hummus.png": "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=900",
  "falafel.png": "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=900",
  "grape-leaves.png": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80",
  "lentil-soup.png": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  "seafood-chowder.png": "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80",
  "mixed-grill.png": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=80",
  "shish-tawook.png": "https://images.pexels.com/photos/1435907/pexels-photo-1435907.jpeg?auto=compress&cs=tinysrgb&w=900",
  "lamb-kebab.png": "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=900",
  "wings.png": "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=900",
  "salmon.png": "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=900",
  "shrimp-linguine.png": "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=900",
  "truffle-pasta.png": "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=80",
  "arrabbiata.png": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80",
  "margherita.png": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80",
  "pepperoni-pizza.png": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=80",
  "fattoush.png": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
  "caesar-salad.png": "https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=900",
  "kunafa.png": "https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg?auto=compress&cs=tinysrgb&w=900",
  "baklava.png": "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80",
  "lava-cake.png": "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=900",
  "lemonade.png": "https://images.pexels.com/photos/3184183/pexels-photo-3184183.jpeg?auto=compress&cs=tinysrgb&w=900",
  "turkish-coffee.png": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  "pomegranate-mocktail.png": "https://images.pexels.com/photos/1055272/pexels-photo-1055272.jpeg?auto=compress&cs=tinysrgb&w=900",
  "soft-drink.png": "https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=900",
  "truffle-fries.png": "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=900",
  "garlic-rice.png": "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=900",
  "grilled-veg.png": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80",
};

export const TESTIMONIAL_AVATAR_URLS = [
  "https://api.iconify.design/lucide:user-round.svg?color=%23f59e0b",
  "https://api.iconify.design/lucide:user.svg?color=%23d97706",
  "https://api.iconify.design/lucide:circle-user-round.svg?color=%23ea580c",
  "https://api.iconify.design/lucide:user-round-check.svg?color=%23c2410c",
] as const;

export async function assertMappedNeon(db: PrismaClient) {
  const [identity] = await db.$queryRaw<Array<{ database: string; project_id: string | null }>>`
    SELECT current_database() AS database, current_setting('neon.project_id', true) AS project_id
  `;
  if (identity?.database !== "neondb" || identity.project_id !== "bitter-wind-41729666") {
    throw new Error("Refusing asset update: database identity is not bitter-wind-41729666/neondb");
  }
}
