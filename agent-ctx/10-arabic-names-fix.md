# Task 10: Fix menu item display in staff-facing components to use Arabic item names

## Summary

Fixed all 5 staff-facing components to display Arabic item names when Arabic language is selected.

## Changes Made

### 1. KitchenDashboard.tsx
- Added `menuItemNameAr: string` to `OrderItemData` interface
- Changed `const { t } = useI18n()` → `const { t, locale } = useI18n()`
- In fetch mapping: Added `menuItemNameAr` field from `menuItem?.nameAr`
- In display: Changed `item.menuItemName` → `locale === 'ar' && item.menuItemNameAr ? item.menuItemNameAr : item.menuItemName`

### 2. KitchenDisplay.tsx
- Added `menuItemNameAr: string` to `OrderItemData` interface
- Changed all 3 sub-components (`OrderItemGridRow`, `OrderItemListRow`, `OrderTicketCard`) to destructure `locale` from `useI18n()`
- In fetch mapping: Added `menuItemNameAr` field from `menuItem?.nameAr`
- In all display locations: Changed `item.menuItemName` → locale-aware expression

### 3. StationDisplay.tsx
- Added `menuItemNameAr: string` to `OrderItemData` interface
- Changed `OrderItemCard` component to destructure `locale` from `useI18n()`
- Changed main `StationDisplay` component to destructure `locale` from `useI18n()`
- In fetch mapping: Added `menuItemNameAr` field from `menuItem?.nameAr`
- In display: Changed `item.menuItemName` → locale-aware expression
- In `allDaySummary`: Changed `item.menuItemName` → locale-aware expression, added `locale` to useMemo deps

### 4. POSTerminal.tsx
- Added `nameAr: string` to `CartItem` interface
- Changed `const { t } = useI18n()` → `const { t, locale } = useI18n()`
- Search: Added `i.nameAr.includes(searchQuery)` for Arabic search
- `quickAdd`: Store `nameAr: item.nameAr` in cart item
- `addWithModifiers`: Store `nameAr: selectedItem.nameAr` in cart item
- Category tabs: `cat.nameEn` → locale-aware expression
- Quick key items: `item.nameEn` → locale-aware expression
- Item grid: `item.nameEn` → locale-aware expression (both alt text and display)
- Cart display: `item.name` → locale-aware expression
- Modifier dialog title: `selectedItem.nameEn` → locale-aware expression
- Held orders: `i.name` → locale-aware expression

### 5. AdminPanel.tsx
- Changed `const { t } = useI18n()` → `const { t, locale } = useI18n()`
- Search filter: Added `i.nameAr.includes(menuSearch)` for Arabic search
- Category badges: `cat.nameEn` → locale-aware expression
- Menu items table: `item.nameEn` → locale-aware expression (both name cell and image alt)
- Category badge in table: `cat?.nameEn` → locale-aware expression
- Combo items display: `mi.nameEn` → locale-aware expression
- Top selling items: `item.nameEn` → locale-aware expression
- Restaurant name in settings: `settings.nameEn` → locale-aware expression
- Category select in menu form: `c.nameEn` → locale-aware expression
- Combo items select: `mi.nameEn` → locale-aware expression

## Lint Result
All changes pass `bun run lint` with no errors.
