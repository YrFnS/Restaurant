import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { success, remaining } = rateLimit(`ai-recommend:${ip}`, 5, 60 * 1000);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { message, locale } = body as { message: string; locale: string };

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Sanitize and limit message length
    const sanitizedMessage = sanitizeString(message);
    if (sanitizedMessage.length > 1000) {
      return NextResponse.json(
        { error: "Message must be at most 1000 characters" },
        { status: 400 }
      );
    }

    // Fetch all menu items with categories from database
    const categories = await db.menuCategory.findMany({
      where: { isAvailable: true },
      include: {
        items: {
          where: { isAvailable: true },
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
            descriptionAr: true,
            price: true,
            isPopular: true,
            isSpecial: true,
            preparationTime: true,
            calories: true,
            dietary: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Build menu context string
    const menuContext = categories
      .map((cat) => {
        const catName = locale === "ar" ? cat.nameAr : cat.nameEn;
        const items = cat.items
          .map((item) => {
            const name = locale === "ar" ? item.nameAr : item.nameEn;
            const desc = locale === "ar" ? item.descriptionAr : item.descriptionEn;
            const dietary = item.dietary ? ` [${item.dietary}]` : "";
            return `- ${name}: $${item.price.toFixed(2)}${dietary}${item.isPopular ? " (Popular)" : ""}${item.isSpecial ? " (Chef's Special)" : ""} - ${desc} (${item.calories} cal, ${item.preparationTime} min)`;
          })
          .join("\n");
        return `${catName} (${cat.icon}):\n${items}`;
      })
      .join("\n\n");

    // Fetch restaurant name from DB settings
    const settings = await db.restaurantSettings.findUnique({ where: { id: "1" } });
    const nameEn = settings?.nameEn || "";
    const nameAr = settings?.nameAr || "";

    // Use z-ai-web-dev-sdk LLM
    const ZAI = (await import("z-ai-web-dev-sdk")).default;

    const systemPrompt = locale === "ar"
      ? `أنت مساعد قائمة ذكي لـ${nameAr}. ساعد الضيوف في العثور على الأطباق المثالية بناءً على تفضيلاتهم. استخدم القائمة أدناه لتقديم توصيات محددة مع أسماء الأطباق وأسعارها. كن ودوداً ومختصراً. أجب بالعربية فقط.

قائمة المطعم:
${menuContext}`
      : `You are a friendly AI menu assistant for ${nameEn}. Help guests find the perfect dishes based on their preferences. Use the menu below to give specific recommendations with dish names and prices. Be warm, concise, and helpful. Always recommend specific items from the menu.

Restaurant Menu:
${menuContext}`;

    const response = await ZAI.LLM.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: sanitizedMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiMessage =
      response.choices?.[0]?.message?.content ||
      response.content ||
      "I'd be happy to help you find something delicious! Could you tell me more about what you're in the mood for?";

    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error("Error in AI recommend:", error);
    return NextResponse.json(
      { error: "Failed to get recommendation", message: "I'm having trouble right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
