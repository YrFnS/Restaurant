# Task 2 - Hardcoded Values Fix Agent

## Summary
Fixed all hardcoded fake data values across the app, replacing them with dynamic DB-fetched or i18n-translated values.

## Changes Made

### Files Modified:
1. **src/app/layout.tsx** - Replaced static `metadata` with `generateMetadata()` fetching from DB
2. **src/components/restaurant/QRCodeMenu.tsx** - Generic filename, i18n names/share text
3. **src/components/restaurant/RewardsSection.tsx** - t.app.name for gift card brand
4. **src/components/layout/AIAssistantButton.tsx** - t.app.name and t.ai.tryThese
5. **src/app/api/ai-recommend/route.ts** - Dynamic restaurant name from DB in AI prompt
6. **src/components/staff/StaffLogin.tsx** - Removed demo PIN display
7. **src/app/api/orders/[id]/route.ts** - No fake prep time fallback
8. **src/app/api/menu/route.ts** - preparationTime || 0 instead of || 15
9. **src/lib/i18n/locales/en.json** - Added qr.shareText, ai.tryThese
10. **src/lib/i18n/locales/ar.json** - Added qr.shareText, ai.tryThese
11. **src/components/restaurant/CartSection.tsx** - Removed ?? 15, ?? 20 fallbacks
12. **src/components/admin/AdminPanel.tsx** - Changed preparationTime '15'→'0', avgPrepTime || 25→|| 0

### Directory Removed:
- **src/app/kitchen/[station]** - Conflicting route with [slug], caused Next.js error

## Verification
- `bun run lint` passes clean
- `npx next build` succeeds
- Dev server returns HTTP 200
- KitchenDisplay.tsx was already fixed by previous agent (dynamic stations from /api/stations)
