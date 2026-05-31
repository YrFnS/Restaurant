# Refactor Plan — God Files

## God Files (>200 lines)

| File | Lines | Priority | Status |
|------|-------|----------|--------|
| `src/components/admin/AdminPanel.tsx` | 3374 | 🔴 P1 | Plan below |
| `src/components/restaurant/HomeSection.tsx` | 1472 | 🟡 P2 | Plan below |
| `src/components/restaurant/MenuSection.tsx` | 1386 | 🟡 P2 | Plan below |
| `src/components/restaurant/CartSection.tsx` | 1239 | 🟡 P2 | Plan below |
| `src/components/restaurant/OrdersSection.tsx` | 1097 | 🟢 P3 | Plan below |
| `src/components/kitchen/KitchenDashboard.tsx` | 1041 | 🟢 P3 | Plan below |
| `src/components/restaurant/RewardsSection.tsx` | 1026 | 🟢 P3 | Plan below |
| `src/components/kitchen/KitchenDisplay.tsx` | 895 | 🟢 P3 | Plan below |
| `src/components/ui/sidebar.tsx` | 726 | ⚪ P4 | shadcn — leave as-is |
| `src/components/restaurant/ReservationsSection.tsx` | 682 | 🟢 P3 | Plan below |
| `src/components/kitchen/StationDisplay.tsx` | 673 | 🟢 P3 | Plan below |
| `src/components/restaurant/WaitlistSection.tsx` | 639 | 🟢 P3 | Plan below |
| `src/app/api/seed/route.ts` | 619 | 🟢 P3 | Plan below |
| `src/components/pos/POSTerminal.tsx` | 528 | 🟢 P3 | Plan below |
| `src/components/restaurant/ContactSection.tsx` | 527 | 🟢 P3 | Plan below |
| `src/components/restaurant/CustomerProfileSheet.tsx` | 433 | ⚪ P4 | Acceptable |
| `src/components/ui/chart.tsx` | 353 | ⚪ P4 | shadcn — leave as-is |
| `src/components/pos/TableFloorPlan.tsx` | 351 | ⚪ P4 | Acceptable |
| `src/components/layout/DesktopSidebar.tsx` | 286 | ⚪ P4 | Acceptable |
| `src/components/restaurant/NutritionalInfoModal.tsx` | 281 | ⚪ P4 | Acceptable |
| `src/components/layout/Footer.tsx` | 270 | ⚪ P4 | Acceptable |
| `src/components/ui/menubar.tsx` | 276 | ⚪ P4 | shadcn — leave as-is |
| `src/components/layout/AIAssistantButton.tsx` | 257 | ⚪ P4 | Acceptable |
| `src/components/ui/dropdown-menu.tsx` | 257 | ⚪ P4 | shadcn — leave as-is |
| `src/components/ui/context-menu.tsx` | 252 | ⚪ P4 | shadcn — leave as-is |
| `src/components/kitchen/KitchenScreenSelector.tsx` | 243 | ⚪ P4 | Acceptable |
| `src/components/ui/carousel.tsx` | 241 | ⚪ P4 | shadcn — leave as-is |
| `src/components/staff/StaffLogin.tsx` | 238 | ⚪ P4 | Acceptable |

---

## P1: AdminPanel.tsx (3374 lines) — CRITICAL

This is the largest file in the project. It contains ALL admin functionality in a single component.

### Current Sections (identified by visual scan):
1. **Menu Management** — CRUD for menu items, categories, modifiers
2. **Order Management** — View/update orders, status changes
3. **Table Management** — Table CRUD, floor plan editing
4. **Staff Management** — Employee CRUD, PIN management
5. **Inventory** — Ingredient tracking, low-stock alerts
6. **Scheduling** — Staff schedules by day/role
7. **Cash Drawer** — Pay-in/pay-out/sale entries
8. **Reports** — Sales analytics, order stats
9. **Settings** — Restaurant configuration (name, hours, tax, etc.)
10. **Notifications** — Alert management
11. **Promotions** — Promo codes, special offers, reward tiers
12. **Waste Log** — Food waste tracking
13. **Purchase Orders** — Supplier order management

### Split Plan:

```
src/components/admin/
├── AdminPanel.tsx          → Shell: tab navigation, layout (~150 lines)
├── tabs/
│   ├── MenuTab.tsx         — Menu items, categories, modifiers (~300 lines)
│   ├── OrdersTab.tsx       — Order list, detail, status (~250 lines)
│   ├── TablesTab.tsx       — Table CRUD, floor plan (~200 lines)
│   ├── StaffTab.tsx        — Employee management (~200 lines)
│   ├── InventoryTab.tsx    — Ingredients, waste, purchase orders (~250 lines)
│   ├── ScheduleTab.tsx     — Staff schedules (~150 lines)
│   ├── CashDrawerTab.tsx   — Cash entries (~150 lines)
│   ├── ReportsTab.tsx      — Analytics & charts (~200 lines)
│   ├── SettingsTab.tsx     — Restaurant settings form (~200 lines)
│   ├── NotificationsTab.tsx — Alerts (~100 lines)
│   └── PromotionsTab.tsx   — Promo codes, offers, rewards (~200 lines)
├── shared/
│   ├── AdminCard.tsx       — Reusable card wrapper
│   ├── ImageUpload.tsx     — Image upload helper
│   └── ConfirmDialog.tsx   — Delete confirmation modal
```

