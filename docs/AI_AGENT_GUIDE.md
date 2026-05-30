# RestaurantOS — AI Agent Developer Guide

> This document is for **AI agents and developers** who will work on this codebase in the future. It covers architecture, conventions, common patterns, and gotchas.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database & Prisma](#database--prisma)
5. [API Routes](#api-routes)
6. [Component Architecture](#component-architecture)
7. [State Management](#state-management)
8. [Internationalization (i18n)](#internationalization-i18n)
9. [Authentication & Security](#authentication--security)
10. [Styling Conventions](#styling-conventions)
11. [Common Patterns](#common-patterns)
12. [Gotchas & Pitfalls](#gotchas--pitfalls)
13. [Adding New Features](#adding-new-features)
14. [Testing & QA](#testing--qa)
15. [Worklog & Context Recovery](#worklog--context-recovery)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 (Turbopack)                │
│                    Port 3000                             │
├──────────┬──────────┬──────────────┬────────────────────┤
│ Customer │  Admin   │   Kitchen    │       POS          │
│    /     │  /admin  │  /kitchen    │      /pos          │
│          │          │  /kitchen/*  │                    │
├──────────┴──────────┴──────────────┴────────────────────┤
│                    API Routes (/api/*)                   │
├─────────────────────────────────────────────────────────┤
│              Middleware (auth, rate-limit, sanitize)     │
├─────────────────────────────────────────────────────────┤
│              Prisma ORM → SQLite (db/custom.db)         │
└─────────────────────────────────────────────────────────┘
```

The app is a **monolithic Next.js application** with four distinct UI zones sharing a single codebase and database. There are no separate microservices.

**Key principle:** Everything runs through Next.js. The customer app, admin, kitchen, and POS are all React components rendered by Next.js, communicating via API routes to the same SQLite database.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 16.1.3 (App Router) | Turbopack for dev, file-based routing |
| **Language** | TypeScript 5 | Strict mode |
| **Styling** | Tailwind CSS 4 + shadcn/ui | New York style, logical properties for RTL |
| **Database** | SQLite via Prisma ORM | Single file: `db/custom.db` |
| **State** | Zustand (client), React Query (server) | Store in `src/lib/store.ts` |
| **Auth** | Cookie-based PIN auth | Custom middleware, SHA-256 hashed PINs |
| **i18n** | Custom React context | `src/lib/i18n/index.tsx`, EN + AR locales |
| **Animations** | Framer Motion | Page transitions, hover effects |
| **Icons** | Lucide React | Consistent icon set |
| **Charts** | Recharts | Admin reports |
| **QR Codes** | qrcode.react | Table QR codes, menu sharing |
| **AI** | z-ai-web-dev-sdk | Menu assistant (backend only!) |
| **Toasts** | Sonner | i18n-aware via `use-notifications.ts` hook |
| **Forms** | React Hook Form + Zod | Available but not used everywhere yet |
| **Drag & Drop** | @dnd-kit | Table floor plan |
| **Runtime** | Bun | Package manager and dev server |

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (metadata, fonts)
│   ├── page.tsx                  # Customer app (renders AppShell)
│   ├── providers.tsx             # Client providers (Zustand, Theme, Sonner)
│   ├── globals.css               # Global styles + animations
│   ├── not-found.tsx             # 404 page (i18n-aware)
│   ├── loading.tsx               # Loading skeleton
│   ├── error.tsx                 # Error boundary
│   │
│   ├── admin/                    # Admin panel route
│   │   ├── layout.tsx            # Admin layout (StaffLogin wrapper)
│   │   ├── page.tsx              # AdminPanel component
│   │   └── error.tsx
│   │
│   ├── kitchen/                  # Kitchen Display route
│   │   ├── layout.tsx            # Kitchen layout (StaffLogin wrapper)
│   │   ├── page.tsx              # KDS screen selector
│   │   ├── [slug]/page.tsx       # Specific KDS screen by slug
│   │   └── error.tsx
│   │
│   ├── pos/                      # POS Terminal route
│   │   ├── layout.tsx            # POS layout (StaffLogin wrapper)
│   │   └── page.tsx              # POSTerminal component
│   │
│   └── api/                      # API routes (30+ endpoints)
│       ├── auth/route.ts         # PIN verification
│       ├── settings/route.ts     # Restaurant settings CRUD
│       ├── menu/                 # Menu items & categories
│       ├── orders/               # Orders & order items
│       ├── reservations/         # Reservations
│       ├── customers/            # Customer accounts
│       ├── employees/            # Staff management
│       ├── kitchen-screens/      # KDS screen CRUD
│       ├── ...                   # (see API Routes section)
│       └── seed/route.ts         # Database seed
│
├── components/
│   ├── admin/                    # Admin panel components
│   │   ├── AdminPanel.tsx        # Main admin panel (~1500 lines)
│   │   └── ImageUploadButton.tsx # Image upload widget
│   │
│   ├── kitchen/                  # Kitchen display components
│   │   ├── KitchenDisplay.tsx    # Full KDS with order tickets
│   │   ├── KitchenDashboard.tsx  # KDS overview/dashboard
│   │   ├── KitchenScreenSelector.tsx  # Screen picker
│   │   └── StationDisplay.tsx    # Per-station view
│   │
│   ├── layout/                   # App shell & navigation
│   │   ├── AppShell.tsx          # Main layout wrapper
│   │   ├── TopBar.tsx            # Mobile top bar
│   │   ├── DesktopSidebar.tsx    # Desktop sidebar navigation
│   │   ├── BottomNav.tsx         # Mobile bottom navigation
│   │   ├── Footer.tsx            # Sticky footer
│   │   ├── CartSheet.tsx         # Sliding cart drawer
│   │   ├── FloatingCartBar.tsx   # Mobile cart summary bar
│   │   ├── AIAssistantButton.tsx # AI chat FAB
│   │   └── BackToTopButton.tsx   # Scroll-to-top FAB
│   │
│   ├── pos/                      # POS terminal components
│   │   ├── POSTerminal.tsx       # Main POS interface
│   │   └── TableFloorPlan.tsx    # Table layout view
│   │
│   ├── restaurant/               # Customer-facing sections
│   │   ├── HomeSection.tsx       # Home page content
│   │   ├── MenuSection.tsx       # Menu browser
│   │   ├── CartSection.tsx       # Checkout flow
│   │   ├── OrdersSection.tsx     # Order tracking
│   │   ├── ReservationsSection.tsx  # Table reservations
│   │   ├── WaitlistSection.tsx   # Waitlist management
│   │   ├── RewardsSection.tsx    # Loyalty & gift cards
│   │   ├── ContactSection.tsx    # Contact & feedback
│   │   ├── QRCodeMenu.tsx        # QR code display
│   │   ├── NutritionalInfo.tsx   # Nutrition display
│   │   ├── NutritionalInfoModal.tsx  # Nutrition detail modal
│   │   ├── CustomerPhoneInput.tsx    # Phone input component
│   │   └── CustomerProfileSheet.tsx  # Customer profile drawer
│   │
│   ├── staff/                    # Staff authentication
│   │   ├── StaffLogin.tsx        # PIN login screen
│   │   ├── StaffNavBar.tsx       # Staff navigation bar
│   │   ├── LanguageToggle.tsx    # Language switcher
│   │   └── ThemeToggle.tsx       # Dark/light mode toggle
│   │
│   ├── shared/                   # Shared utility components
│   │   └── ImageUploadButton.tsx # Reusable image upload
│   │
│   └── ui/                       # shadcn/ui primitives (38 components)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── sheet.tsx
│       ├── sonner.tsx            # Toast (Sonner, not shadcn toast)
│       └── ...
│
├── hooks/                        # Custom React hooks
│   ├── use-toast.ts              # Legacy toast (not used, Sonner instead)
│   ├── use-mobile.ts             # Mobile viewport detection
│   └── use-notifications.ts      # i18n-aware toast notifications
│
├── lib/                          # Utilities & core libraries
│   ├── db.ts                     # Prisma client singleton
│   ├── store.ts                  # Zustand store (cart, nav, settings, etc.)
│   ├── utils.ts                  # cn() helper and utilities
│   ├── auth.ts                   # Session encode/decode
│   ├── cookies.ts                # Client-side cookie helpers
│   ├── pin-hash.ts               # SHA-256 PIN hashing
│   ├── rate-limit.ts             # Rate limiting (auth: 5/min, orders: 10/min)
│   ├── sanitize.ts               # XSS input sanitization
│   ├── proxy.ts                  # Proxy helpers
│   └── i18n/
│       ├── index.tsx             # I18nProvider, useI18n hook
│       └── locales/
│           ├── en.json           # English translations (~500 keys)
│           └── ar.json           # Arabic translations (~500 keys)
│
└── middleware.ts                  # Next.js middleware (auth, RBAC, rate-limit)
```

---

## Database & Prisma

### Schema Overview

The app uses **22 Prisma models**:

| Model | Purpose |
|-------|---------|
| `RestaurantSettings` | All configurable settings (singleton, id="1") |
| `MenuCategory` | Menu categories with EN/AR names |
| `MenuItem` | Menu items with EN/AR names, prices, dietary info |
| `Modifier` | Item variants and add-ons |
| `Customer` | Customer accounts with loyalty points |
| `Order` | Orders with status, totals, payment info |
| `OrderItem` | Individual items in an order |
| `RestaurantTable` | Tables with capacity, section, shape |
| `Reservation` | Table reservations |
| `WaitlistEntry` | Waitlist entries |
| `GiftCard` | Gift card codes with balance tracking |
| `SpecialOffer` | Promotional offers |
| `Feedback` | Customer feedback submissions |
| `Employee` | Staff accounts with hashed PINs |
| `Ingredient` | Inventory items with stock levels |
| `WasteLog` | Waste tracking |
| `PurchaseOrder` | Purchase orders for inventory |
| `CashDrawerEntry` | Cash register transactions |
| `Notification` | System notifications |
| `Schedule` | Employee work schedules |
| `KitchenStation` | Kitchen stations (Grill, Prep, Bar, etc.) |
| `KitchenScreen` | KDS display screens with unique slugs |
| `Testimonial` | Customer testimonials |
| `PromoCode` | Promo/discount codes |
| `RewardTier` | Loyalty reward tiers |
| `NewsletterSubscription` | Email newsletter signups |
| `ComboMeal` | Combo meal deals |
| `DynamicPricing` | Time-based pricing rules |

### Database Commands
```bash
bun run db:push    # Push schema changes to SQLite (no migration files)
bun run db:studio  # Open Prisma Studio (database GUI)
```

### Important Notes
- The database uses `db:push` (no migration history) — schema changes are applied directly
- `RestaurantSettings` is a **singleton** — always id="1"
- PINs are stored as **SHA-256 hashes**, never plain text
- The DB client is imported as `import { db } from '@/lib/db'`
- Default values in schema are **Prisma-level defaults**, not hardcoded app values

---

## API Routes

### Route Map

| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST /api/auth` — Verify PIN |
| **Settings** | `GET /api/settings`, `PUT /api/settings` |
| **Menu** | `GET /api/menu`, `GET/PUT/DELETE /api/menu/[id]` |
| **Orders** | `GET/POST /api/orders`, `GET/PUT /api/orders/[id]`, `PATCH /api/orders/items/[id]` |
| **Reservations** | `GET/POST /api/reservations`, `GET/PUT/DELETE /api/reservations/[id]` |
| **Customers** | `GET/POST /api/customers`, `GET/PUT /api/customers/[id]` |
| **Employees** | `GET/POST /api/employees`, `GET/PUT/DELETE /api/employees/[id]`, `POST /api/employees/clock` |
| **Inventory** | `GET/POST /api/inventory`, `GET/PUT/DELETE /api/inventory/[id]`, `POST /api/inventory/waste`, `GET/POST /api/inventory/purchase-orders` |
| **Schedules** | `GET/POST /api/schedules`, `GET/PUT/DELETE /api/schedules/[id]` |
| **Kitchen** | `GET /api/kitchen`, `GET/POST /api/kitchen-screens`, `GET/PUT/DELETE /api/kitchen-screens/[id]`, `GET /api/stations` |
| **Tables** | `GET/POST /api/tables`, `GET/PUT /api/tables/[id]` |
| **Cash** | `GET/POST /api/cash` |
| **Notifications** | `GET/PUT /api/notifications`, `POST /api/notifications` |
| **Reports** | `GET /api/reports` |
| **Feedback** | `GET/POST /api/feedback` |
| **Testimonials** | `GET/POST /api/testimonials` |
| **Offers** | `GET/POST /api/offers` |
| **Gift Cards** | `GET/POST /api/gift-cards` |
| **Promo** | `POST /api/promo` — Validate promo code |
| **Promo Codes** | `GET/POST /api/promo-codes` |
| **Waitlist** | `GET/POST /api/waitlist`, `GET/PUT/DELETE /api/waitlist/[id]` |
| **Newsletter** | `POST /api/newsletter` |
| **Reward Tiers** | `GET/POST /api/reward-tiers` |
| **AI** | `POST /api/ai-recommend` — LLM-powered menu recommendations |
| **Seed** | `GET /api/seed` — Populate database with demo data |

### API Conventions
- All responses use `{ data }` or `{ error }` format
- Protected routes require a valid `session` cookie with role-based access
- Input validation is done in the route handler (not middleware)
- Rate limiting is applied by middleware (auth: 5/min, orders: 10/min)
- XSS sanitization is applied by middleware to all request bodies

---

## Component Architecture

### Client vs Server Components

| Type | Where | Marking |
|------|-------|---------|
| **Server Components** | `layout.tsx`, API routes | No directive needed (default) |
| **Client Components** | All UI components | `'use client'` at top of file |

> **Important:** Nearly all UI components are client components because they use hooks (useState, useEffect, useI18n, etc.). Only `layout.tsx` and API routes are server components.

### Component Hierarchy

```
RootLayout (server)
└── Providers (client) — Zustand, Theme, Sonner
    ├── Customer App
    │   └── AppShell
    │       ├── DesktopSidebar
    │       ├── TopBar + BottomNav (mobile)
    │       ├── [Active Section Component]
    │       │   ├── HomeSection
    │       │   ├── MenuSection
    │       │   ├── CartSection
    │       │   ├── OrdersSection
    │       │   ├── ReservationsSection
    │       │   ├── WaitlistSection
    │       │   ├── RewardsSection
    │       │   └── ContactSection
    │       ├── CartSheet
    │       ├── FloatingCartBar
    │       ├── AIAssistantButton
    │       └── Footer
    │
    ├── Admin Panel
    │   └── StaffLogin → AdminPanel (tab-based SPA)
    │
    ├── Kitchen Display
    │   └── StaffLogin → KitchenDisplay / KitchenDashboard
    │
    └── POS Terminal
        └── StaffLogin → POSTerminal
```

---

## State Management

### Zustand Store (`src/lib/store.ts`)

The store manages all client-side state:

```typescript
interface RestaurantStore {
  // Navigation
  activeSection: string;          // Current customer section
  setActiveSection: (s: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // Settings (fetched from API)
  settings: RestaurantSettings | null;
  settingsLoaded: boolean;
  fetchSettings: () => Promise<void>;

  // Customer
  customerPhone: string;
  customerName: string;
  setCustomerPhone: (p: string) => void;
  setCustomerName: (n: string) => void;

  // Staff
  staffSession: StaffSession | null;
  setStaffSession: (s: StaffSession | null) => void;
}
```

### React Query
Used sparingly for server-state fetching in some sections. Most components use `useEffect` + `fetch` + `useState` pattern instead.

### Local Storage
- `favorites` — Persisted via Zustand middleware
- `customerPhone` / `customerName` — Persisted via Zustand middleware
- `recentMenuSearches` — Managed manually in MenuSection
- Staff session — Managed via cookies (not localStorage)

---

## Internationalization (i18n)

### Architecture
The i18n system is **custom-built** (not using next-intl for routing):

```typescript
// src/lib/i18n/index.tsx
interface I18nContextValue {
  locale: 'en' | 'ar';
  isRTL: boolean;
  t: Translations;    // Full translation object
  setLocale: (l: 'en' | 'ar') => void;
}

// Usage in components
const { t, locale, isRTL } = useI18n();
```

### Adding a New Translation Key

1. Add the key to `src/lib/i18n/locales/en.json`
2. Add the same key to `src/lib/i18n/locales/ar.json`
3. Use it in the component: `t.section.keyName`

### RTL Conventions

| Don't | Do |
|-------|-----|
| `ml-2`, `mr-2` | `ms-2`, `me-2` (margin-start, margin-end) |
| `pl-4`, `pr-4` | `ps-4`, `pe-4` (padding-start, padding-end) |
| `left-0`, `right-0` | `start-0`, `end-0` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `border-l`, `border-r` | `border-s`, `border-e` |
| `space-x-2` | `gap-2` |

### Locale-Aware Name Display
All entities have both `nameEn` and `nameAr` fields. Display the correct one:

```typescript
const itemName = (item: { nameEn: string; nameAr: string }) =>
  locale === 'ar' && item.nameAr ? item.nameAr : item.nameEn;
```

---

## Authentication & Security

### PIN-Based Staff Auth Flow

1. Staff enters 4-digit PIN on `StaffLogin` component
2. `POST /api/auth` — PIN is hashed (SHA-256) and compared to stored hash
3. On success, session is encoded as base64 JSON and set as `session` cookie
4. Middleware validates the cookie on every protected route
5. Role-based access control (RBAC) is enforced by middleware

### Session Cookie Format
```json
{
  "id": "employee_id",
  "name": "Employee Name",
  "role": "admin | manager | staff"
}
```

### Middleware Protection (`src/middleware.ts`)
The middleware handles:
- **Authentication** — Checks `session` cookie on protected routes
- **RBAC** — Admin-only routes (seed, employee management, settings)
- **Rate Limiting** — 5 req/min for auth, 10 req/min for orders
- **XSS Sanitization** — Strips dangerous HTML from request bodies
- **Input Size Limits** — Rejects oversized payloads

### Protected Route Rules

| Route Pattern | Required Role |
|---------------|--------------|
| `/admin`, `/admin/*` | admin, manager |
| `/kitchen`, `/kitchen/*` | admin, manager, staff |
| `/pos`, `/pos/*` | admin, manager, staff |
| `/api/seed` | admin |
| `/api/employees/*` | admin, manager |
| `/api/settings` (PUT) | admin, manager |
| `/api/inventory/*` | admin, manager |
| `/api/schedules/*` | admin, manager |
| `/api/cash` | admin, manager |
| `/api/kitchen-screens/*` | admin, manager |

---

## Styling Conventions

### Design System
- **Theme**: Warm amber/orange restaurant branding
- **Dark mode**: Supported via `next-themes`
- **Components**: shadcn/ui (New York style)
- **Icons**: Lucide React

### CSS Rules
1. **Always use Tailwind utility classes** — no inline styles or custom CSS unless necessary
2. **Use logical CSS properties** for RTL support (see RTL Conventions above)
3. **Custom animations** go in `src/app/globals.css` under `@keyframes`
4. **Color system** — Use CSS variables (`bg-primary`, `text-primary-foreground`, `bg-background`)
5. **No indigo or blue colors** unless explicitly requested
6. **Responsive design** — Mobile-first with `sm:`, `md:`, `lg:`, `xl:` prefixes
7. **Touch targets** — Minimum 44px for interactive elements

### Layout Rules
- Footer must be **sticky to bottom** — use `min-h-screen flex flex-col` + `mt-auto` on footer
- Max height scrollable lists — `max-h-96 overflow-y-auto`
- Card padding — `p-4` or `p-6` consistently
- Card spacing — `gap-4` or `gap-6` consistently

### shadcn/ui Component Usage
- **Select.Item** — Never use empty string as value. Use `|| undefined` pattern:
  ```tsx
  <Select value={form.categoryId || undefined}>
  ```
- **Sonner** for toasts — Do NOT use `@/components/ui/toast` or `@/components/ui/toaster`
- **Sheet** for sliding drawers — Used for cart, menu item details, AI assistant
- **Dialog** for modal dialogs — Used in admin forms, POS payment

---

## Common Patterns

### Fetching Data in Components
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    try {
      const res = await fetch('/api/endpoint');
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      setData(result.items);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

### Using Notifications (i18n-aware Toasts)
```typescript
import { useNotifications } from '@/hooks/use-notifications';

const { cartAdded, promoApplied, error } = useNotifications();

// Usage
cartAdded('Hummus');           // "Added to cart" toast with item name
promoApplied('SAVE20', 20);   // "Promo code applied! 20% discount"
error('Something went wrong'); // Error toast
```

### Using Settings in Components
```typescript
import { useRestaurantStore } from '@/lib/store';

const { settings } = useRestaurantStore();

// Settings are auto-fetched on app load
const name = locale === 'ar' ? settings?.nameAr : settings?.nameEn;
const currency = settings?.currencySymbol || '$';
const taxRate = settings?.taxRate || 0;
```

### Staff Login Guard
```typescript
// In staff page layout
if (!staffSession) {
  return <StaffLogin onLogin={(session) => setStaffSession(session)} />;
}
```

---

## Gotchas & Pitfalls

### 1. No Hardcoded Values
**NEVER** hardcode restaurant names, contact info, or settings values. Everything must come from:
- Database settings (`/api/settings`)
- i18n translations (`t.section.key`)
- Entity fields (e.g., `item.nameEn` / `item.nameAr`)

If a setting is not available, show empty/blank — never show fake fallback data.

### 2. z-ai-web-dev-sdk is Backend-Only
The `z-ai-web-dev-sdk` package must **only** be used in API routes (server-side). Never import it in client components. The AI menu assistant calls `/api/ai-recommend` which uses the SDK on the server.

### 3. Radix UI Select Value
`<Select value="">` will crash. Always use `<Select value={value || undefined}>` to convert empty strings to `undefined`.

### 4. Cookie-Based Auth (Not localStorage)
Staff sessions are stored in cookies (not localStorage). The middleware reads `req.cookies.get('session')`. Client components read via `document.cookie` helpers in `src/lib/cookies.ts`.

### 5. API Route Port Forwarding
The app uses Caddy as a reverse proxy on port 81. When calling APIs from the frontend, always use **relative paths** (`/api/...`). Never use `http://localhost:3000/api/...`.

If you need to call a mini-service on a different port, use the `XTransformPort` query parameter:
```
/api/test?XTransformPort=3030
```

### 6. WebSocket Connections
If using Socket.IO, the frontend must connect as:
```typescript
io("/?XTransformPort=3030")
```
Never use `io("http://localhost:3030")`.

### 7. Prisma Client Import
Always import the database client as:
```typescript
import { db } from '@/lib/db';
```
This is a singleton that prevents multiple Prisma Client instances in development.

### 8. Image Paths
Menu images are stored in `/public/images/menu/` directory. The `MenuItem.image` field stores paths like `/images/menu/appetizers.jpg`. Admin can change these via URL input.

### 9. Don't Run `bun run build`
The project runs in development mode only. Never run `bun run build` — it's not needed and may fail.

### 10. Dev Server Port
The Next.js dev server must run on **port 3000**. No other port.

---

## Adding New Features

### Adding a New Menu Item Field
1. Add the field to `prisma/schema.prisma` → `MenuItem` model
2. Run `bun run db:push`
3. Update `/api/menu` route to include the new field in responses
4. Update the admin panel form (`AdminPanel.tsx`) to edit the field
5. Update the customer-facing display (`MenuSection.tsx`, `HomeSection.tsx`)
6. Add i18n keys for any new labels
7. Update the seed script (`/api/seed/route.ts`)

### Adding a New Admin Tab
1. Add the tab to the `AdminTab` type in `AdminPanel.tsx`
2. Add a sidebar item to the `SIDEBAR_ITEMS` array
3. Create a `renderNewTab()` function
4. Add it to the render map: `{ id: 'new-tab', label: t.admin.newTab, icon: <Icon /> }`
5. Add translation keys to `en.json` and `ar.json`

### Adding a New API Route
1. Create the route file at `src/app/api/[resource]/route.ts`
2. Implement `GET`, `POST`, `PUT`, `DELETE` as needed
3. Add input validation (check required fields, sanitize)
4. The middleware will automatically handle auth/rate-limit/sanitize for protected routes
5. If the route needs protection, ensure the path matches middleware rules

### Adding a New Customer Section
1. Create the component at `src/components/restaurant/NewSection.tsx`
2. Add it to `AppShell.tsx` with a section ID
3. Add navigation entry in `BottomNav.tsx` and `DesktopSidebar.tsx`
4. Add i18n keys for all text content
5. Update the Zustand store if new state is needed

### Adding a New KDS Screen Feature
1. Update the `KitchenScreen` model in `prisma/schema.prisma` if new config fields needed
2. Run `bun run db:push`
3. Update `/api/kitchen-screens` to handle new fields
4. Update `AdminPanel.tsx` KDS form
5. Update `KitchenDisplay.tsx` to use new config values

---

## Testing & QA

### Lint
```bash
bun run lint
```
Always run lint after making changes. It catches TypeScript errors, unused imports, and Next.js rule violations.

### Browser Testing with agent-browser
```bash
agent-browser --help           # View all commands
agent-browser navigate <url>   # Navigate to a page
agent-browser screenshot        # Take a screenshot
agent-browser click <selector>  # Click an element
```

### Manual Testing Checklist
1. Customer app loads and shows real data from DB
2. Language toggle works (EN ↔ AR) with RTL layout
3. Dark mode toggle works
4. Admin settings save persists and reflects on customer app
5. KDS screens are accessible via unique URLs
6. POS terminal can create orders
7. All API routes return proper responses

---

## Worklog & Context Recovery

### Reading the Worklog
The file `/home/z/my-project/worklog.md` contains the complete development history. Each entry follows this format:

```markdown
---
Task ID: <task-id>
Agent: <agent-name>
Task: <description>

Work Log:
- <step 1>
- <step 2>

Stage Summary:
- <key results>
```

### When Starting a New Session
1. Read `/home/z/my-project/worklog.md` to understand what was done before
2. Read this file (`docs/AI_AGENT_GUIDE.md`) for architecture and conventions
3. Read `docs/APP_DOCS.md` for feature documentation
4. Check `prisma/schema.prisma` for the current data model
5. Run `bun run dev` to start the development server

### When Finishing a Session
1. Run `bun run lint` to verify no errors
2. Append your work log to `/home/z/my-project/worklog.md`
3. Update this guide if you've added new patterns or conventions
4. Update `docs/APP_DOCS.md` if you've added new user-facing features

---

## Quick Reference

| What | Where |
|------|-------|
| Database client | `src/lib/db.ts` |
| Zustand store | `src/lib/store.ts` |
| i18n translations | `src/lib/i18n/locales/en.json`, `ar.json` |
| i18n provider | `src/lib/i18n/index.tsx` |
| Auth middleware | `src/middleware.ts` |
| PIN hashing | `src/lib/pin-hash.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| XSS sanitization | `src/lib/sanitize.ts` |
| Session encode/decode | `src/lib/auth.ts` |
| Cookie helpers | `src/lib/cookies.ts` |
| Toast notifications | `src/hooks/use-notifications.ts` |
| Global CSS | `src/app/globals.css` |
| App layout | `src/components/layout/AppShell.tsx` |
| Admin panel | `src/components/admin/AdminPanel.tsx` |
| Kitchen display | `src/components/kitchen/KitchenDisplay.tsx` |
| POS terminal | `src/components/pos/POSTerminal.tsx` |
| Prisma schema | `prisma/schema.prisma` |
| Seed data | `src/app/api/seed/route.ts` |
| Dev server log | `/home/z/my-project/dev.log` |
| Work log | `/home/z/my-project/worklog.md` |
