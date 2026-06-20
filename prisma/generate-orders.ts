// Generate test historical orders for analytics
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("📊 Generating historical orders for analytics...");
  const menuItems = await db.menuItem.findMany({ include: { category: true } });
  if (menuItems.length === 0) { console.log("No menu items"); return; }

  const now = new Date();
  let orderCounter = 2000;
  const orderTypes = ["dine_in", "takeout", "delivery"];
  const statuses = ["completed", "completed", "completed", "ready", "preparing"];

  // Generate orders over the last 30 days
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    // 2-8 orders per day, more on weekends
    const isWeekend = date.getDay() === 5 || date.getDay() === 6;
    const ordersToday = isWeekend ? 5 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);

    for (let o = 0; o < ordersToday; o++) {
      // spread orders across business hours
      const hour = 11 + Math.floor(Math.random() * 12);
      const minute = Math.floor(Math.random() * 60);
      date.setHours(hour, minute, 0, 0);

      const itemCount = 1 + Math.floor(Math.random() * 4);
      const items: any[] = [];
      let subtotal = 0;
      for (let i = 0; i < itemCount; i++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        items.push({
          menuItemId: item.id,
          quantity: qty,
          unitPrice: item.price,
          modifiers: "[]",
          notes: null,
          totalPrice: item.price * qty,
          status: "served",
          stationSlug: item.category.stationSlugs || "prep",
          course: 1,
        });
        subtotal += item.price * qty;
      }

      const tax = subtotal * 0.1;
      const type = orderTypes[Math.floor(Math.random() * orderTypes.length)];
      const deliveryFee = type === "delivery" ? 4.99 : 0;
      const tip = Math.random() > 0.5 ? Math.round(subtotal * (0.15 + Math.random() * 0.1) * 100) / 100 : 0;
      const total = subtotal + tax + deliveryFee + tip;
      const status = d === 0 ? statuses[Math.floor(Math.random() * statuses.length)] : "completed";

      await db.order.create({
        data: {
          orderNumber: `#${orderCounter++}`,
          type,
          status,
          customerName: `Customer ${orderCounter}`,
          customerPhone: `555-${String(orderCounter).padStart(4, "0")}`,
          subtotal,
          taxAmount: tax,
          deliveryFee,
          tipAmount: tip,
          total,
          paymentMethod: Math.random() > 0.5 ? "card" : "cash",
          paymentStatus: "paid",
          serverName: ["Sarah", "Layla", "Yusuf"][Math.floor(Math.random() * 3)],
          estimatedReady: new Date(date.getTime() + 25 * 60000),
          completedAt: status === "completed" ? new Date(date.getTime() + 30 * 60000) : null,
          items: { create: items },
        },
      });
    }
  }
  console.log(`✅ Generated ${orderCounter - 2000} historical orders over 30 days`);
}
main().finally(() => db.$disconnect());
