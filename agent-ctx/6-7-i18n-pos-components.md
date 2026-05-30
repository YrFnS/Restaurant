# Task 6-7: Update POSTerminal.tsx and TableFloorPlan.tsx to use i18n translation system

## Summary

Successfully updated both POS components to use the i18n translation system instead of hardcoded English strings.

## Changes Made

### 1. POSTerminal.tsx (`/home/z/my-project/src/components/pos/POSTerminal.tsx`)

- **Added import**: `import { useI18n } from '@/lib/i18n';`
- **Added hook**: `const { t } = useI18n();` inside `POSTerminal` component
- **Created `orderTypeLabels` mapping** inside the component (since ORDER_TYPES is defined outside the component and can't use hooks):
  - `dine_in` → `t.pos.dineIn`
  - `takeout` → `t.pos.takeout`
  - `delivery` → `t.pos.delivery`
  - `drive_thru` → `t.pos.driveThru`
- **Replaced all hardcoded strings** with translation references including:
  - Order type labels: `ot.label` → `orderTypeLabels[ot.value]`
  - Table number placeholder: "Table #" → `${t.staff.table} #`
  - Select button: "Select" → `t.common.select`
  - Hold button: "Hold" → `t.staff.hold`
  - Search: "Search items..." → `t.pos.searchMenu`
  - Quick Keys: "Quick Keys" → `t.pos.quickAdd`
  - Current Order: "Current Order" → `t.pos.title`
  - Clear: "Clear" → `t.pos.clearOrder`
  - No items: "No items in order" → `t.pos.noItems`
  - Subtotal/Tax/Discount/Tip/Total → `t.pos.subtotal` / `t.pos.tax` / `t.pos.discount` / `t.pos.tip` / `t.pos.total`
  - Pay button: `Pay $X.XX` → `${t.pos.pay} $${total.toFixed(2)}`
  - Modifier dialog: all labels translated
  - Payment dialog: all labels translated
  - Table dialog: "Select Table" → `t.pos.tableSelect`, "seats" → `t.pos.seats`
  - Held orders dialog: all labels translated
  - All toast messages translated

### 2. TableFloorPlan.tsx (`/home/z/my-project/src/components/pos/TableFloorPlan.tsx`)

- **Added import**: `import { useI18n } from '@/lib/i18n';`
- **Removed `label` from STATUS_CONFIG** since it can't use hooks outside components
- **Added `useI18n()` hook** in each component that has hardcoded strings:
  - `FloorPlanView` - added `statusLabels` and `sectionLabels` mappings
  - `ListView` - added `statusLabels` and `sectionLabels` mappings
  - `FloorPlanLegend` - added `statusLabels` mapping
  - `TableFloorPlan` (main) - added `statusLabels` mapping
- **Replaced all hardcoded strings**:
  - Section labels: "Main Floor" → `t.pos.mainFloor`, "Patio" → `t.pos.patio`, etc.
  - Status labels: "Available" → `t.pos.available`, "Occupied" → `t.pos.occupied`, etc.
  - "Tables" → `t.pos.tables`
  - "Floor" → `t.pos.floorPlan`, "List" → `t.pos.listView`
  - "Deselect" → `t.pos.deselect`
  - "seats" → `t.pos.seats`
  - "Table X" → `${t.staff.table} ${number}`
  - Status badge in ListView: `config.label` → `statusLabels[table.status]`

### 3. Locale files updated

- **en.json**: Added `"select": "Select"` to `common` section
- **ar.json**: Added `"select": "اختيار"` to `common` section

## Lint Status

✅ `bun run lint` passes with no errors
