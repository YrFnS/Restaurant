# Task 8: Update AdminPanel.tsx to use i18n translation system

## Summary
Successfully updated the AdminPanel component to use the i18n translation system instead of hardcoded English strings.

## Changes Made

### 1. Locale Files Updated
- **`src/lib/i18n/locales/en.json`**: Added ~100 new keys to the `admin` section covering:
  - Dashboard strings (welcomeBack, todaysRevenue, ordersToday, etc.)
  - Section titles (tableManagement, reportsAnalytics, etc.)
  - Action labels (addShift, addRule, addStation, etc.)
  - Settings section titles (settingsConfig, taxServiceConfig, paymentSettings, etc.)
  - Status labels (currentlyOpen, currentlyClosed, closed, etc.)
  - Form labels and dialog titles
  - Toast and confirmation messages
  - Common UI strings (restock, noCategory, etc.)

- **`src/lib/i18n/locales/ar.json`**: Added matching Arabic translations for all new keys

### 2. Component Updates (`src/components/admin/AdminPanel.tsx`)

#### Import & Hook
- Added `import { useI18n } from '@/lib/i18n';`
- Added `const { t } = useI18n();` inside the component
- Added `const ta = t.admin as Record<string, string>;` shorthand for easy access
- Added `dayNameMap` for translating English day names to localized versions

#### SIDEBAR_ITEMS (outside component)
- Changed `label` field to `labelKey` referencing dictionary keys
- Changed `group` field to `groupKey` referencing dictionary keys
- Added `resolveSidebarLabel()` and `resolveGroupLabel()` helpers inside component

#### SIDEBAR_GROUPS → SIDEBAR_GROUP_KEYS
- Changed from display labels to i18n keys ('overview', 'manage', 'analytics', 'finance', 'operations', 'system')

#### All Toast Messages
- Replaced all `toast.success('...')` and `toast.error('...')` with `ta.*` references

#### All confirm() Dialogs
- Replaced all `confirm('Delete this item?')` with `ta.deleteConfirm`
- Replaced all `confirm('Delete?')` with `ta.deleteConfirmShort`

#### All Section Titles & Page Headers
- Dashboard, Menu Management, Dynamic Pricing, Combo Meals, Inventory, Employees, Schedule, Table Management, Kitchen Stations, Reports & Analytics, Cash Drawer, Reservations, Notifications, Settings & Configuration

#### All Dialog Titles & Form Labels
- Edit/Add variants for all entity dialogs
- Cancel/Save/Create/Add button labels
- Form field labels

#### Sidebar Content
- Theme toggle (Light Mode/Dark Mode → t.common.lightMode/darkMode)
- Sign Out button
- Search placeholder
- Group headers resolved via i18n keys

#### Dashboard Cards
- Today's Revenue, Orders Today, Active Reservations, Low Stock Alerts
- Recent Activity, Low Stock sections
- Quick action buttons

#### Settings Section
- All section titles (Restaurant Information, Operating Hours, Tax & Service, etc.)
- Currently Open/Closed status
- Day names in operating hours schedule
- "to" connector text
- Happy Hour label
- Closed label
- Save/Reset buttons
- Saving indicator

## Verification
- `bun run lint` passes with no errors
- Dev server runs without compilation errors
- All API endpoints respond correctly
