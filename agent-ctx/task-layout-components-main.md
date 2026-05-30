# Task: Restaurant App Layout & Navigation Components

## Summary
Created all layout and navigation components for the Saffron Restaurant app with full RTL/LTR i18n support, warm amber/orange color scheme, and Framer Motion animations.

## Files Created
1. **`/src/components/layout/TopBar.tsx`** — Top header bar with:
   - Restaurant logo (ChefHat icon) & name
   - Language toggle (shows "عربي" when English, "English" when Arabic)
   - Dark mode toggle (Sun/Moon icons)
   - Cart icon with count badge
   - Warm gradient background (`gradient-warm` class)
   - RTL-aware layout with `dir` attribute

2. **`/src/components/layout/BottomNav.tsx`** — Bottom tab navigation with:
   - 5 tabs: Home, Menu, Cart (with badge), Orders, More
   - Framer Motion `layoutId` animated indicator
   - More button opens Sheet with: Reservations, Waitlist, Rewards, Contact
   - Active tab highlighted with primary color
   - RTL-aware (sheet opens from left in RTL)
   - Sticky bottom, hidden on md+ screens

3. **`/src/components/layout/CartSheet.tsx`** — Cart sliding sheet with:
   - Opens from end side (right in LTR, left in RTL)
   - Empty state with browse menu button
   - Cart items with image, modifiers, quantity controls
   - Subtotal, tax, and total calculations
   - Checkout button in footer
   - RTL-aware side & layout

4. **`/src/components/layout/AppShell.tsx`** — Main app shell with:
   - TopBar + main content + BottomNav layout
   - Placeholder section components for all 8 sections
   - Framer Motion AnimatePresence page transitions
   - CSS logical properties for RTL support
   - `dir` attribute on root container
   - Proper padding for header (pt-14) and bottom nav (pb-16)

## Files Updated
5. **`/src/app/globals.css`** — Custom styles:
   - Warm amber/orange primary color: `oklch(0.75 0.18 55)` (light) / `oklch(0.78 0.16 55)` (dark)
   - Full color scheme with warm hue (55) throughout
   - RTL direction CSS custom property
   - Custom scrollbar styling
   - `.gradient-warm` and `.gradient-warm-subtle` utility classes
   - Safe area inset utilities (`.pb-safe`, `.pt-safe`)
   - Bottom nav safe area padding class
   - Page transition container class

6. **`/src/app/layout.tsx`** — Updated with:
   - Restaurant-specific metadata
   - `<Providers>` wrapper component

7. **`/src/app/providers.tsx`** — New client component:
   - ThemeProvider (next-themes) with class attribute
   - I18nProvider wrapping children
   - Toaster component

8. **`/src/app/page.tsx`** — Updated to render `<AppShell />`

9. **`/src/lib/i18n/index.tsx`** — Fixed lint error:
   - Replaced `useEffect` + `setState` with lazy initializer `getInitialLocale()`
   - Removed duplicate `type Locale` declaration

## Design Decisions
- Primary color: warm amber/orange `oklch(0.75 0.18 55)` as specified
- All color tokens use hue 55 for warmth
- Gradient on top bar for restaurant ambiance
- Bottom nav uses Framer Motion `layoutId` for smooth tab indicator animation
- CartSheet uses shadcn Sheet with RTL-aware `side` prop
- All layout uses CSS logical properties where applicable (ms-*, me-*, ps-*, pe-*, -start, -end)
- Safe area insets for mobile devices
