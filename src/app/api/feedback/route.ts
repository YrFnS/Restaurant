import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const { success, remaining } = rateLimit(`feedback:${ip}`, 3, 60 * 1000);

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
    const { name, email, rating, comment } = body;

    if (!name || !comment || !rating) {
      return NextResponse.json(
        { error: "Name, rating, and comment are required" },
        { status: 400 }
      );
    }

    // Validate string lengths
    if (typeof name !== "string" || name.length > 255) {
      return NextResponse.json(
        { error: "Name must be at most 255 characters" },
        { status: 400 }
      );
    }
    if (typeof comment !== "string" || comment.length > 2000) {
      return NextResponse.json(
        { error: "Comment must be at most 2000 characters" },
        { status: 400 }
      );
    }

    const numRating = parseInt(rating, 10);
    if (numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const feedback = await db.feedback.create({
      data: {
        name: sanitizeString(name),
        email: email ? sanitizeString(email) : null,
        rating: numRating,
        comment: sanitizeString(comment),
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const feedbacks = await db.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
