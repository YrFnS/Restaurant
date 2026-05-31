# Saffron Restaurant — Full-Stack Restaurant Management Platform

A comprehensive restaurant management platform built with Next.js, featuring customer-facing ordering, admin panel, POS terminal, kitchen display system, and reservation management.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** PostgreSQL (Neon) via Prisma ORM
- **Styling:** Tailwind CSS 4 + shadcn/ui components
- **State Management:** Zustand (with persistence)
- **Animations:** Framer Motion
- **Authentication:** Cookie-based staff sessions with PIN hashing
- **Internationalization:** Custom i18n system (English + Arabic, RTL support)
- **Notifications:** Sonner (toast notifications)
- **Data Tables:** TanStack Table + React Query

## Features

- **Customer Ordering** — Browse menu by category, add to cart, checkout with dine-in/takeout/delivery
- **Admin Panel** — Manage menu items, categories, orders, staff, inventory, schedules, cash drawer
- **POS Terminal** — Table floor plan, order management, payment processing
- **Kitchen Display** — Real-time order tracking by station (Grill, Prep, Bar)
- **Reservations** — Table booking with time slots, party size, occasion tracking
- **Waitlist** — Queue management with estimated wait times
- **Rewards & Loyalty** — Points-based reward tiers, promo codes
- **Bilingual** — Full English/Arabic support with RTL layout

## Quick Start

### Prerequisites

- Node.js 20+ or Bun
- A Neon PostgreSQL database

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### Installation & Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed the database with sample data
npx prisma db seed

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Database Seed

The seed script populates the database with:
- 10 menu categories (Appetizers, Soups, Grills, Seafood, Pasta, Pizza, Salads, Desserts, Beverages, Sides)
- 37 menu items with modifiers
- 20 restaurant tables with floor plan positions
- 3 special offers
- Sample orders, reservations, waitlist entries
- Kitchen stations and display screens
- Testimonials, promo codes, and reward tiers

To re-seed, use the API endpoint (requires admin auth):
`POST /api/seed`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # REST API endpoints
│   ├── pos/                # POS terminal page
│   ├── kitchen/            # Kitchen display pages
│   └── providers.tsx       # Theme & i18n providers
├── components/
│   ├── admin/              # Admin panel (settings, menu, orders, staff)
│   ├── restaurant/         # Customer-facing sections (menu, cart, home)
│   ├── pos/                # POS terminal components
│   ├── kitchen/            # Kitchen display components
│   ├── layout/             # App shell, sidebar, navigation
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, store, auth, database
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Database seed script
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma db seed` | Seed database with sample data |

## License

Private — ZOO Company
