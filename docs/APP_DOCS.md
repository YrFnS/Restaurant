# RestaurantOS — Application Documentation

> **Saffron** is a full-stack restaurant management system built with Next.js 16, featuring bilingual (EN/AR) support, role-based access, and real-time kitchen operations.

---

## Table of Contents

1. [What Is RestaurantOS?](#what-is-restaurantos)
2. [Key Features](#key-features)
3. [User Roles & Access](#user-roles--access)
4. [Customer App](#customer-app)
5. [Admin Panel](#admin-panel)
6. [Kitchen Display System (KDS)](#kitchen-display-system-kds)
7. [POS Terminal](#pos-terminal)
8. [Internationalization](#internationalization)
9. [Configuration & Settings](#configuration--settings)
10. [Getting Started](#getting-started)

---

## What Is RestaurantOS?

RestaurantOS (internally branded "Saffron") is a modern, web-based restaurant management platform that replaces the need for separate ordering, kitchen display, POS, and admin tools. It runs entirely in the browser — no native apps needed — and works on phones, tablets, and desktops.

The system is designed for restaurants that need:
- A **customer-facing menu & ordering app** (mobile-first)
- A **kitchen display system** with multi-screen support
- A **POS terminal** for in-store order taking
- An **admin panel** for complete restaurant management

All data is stored in a local SQLite database and all settings are configurable from the admin panel — no hardcoded values.

---

## Key Features

### Customer App
- Browse menu with categories, search, dietary filters, and sorting
- Item customization with variants, add-ons, and special instructions
- Nutritional information and allergen warnings
- Cart with order type (dine-in, takeout, delivery), scheduling, promo codes, and tips
- Real-time order tracking with live polling (15s intervals)
- Reservation system with date/time picker and seating preferences
- Waitlist with position tracking and estimated wait times
- Rewards & loyalty program with gift cards
- AI menu assistant (LLM-powered recommendations)
- QR code menu sharing
- Favorites with heart toggle and filter tab
- Recent searches in menu
- Quick reorder from order history
- Newsletter subscription
- Customer phone-based account lookup

### Kitchen Display System
- Multi-screen support — each screen has its own unique URL (`/kitchen/[slug]`)
- Station filtering (Grill, Prep, Bar, or custom stations)
- Order tickets with elapsed timers and urgency color coding
- BUMP (mark ready), FIRE (release hold), BUMP ALL actions
- Sound alerts for new orders
- Auto-refresh (configurable interval per screen)
- Fullscreen mode
- Priority alerts for orders exceeding 15 minutes
- Layout options: Grid, List, Compact
- Show/hide completed orders
- Max orders display limit

### POS Terminal
- Split-screen: menu grid (left) + cart (right)
- Order types: Dine-In, Takeout, Delivery, Drive-Thru
- Category tabs and search
- Quick-add (tap) and modifier dialog (right-click/long press)
- Cart with quantity controls, modifiers, seat numbers, hold items
- Order summary with subtotal, tax, discount, tip, total
- Cash payment with change calculator
- Card payment with tip presets
- Table selection dialog for dine-in orders
- Floor plan view for table management
- Park orders for later

### Admin Panel
- **Menu Management** — CRUD items & categories, toggle availability, bulk edit
- **Inventory** — Ingredient cards with low stock alerts, CRUD, waste logging, purchase orders
- **Employees** — Table view with role badges, clock-in/out, CRUD
- **Schedule** — Weekly grid view with role color coding
- **Reports** — Revenue/orders/avg value stats, top selling items, Z-reports
- **Cash Drawer** — Balance display, transaction history, add entries
- **Reservations** — Table with status management
- **Notifications** — List with type icons, mark all read
- **KDS Screens** — Create/edit/delete kitchen display screens with unique URLs
- **Tables** — Manage restaurant tables with QR codes
- **Settings** — Full restaurant configuration (see below)

---

## User Roles & Access

| Role | Customer App | Kitchen | POS | Admin |
|------|:---:|:---:|:---:|:---:|
| **Admin** | ✅ | ✅ | ✅ | ✅ (all tabs) |
| **Manager** | ✅ | ✅ | ✅ | ✅ (all tabs) |
| **Staff** | ✅ | ✅ | ✅ | ❌ |
| **Customer** | ✅ | ❌ | ❌ | ❌ |

Authentication is via PIN-based login for staff. Customers access the app directly without login.

**Demo PINs (from seed data):**
- `1234` — Admin
- `5678` — Manager
- `9999` — Staff (Cook)

---

## Customer App

### Navigation
The customer app uses a single-page layout with tab navigation:

| Tab | Section | Description |
|-----|---------|-------------|
| 🏠 Home | `HomeSection` | Hero, specials, popular items, categories, testimonials, hours, recent orders |
| 🍽️ Menu | `MenuSection` | Category tabs, search, dietary filters, sort, favorites, item details |
| 🛒 Cart | `CartSection` | Order type, checkout, scheduling, promo codes, tips |
| 📋 Orders | `OrdersSection` | Real-time tracking, order history, reorder |
| 📅 More | Bottom sheet with: Reservations, Waitlist, Rewards, Contact |

### Desktop Layout
On desktop (md+ breakpoint), a sidebar replaces the top/bottom navigation, showing:
- Restaurant branding (logo, name, tagline)
- Grouped nav links (Main, Ordering, Services)
- Quick stats (cart count, favorites count)
- Language and theme toggles

### Mobile Layout
On mobile, the app uses:
- TopBar with logo, language toggle, dark mode, cart icon
- BottomNav with 5 tabs (Home, Menu, Cart, Orders, More)
- FloatingCartBar showing cart count + total
- AI Assistant floating button
- Back-to-top button

---

## Admin Panel

Access at `/admin`. Requires PIN login (admin or manager role).

### Tabs

| Tab | Description |
|-----|-------------|
| **Menu** | CRUD menu items & categories. Toggle availability, popularity. Search, bulk edit. |
| **Inventory** | Manage ingredients with stock levels, low thresholds, suppliers. Log waste. Purchase orders. |
| **Employees** | Add/edit employees with roles, wages, PINs. Clock in/out. |
| **Schedule** | Weekly schedule grid. Add shifts per employee per day. |
| **KDS Screens** | Create kitchen display screens. Each has a unique slug → URL. Configure station filter, layout, refresh interval, show completed, max orders. |
| **Tables** | Manage restaurant tables (number, capacity, section, shape). View QR codes. |
| **Reports** | Revenue, orders, avg order value. Top selling items. Z-reports. |
| **Cash** | Cash drawer balance, transaction history, add entries (pay in/out/drop). |
| **Reservations** | View/manage reservations. Update status (confirmed → seated → completed). |
| **Notifications** | System notifications list. Mark read. |
| **Settings** | Full restaurant configuration (see below). |

### Settings (Configurable from Admin)

| Category | Settings |
|----------|----------|
| **Branding** | Restaurant Name (EN/AR), Tagline (EN/AR), Description (EN/AR), Logo URL, Hero Image URL |
| **Contact** | Phone, Email, Address (EN/AR) |
| **Social Media** | Facebook URL, Instagram URL, Twitter URL |
| **Operating Hours** | Open Time, Close Time |
| **Financial** | Tax Rate, Currency Symbol, Tip Presets |
| **Delivery** | Delivery Fee, Min Delivery Order, Delivery Radius |
| **Kitchen** | Avg Prep Time |
| **Statistics** | Orders Served, Happy Customers, Years of Service |

> **Important:** There are NO hardcoded values. All display text comes from the database settings or i18n translations. Changing the restaurant name in admin immediately reflects across the entire app (sidebar, footer, page title, OG tags).

---

## Kitchen Display System (KDS)

### Access
- Main KDS: `/kitchen` — Shows a screen selector
- Specific screen: `/kitchen/[slug]` — Shows that screen's orders (e.g., `/kitchen/grill-station`)

### Creating KDS Screens
1. Go to Admin Panel → KDS Screens tab
2. Click "Add Screen"
3. Fill in:
   - **Name** — Display name (e.g., "Grill Station")
   - **Slug** — URL slug (auto-generated from name, e.g., "grill-station")
   - **Description** — Optional description
   - **Station Filter** — Which kitchen stations to show (empty = all)
   - **Layout Type** — Grid, List, or Compact
   - **Auto Refresh** — Seconds between refreshes (default: 10)
   - **Show Completed** — Whether to show completed orders
   - **Max Orders** — Maximum orders to display (0 = unlimited)
   - **Sort Order** — Display order among screens
   - **Active** — Toggle screen on/off
4. Save → The screen is immediately accessible at `/kitchen/[slug]`

### Using KDS
- Open the screen URL on a kitchen tablet/monitor
- Orders appear automatically as they come in
- Use BUMP to mark items ready, FIRE to release holds
- Sound alerts play for new orders
- Click fullscreen button for dedicated display mode

---

## POS Terminal

Access at `/pos`. Requires PIN login (admin, manager, or staff role).

### Layout
- **Left panel**: Menu grid with category tabs, search, and item cards
- **Right panel**: Cart with order summary, payment controls

### Order Flow
1. Select order type (Dine-In, Takeout, Delivery, Drive-Thru)
2. Tap items to add to cart (quick-add)
3. Long-press/right-click for modifier dialog (variants, addons, notes, seat number, hold)
4. Apply discount and tip
5. Click Pay → Choose Cash or Card
6. Process payment → Print/Email receipt

### Table Management
- Click table icon to select a table for dine-in orders
- Floor plan view shows table status (available, occupied, reserved, cleaning)

---

## Internationalization

The app supports **English** and **Arabic** with full RTL/LTR layout switching.

### How It Works
- Language is toggled via buttons in the sidebar (desktop) or top bar (mobile)
- All display text uses translation keys from `src/lib/i18n/locales/en.json` and `ar.json`
- Layout direction switches automatically (`dir="rtl"` for Arabic)
- CSS uses logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) for RTL compatibility
- Menu items, categories, and modifiers have both `nameEn` and `nameAr` fields
- The locale preference persists in the Zustand store

### Translation Keys Structure
```
t.app.name / t.app.tagline     — App-level branding
t.nav.*                         — Navigation labels
t.home.*                        — Home section
t.menu.*                        — Menu section
t.cart.*                        — Cart section
t.orders.*                      — Orders section
t.reservations.*                — Reservations section
t.waitlist.*                    — Waitlist section
t.rewards.*                     — Rewards section
t.contact.*                     — Contact section
t.kitchen.*                     — Kitchen display
t.pos.*                         — POS terminal
t.admin.*                       — Admin panel
t.staff.*                       — Staff area
t.common.*                      — Shared labels (loading, error, cancel, etc.)
t.notifications.*               — Toast notification text
t.footer.*                      — Footer text
t.ai.*                          — AI assistant
```

---

## Configuration & Settings

### All Settings Are Database-Driven
Every configurable value is stored in the `RestaurantSettings` table and editable from the admin panel. There are no hardcoded fallback values — if a setting is not configured, the app shows empty/blank rather than fake data.

### Seed Data
When you first set up the app, running the seed endpoint (`GET /api/seed`) populates the database with:
- 10 menu categories, 36 menu items, modifiers
- 4 employees (admin, manager, cook, waiter)
- 20 restaurant tables
- 3 special offers
- 8 ingredients
- Sample orders, reservations, waitlist entries
- Kitchen stations and screens

> **Note:** Seed data is template data for demo purposes. In production, you would configure all values from the admin panel.

---

## Getting Started

### Prerequisites
- Node.js 18+ or Bun runtime
- SQLite (included via Prisma)

### Installation
```bash
# Install dependencies
bun install

# Set up database
bun run db:push

# Seed with demo data (optional)
# Visit http://localhost:3000/api/seed after starting the server

# Start development server
bun run dev
```

### Accessing the App

| Page | URL | Auth Required |
|------|-----|:---:|
| Customer App | `/` | No |
| Admin Panel | `/admin` | PIN (admin/manager) |
| Kitchen Display | `/kitchen` | PIN (admin/manager/staff) |
| Specific KDS Screen | `/kitchen/[slug]` | PIN (admin/manager/staff) |
| POS Terminal | `/pos` | PIN (admin/manager/staff) |

### Demo Accounts
| Role | PIN | Access |
|------|-----|--------|
| Admin | `1234` | All areas |
| Manager | `5678` | Kitchen, POS, Admin |
| Staff | `9999` | Kitchen, POS only |
