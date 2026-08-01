import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { REPORTING_ROLES, requireStaffSession } from "@/lib/auth/guard";
import {
  consumeRateLimit,
  getRequestSource,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const feedbackSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .nullable()
      .optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(5_000),
  })
  .strict();

const FEEDBACK_WINDOW_MS = 60_000;
const MAX_FEEDBACK_PER_WINDOW = 10;

export async function GET() {
  const auth = await requireStaffSession(REPORTING_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const feedback = await db.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(
      { feedback },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[feedback] Failed to load feedback", error);
    return NextResponse.json(
      { error: "Unable to load feedback", code: "FEEDBACK_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let feedbackLimit;
  try {
    feedbackLimit = await consumeRateLimit({
      scope: "feedback-submit",
      identifier: getRequestSource(req),
      limit: MAX_FEEDBACK_PER_WINDOW,
      windowMs: FEEDBACK_WINDOW_MS,
    });
  } catch (error) {
    console.error("[feedback] Shared rate limiter failed", error);
    return NextResponse.json(
      {
        error: "Feedback is temporarily unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!feedbackLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many feedback submissions",
        code: "FEEDBACK_RATE_LIMITED",
      },
      { status: 429, headers: rateLimitHeaders(feedbackLimit) }
    );
  }

  try {
    const parsed = feedbackSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid feedback",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const feedback = await db.feedback.create({
      data: {
        ...parsed.data,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      },
      select: { id: true, rating: true, createdAt: true },
    });
    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("[feedback] Failed to create feedback", error);
    return NextResponse.json(
      { error: "Unable to submit feedback", code: "FEEDBACK_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
