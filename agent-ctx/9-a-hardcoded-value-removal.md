# Task 9-a: Hardcoded Value Removal Agent

## Summary
Audited and removed all hardcoded fake data from the Saffron Restaurant app. All data now comes from the database via API routes, with proper loading states when data is unavailable.

## Changes Made

### 1. HomeSection.tsx — Replaced hardcoded testimonials with API data
- **Before**: Hardcoded `testimonials` array with 3 fake reviews (review1Name/review1Comment keys, static avatars)
- **After**: Added `Testimonial` interface, `testimonials` state, and fetch from `/api/testimonials` API
- The Testimonial model already existed in Prisma with nameEn/nameAr/commentEn/commentAr/avatar/stars fields
- The `/api/testimonials` route already existed
- Testimonials section now only renders when `testimonials.length > 0` (no fake fallback)
- Display uses `locale === "ar" ? review.commentAr : review.commentEn` for locale-aware content

### 2. ContactSection.tsx — Removed hardcoded hours fallback
- **Before**: `"10:00 AM - 11:00 PM"` shown as fallback when settings hadn't loaded
- **After**: Shows `"—"` placeholder when settings are unavailable

### 3. RewardsSection.tsx — Replaced hardcoded REWARD_TIERS with API data
- **Before**: Hardcoded `REWARD_TIERS` array with 4 tiers (freeAppetizer/freeDessert/tenOff/freeMainCourse) using i18n key references
- **After**: Added `RewardTier` interface, `rewardTiers` state, and fetch from `/api/reward-tiers` API
- The RewardTier model already existed in Prisma with nameEn/nameAr/points/icon/tier fields
- The `/api/reward-tiers` route already existed
- Next reward calculation now uses `rewardTiers` from state
- Display uses `locale === "ar" ? tier.nameAr : tier.nameEn` for locale-aware content

## Items Audited and Found Clean (No Changes Needed)

- **StaffLogin.tsx**: No demo PINs displayed (confirmed — the worklog mentioned them but they were never implemented or were already removed)
- **ContactSection.tsx FAQ_ITEMS**: Maps to i18n translation keys, not fake data — this is appropriate for static FAQ content
- **ContactSection.tsx services cards**: Uses i18n translations for catering/private events descriptions — appropriate
- **RewardsSection.tsx CARD_TEMPLATES**: UI configuration (gradient colors + icons for gift card templates) — can stay
- **RewardsSection.tsx AMOUNT_PRESETS**: UI configuration ([25, 50, 75, 100]) — can stay
- **HomeSection.tsx categoryGradients**: UI configuration mapping emoji to gradient CSS — can stay
- **HomeSection.tsx dietaryColors**: UI configuration mapping dietary labels to CSS classes — can stay
- **Footer.tsx "Saffron"**: Brand name in "Powered by Saffron" — this is the actual app name, not fake data
- **TopBar/DesktopSidebar**: Use `t.app.name` as fallback — i18n key, not hardcoded fake data
- **i18n en.json "Saffron Restaurant"**: App name from translations, set by seed data — not fake data

## Lint Status
✅ `bun run lint` passes clean with no errors
