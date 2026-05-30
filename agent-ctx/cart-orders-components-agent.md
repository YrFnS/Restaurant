# Task: Cart and Orders Section Components

## Summary
Created two comprehensive restaurant section components for the Next.js 16 app:

### Files Created
1. `/src/components/restaurant/CartSection.tsx` - Full cart and checkout page
2. `/src/components/restaurant/OrdersSection.tsx` - Order tracking and history

### Files Modified
1. `/src/components/layout/AppShell.tsx` - Replaced placeholder CartSection and OrdersSection with real components

## CartSection Features
- **Cart Items List**: Shows items with name (locale-aware), price, quantity, modifiers, notes; +/- quantity controls; remove button
- **Empty State**: Beautiful empty cart with "Browse Menu" button
- **Order Type Selector**: 3 toggle buttons (Dine In, Takeout, Delivery) with icons
- **Delivery Address**: Conditional input shown only for delivery, with delivery fee display
- **Order Summary**: Subtotal, tax (10%), delivery fee, discount, tip, total
- **Tip Section**: Preset buttons (No Tip, 15%, 18%, 20%, Custom) with custom tip input
- **Promo Code**: Input + Apply button, validates codes (SAFFRON20=20%, WELCOME10=10%, DELIVERY=15%)
- **Order Notes**: Textarea for special instructions
- **Payment Method**: Radio group (Cash, Card) with icons
- **Place Order Button**: Shows total, disabled when empty, creates order via API, success dialog
- **Success Dialog**: Animated checkmark, order number, estimated time, navigate to orders

## OrdersSection Features
- **Tab Switcher**: Track Order / Order History tabs
- **Order Tracking**: Input for order number, auto-loads last placed order, polls every 30s
- **Progress Tracker**: 4-step animated tracker (Received → Confirmed → Preparing → Ready/Completed)
- **Order Details Card**: Order number, type, status badge, items list, totals, payment info
- **Order History**: Look up by phone number, collapsible order cards with reorder button
- **Empty States**: No orders found, enter order number, no history
- **Loading Skeletons**: For both tracking and history views

## Technical Details
- All text uses translation system (t.cart.*, t.orders.*)
- RTL-aware with CSS logical properties (start/end, ps/ms)
- Framer Motion animations throughout
- Loading states with skeletons
- Error handling with retry options
- No lint errors in created files
