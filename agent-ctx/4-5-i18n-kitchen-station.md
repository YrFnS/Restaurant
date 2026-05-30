# Task 4-5: i18n Translation System for KitchenDisplay & StationDisplay

## Summary
Updated both `KitchenDisplay.tsx` and `StationDisplay.tsx` to use the i18n translation system instead of hardcoded English strings.

## Changes Made

### KitchenDisplay.tsx
- Added `import { useI18n } from '@/lib/i18n';`
- Added `const { t } = useI18n();` to 6 components:
  - `OrderItemGridRow`
  - `OrderItemListRow`
  - `OrderTicketCard`
  - `CompletedOrderCard`
  - `KitchenDisplay` (main export)
- Replaced all hardcoded strings with translation keys using `t.staff.*` namespace

### StationDisplay.tsx
- Added `import { useI18n } from '@/lib/i18n';`
- Added `const { t } = useI18n();` to 5 components:
  - `OrderItemCard`
  - `OrderTicketCard`
  - `CompletedOrderCard`
  - `StationDisplay` (main export)
- Replaced all hardcoded strings with translation keys using `t.staff.*` namespace

## Translation Key Mapping
| Hardcoded String | Translation Key |
|---|---|
| "All Orders" | t.staff.allOrders |
| "All Stations" | t.staff.allStations |
| "Sound On" / "On" | t.staff.soundOn |
| "Sound Off" / "Off" | t.staff.soundOff |
| "Fullscreen" | t.staff.fullscreen |
| "Priority" (sort) | t.staff.sortPriority / t.staff.priority |
| "Pri" | t.staff.sortPriority |
| "Time" (sort) | t.staff.sortTime |
| "Avg:" | t.staff.avg |
| "Done:" | t.staff.done |
| "Alert" | t.staff.alert |
| "No active orders" | t.staff.noActiveOrders |
| "Loading orders..." | t.staff.loadingOrders |
| "Recently Completed" | t.staff.recentlyCompleted |
| "ALL DAY:" | t.staff.allDay |
| "FIRE" | t.staff.fire |
| "BUMP" | t.staff.bump |
| "BUMP ALL" | t.staff.bumpAll |
| "ALL READY" | t.staff.allReady |
| "HOLD" | t.staff.hold |
| "On Hold (X)" | `${t.staff.onHold} (X)` |
| "Hold (X)" | `${t.staff.hold} (X)` |
| "Seat X" | `${t.staff.seat} X` |
| "Table X" | `${t.staff.table} X` |
| "PRIORITY" | t.staff.priority |
| "items" / "item" | t.staff.items / t.staff.item |

## Notes
- Helper functions (`getStatusInfo`, `getOrderTypeIcon`, `formatRelativeTime`) were kept as-is since they are outside React components and cannot use hooks
- The "Orders for {station} will appear here" string in StationDisplay was simplified to just show `stationName` as the subtitle under `t.staff.noActiveOrders`
- Lint passed with no errors
