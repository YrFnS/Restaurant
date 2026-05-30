# Task 2: Update StaffLogin.tsx to use i18n translation system

## Summary
Successfully replaced all hardcoded English strings in `/home/z/my-project/src/components/staff/StaffLogin.tsx` with i18n translation references.

## Changes Made

### Import Added
- Added `import { useI18n } from '@/lib/i18n';`

### Hook Added
- Added `const { t } = useI18n();` inside the `StaffLogin` component body

### String Replacements (20 total)

| Original String | Translation Key |
|---|---|
| "Saffron" (branding, 2 occurrences) | `t.app.name` |
| "Restaurant Management System" | `t.staff.systemTitle` |
| "Staff Login" | `t.kitchen.login` |
| "Enter your PIN to access the system" | `t.staff.enterPinDesc` |
| "Enter 4-digit PIN" | `t.staff.enterPinPlaceholder` |
| "Verifying..." | `t.staff.verifying` |
| "Sign In" | `t.staff.signIn` |
| "Forgot PIN? Contact admin" | `t.staff.forgotPin` |
| "You do not have permission to access this page" | `t.staff.noPermission` |
| "Invalid PIN" | `t.staff.invalidPin` |
| "Connection error. Please try again." | `t.staff.connectionError` |
| "Please enter a valid 4-digit PIN" | `t.staff.enterValidPin` |
| "Loading..." | `t.common.loading` |
| "Demo PINs" | `t.staff.demoPins` |
| "Admin" (demo role) | `t.staff.admin` |
| "Manager" (demo role) | `t.staff.manager` |
| "Staff" (demo role) | Kept as inline "Staff" (per instructions) |
| "Kitchen" (nav) | `t.staff.kitchenNav` |
| "POS" (nav) | `t.staff.posNav` |
| "Admin" (nav) | `t.staff.adminNav` |
| "Keyboard Shortcuts" (2 occurrences) | `t.staff.keyboardShortcuts` |
| "Toggle this help" (2 occurrences) | `t.staff.toggleHelp` |
| "Go to Kitchen" (2 occurrences) | `t.staff.goToKitchen` |
| "Go to POS" (2 occurrences) | `t.staff.goToPOS` |
| "Go to Admin" (2 occurrences) | `t.staff.goToAdmin` |
| "Log out" (2 occurrences) | `t.staff.logOut` |
| "Close" (2 occurrences) | `t.staff.close` |

### Notes
- All translation keys confirmed to exist in `src/lib/i18n/locales/en.json`
- No styling or logic changes were made
- The component remains a `'use client'` component with `useI18n()` called inside the component body
- The "Staff" demo role label was left as hardcoded text per instructions (generic English term)
