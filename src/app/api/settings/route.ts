import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireStaffSession,
  SETTINGS_MANAGEMENT_ROLES,
} from "@/lib/auth/guard";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalLinkSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      /^https?:\/\//i.test(value),
    "Must be empty, a site-relative path, or an HTTP(S) URL"
  );

const settingsSchema = z
  .object({
    id: z.literal("1").optional(),
    nameEn: z.string().trim().max(160),
    nameAr: z.string().trim().max(160),
    taglineEn: z.string().trim().max(240),
    taglineAr: z.string().trim().max(240),
    descriptionEn: z.string().trim().max(5_000),
    descriptionAr: z.string().trim().max(5_000),
    phone: z.string().trim().max(60),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    addressEn: z.string().trim().max(1_000),
    addressAr: z.string().trim().max(1_000),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    taxRate: z.number().min(0).max(1),
    currency: z.string().trim().min(3).max(8),
    currencySymbol: z.string().trim().min(1).max(12),
    deliveryFee: z.number().min(0).max(1_000_000),
    minDeliveryOrder: z.number().min(0).max(1_000_000),
    deliveryRadiusKm: z.number().min(0).max(10_000),
    avgPrepTimeMin: z.number().int().min(1).max(600),
    tipPresets: z.string().trim().max(120),
    openTime: timeSchema,
    closeTime: timeSchema,
    logoUrl: optionalLinkSchema,
    heroImageUrl: optionalLinkSchema,
    facebookUrl: optionalLinkSchema,
    instagramUrl: optionalLinkSchema,
    twitterUrl: optionalLinkSchema,
    whatsappUrl: optionalLinkSchema,
    giftCardAmounts: z.string().trim().max(240),
    statsOrdersServed: z.number().int().min(0).max(2_147_483_647),
    statsHappyCustomers: z.number().int().min(0).max(2_147_483_647),
    statsYearsService: z.number().int().min(0).max(1_000),
    kdsGreenMin: z.number().int().min(0).max(1_440),
    kdsYellowMin: z.number().int().min(0).max(1_440),
    kdsRedMin: z.number().int().min(0).max(1_440),
    soundOnNewTicket: z.boolean(),
    createdAt: z.string().datetime().or(z.date()).optional(),
    updatedAt: z.string().datetime().or(z.date()).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.kdsGreenMin <= value.kdsYellowMin &&
      value.kdsYellowMin <= value.kdsRedMin,
    {
      message: "KDS thresholds must be ordered green, yellow, then red",
      path: ["kdsRedMin"],
    }
  );

export async function GET() {
  const settings = await db.restaurantSettings.findFirst({ where: { id: "1" } });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffSession(SETTINGS_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid restaurant settings",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...settingsData
    } = parsed.data;
    const settings = await db.restaurantSettings.upsert({
      where: { id: "1" },
      update: settingsData,
      create: { id: "1", ...settingsData },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[settings] Failed to save settings", error);
    return NextResponse.json(
      { error: "Failed to save settings", code: "SETTINGS_SAVE_FAILED" },
      { status: 500 }
    );
  }
}