**Estimated total after split:** ~2,150 lines across 14 files (avg ~150/file)

---

## P2: HomeSection.tsx (1472 lines)

### Split Plan:
```
src/components/restaurant/home/
├── HomeSection.tsx         → Main orchestrator (~200 lines)
├── HeroSection.tsx         — Hero banner with restaurant name, CTA (~150 lines)
├── CategoryGrid.tsx        — Category emoji grid with navigation (~120 lines)
├── PopularItems.tsx        — Popular items carousel (~150 lines)
├── SpecialOffers.tsx       — Special offers display (~100 lines)
├── TestimonialsSection.tsx — Customer testimonials carousel (~120 lines)
├── RecentOrdersWidget.tsx  — Recent orders display (~100 lines)
├── StatsSection.tsx        — Restaurant stats (orders served, etc.) (~80 lines)
└── NewsletterSignup.tsx    — Email signup form (~80 lines)
```

---

## P2: MenuSection.tsx (1386 lines)

### Split Plan:
```
src/components/restaurant/menu/
├── MenuSection.tsx         → Main orchestrator (~150 lines)
├── CategorySidebar.tsx     — Category filter sidebar (~100 lines)
├── MenuGrid.tsx            — Menu item grid with cards (~200 lines)
├── MenuCard.tsx            — Individual menu item card (~150 lines)
├── MenuSearch.tsx          — Search bar with filters (~100 lines)
├── DietaryFilter.tsx       — Dietary badge filters (~80 lines)
└── ItemDetailSheet.tsx     — Item detail with modifiers (~200 lines)
```

---

## P2: CartSection.tsx (1239 lines)

### Split Plan:
```
src/components/restaurant/cart/
├── CartSection.tsx         → Main orchestrator (~150 lines)
├── CartItemList.tsx        — Cart items with quantity controls (~150 lines)
├── CartSummary.tsx         — Subtotal, tax, delivery fee, total (~100 lines)
├── OrderTypeSelector.tsx   — Dine-in / Takeout / Delivery (~100 lines)
├── DeliveryForm.tsx        — Address input for delivery (~80 lines)
├── TipSelector.tsx         — Tip percentage/amount selection (~80 lines)
├── PromoCodeInput.tsx      — Promo code entry (~80 lines)
└── CheckoutButton.tsx      — Checkout flow trigger (~100 lines)
```

---

## P3: Other Large Files

### OrdersSection.tsx (1097 lines)
- Split into: `OrdersList.tsx`, `OrderDetail.tsx`, `OrderStatusBadge.tsx`, `OrderFilters.tsx`

### KitchenDashboard.tsx (1041 lines)
- Split into: `KitchenDashboard.tsx` (shell), `OrderTicket.tsx`, `StationFilter.tsx`, `KitchenTimer.tsx`

### RewardsSection.tsx (1026 lines)
- Split into: `RewardsSection.tsx` (shell), `PointsDisplay.tsx`, `RewardTiers.tsx`, `PromoCodeRedemption.tsx`

### KitchenDisplay.tsx (895 lines)
- Split into: `KitchenDisplay.tsx` (shell), `DisplayOrderCard.tsx`, `DisplayHeader.tsx`

### ReservationsSection.tsx (682 lines)
- Split into: `ReservationsSection.tsx` (shell), `ReservationForm.tsx`, `ReservationList.tsx`, `TimeSlotPicker.tsx`

### StationDisplay.tsx (673 lines)
- Split into: `StationDisplay.tsx` (shell), `StationOrderCard.tsx`, `StationHeader.tsx`

### WaitlistSection.tsx (639 lines)
- Split into: `WaitlistSection.tsx` (shell), `WaitlistEntry.tsx`, `WaitlistForm.tsx`

### API Seed Route (619 lines)
- Split into: `src/lib/seed/` modules: `seed-menu.ts`, `seed-tables.ts`, `seed-orders.ts`, `seed-staff.ts`, `seed-kitchen.ts`, `seed-promotions.ts`

### POSTerminal.tsx (528 lines)
- Split into: `POSTerminal.tsx` (shell), `PaymentPanel.tsx`, `OrderReview.tsx`

### ContactSection.tsx (527 lines)
- Split into: `ContactSection.tsx` (shell), `ContactForm.tsx`, `MapView.tsx`, `SocialLinks.tsx`

---

## Execution Order

1. **AdminPanel.tsx** (P1) — Biggest impact, highest complexity
2. **HomeSection.tsx** (P2) — Customer-facing, high visibility
3. **MenuSection.tsx** (P2) — Core ordering flow
4. **CartSection.tsx** (P2) — Checkout flow
5. **Remaining P3 files** — As capacity allows

## Principles

- Each extracted component should be self-contained
- Shared types go in `src/types/` or alongside the parent
- Shared UI primitives go in `src/components/admin/shared/` or `src/components/restaurant/shared/`
- Keep the main file as a thin orchestrator that composes extracted components
- No behavior changes during extraction — pure refactor
