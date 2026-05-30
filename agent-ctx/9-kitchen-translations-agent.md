# Task 9: Fix Kitchen Helper Functions for Arabic Translations

## Summary
Updated helper functions in all three Kitchen components to accept optional translation parameters, enabling Arabic translation support while maintaining backward compatibility.

## Changes Made

### KitchenDashboard.tsx
1. **`formatRelativeTime`** - Added optional `t?: { justNow: string; ago: string }` parameter
2. **`getOrderTypeIcon`** - Added optional `labels?: { takeout: string; delivery: string; driveThru: string; dineIn: string }` parameter
3. **`getStatusInfo`** - Added optional `t?: { pending: string; fired: string; preparing: string; ready: string; served: string; cancelled: string }` parameter
4. Updated 3 call sites to pass translations from `t.staff` and `t.kitchen`

### KitchenDisplay.tsx
1. **`formatRelativeTime`** - Added optional translation parameter (same as above)
2. **`getOrderTypeIcon`** - Added optional labels parameter (same as above)
3. **`getStatusInfo`** - Added optional translation parameter (same as above)
4. **`ElapsedTimer`** - Added `const { t } = useI18n()` and passed translations to `formatRelativeTime` (2 call sites)
5. Updated `OrderItemGridRow` - passed translations to `getStatusInfo`
6. Updated `OrderItemListRow` - passed translations to `getStatusInfo`
7. Updated `OrderTicketCard` - passed translations to `getOrderTypeIcon`
8. Updated `CompletedOrderCard` - passed translations to `getOrderTypeIcon`

### StationDisplay.tsx
1. **`formatRelativeTime`** - Added optional translation parameter (same as above)
2. **`getOrderTypeIcon`** - Added optional labels parameter (same as above)
3. **`getStatusInfo`** - Added optional translation parameter (same as above)
4. **`ElapsedTimer`** - Added `const { t } = useI18n()` and passed translations to `formatRelativeTime` (2 call sites)
5. Updated `OrderItemCard` - passed translations to `getStatusInfo`
6. Updated `OrderTicketCard` - passed translations to `getOrderTypeIcon`
7. Updated `CompletedOrderCard` - passed translations to `getOrderTypeIcon`

## Translation Keys Used
- `t.staff.pending`, `t.staff.fired`, `t.staff.preparing`, `t.staff.ready`, `t.staff.served`, `t.staff.cancelled`
- `t.staff.takeout`, `t.staff.delivery`, `t.staff.driveThru`, `t.staff.dineIn`
- `t.staff.justNow`, `t.kitchen.ago`

## Verification
- `bun run lint` passed with no errors
- Dev server compiles successfully with no errors
- All functions remain backward-compatible (optional parameters with English fallbacks)
