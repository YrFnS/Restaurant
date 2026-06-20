# Restaurant — Restaurant Management Platform

A full-featured bilingual (EN/AR) restaurant management platform built with Next.js, Tailwind CSS, shadcn/ui, and Prisma. Restaurant name and all branding are fully configurable from the admin panel — no hardcoded values.

## Features

- **Menu Management** — Categories, items, modifier groups, combo meals, dynamic pricing
- **Order Management** — Dine-in, takeout, delivery with full lifecycle tracking
- **Kitchen Display System (KDS)** — Multiple stations, prep/expo screens, unique URLs per screen
- **Floor Management** — Table layout, seating, server assignment
- **Reservations & Waitlist** — Booking flow with table assignment
- **Customer & Loyalty** — Profiles, points, reward tiers, gift cards
- **Inventory & Waste Tracking** — Ingredients, low-stock alerts, purchase orders
- **Staff Management** — Roles, schedules, clock in/out, PIN-based auth
- **Cash Drawer** — Pay-in/payout/drop tracking
- **Analytics & Feedback** — Ratings, testimonials, newsletter subscriptions

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Framework      | Next.js 16 (App Router, RSC)            |
| Language       | TypeScript                              |
| UI             | Tailwind CSS 4, shadcn/ui, Radix UI     |
| State          | Zustand, TanStack Query                 |
| Database       | PostgreSQL (Neon) via Prisma ORM        |
| Branding       | Fully admin-configurable (no hardcoded) |
| Auth           | NextAuth.js                             |
| Real-time      | Socket.IO                               |
| Forms          | React Hook Form + Zod                  |
| Charts         | Recharts                                |
| Rich Text      | MDXEditor                               |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- PostgreSQL database (Neon recommended)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and other secrets

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# (Optional) Seed the database
bun run db:seed
```

### Environment Variables

| Variable         | Description                    |
| ---------------- | ------------------------------ |
| `DATABASE_URL`   | PostgreSQL connection string   |
| `NEXTAUTH_SECRET`| NextAuth.js secret             |
| `NEXTAUTH_URL`   | App URL (e.g. `http://localhost:3000`) |

### Development

```bash
bun run dev      # Start dev server on port 3000
bun run build    # Production build (standalone output)
bun run start    # Start production server
bun run lint     # ESLint
```

## Database Schema

The Prisma schema (`prisma/schema.prisma`) covers:

- **Restaurant Settings** — Singleton config (branding, tax, delivery, KDS thresholds)
- **Menu** — Categories → Items → Modifier Groups → Modifier Options
- **Orders** → Order Items with modifiers, courses, station routing
- **Tables** — Floor plan with position, shape, section
- **Customers** — Profiles with loyalty points
- **Reservations & Waitlist** — Booking and queue management
- **Staff** — Employees with roles, schedules, clock in/out
- **Inventory** — Ingredients, waste logs, purchase orders
- **KDS** — Kitchen stations and configurable screens
- **Promotions** — Special offers, promo codes, dynamic pricing
- **Feedback** — Customer ratings, testimonials, newsletter

## License

Proprietary
