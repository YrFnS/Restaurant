# Task: Create 4 Restaurant Section Components

## Summary
Created 4 fully functional section components for the Saffron Restaurant app:
1. **ReservationsSection.tsx** - Table reservation with form, confirmation dialog, and reservation lookup
2. **WaitlistSection.tsx** - Waitlist queue management with join form, position tracking, and best times info
3. **RewardsSection.tsx** - Loyalty program with account lookup, rewards tiers, and gift card purchasing
4. **ContactSection.tsx** - Contact info, feedback form, FAQ accordion, and service cards

## Files Modified
- `src/lib/i18n/locales/en.json` - Added ~40 new translation keys
- `src/lib/i18n/locales/ar.json` - Added matching Arabic translations
- `src/components/layout/AppShell.tsx` - Updated imports to use new section components

## Files Created
- `src/components/restaurant/ReservationsSection.tsx`
- `src/components/restaurant/WaitlistSection.tsx`
- `src/components/restaurant/RewardsSection.tsx`
- `src/components/restaurant/ContactSection.tsx`

## Key Features Implemented

### ReservationsSection
- Full reservation form with name, phone, email, party size (1-12 buttons), date picker (Calendar + Popover), time slot selector, occasion dropdown, seating preference radio group, special requests
- Confirmation dialog with animated check icon, reservation details display
- My Reservations lookup by phone with status badges (confirmed=green, seated=blue, completed=gray, cancelled=red)
- Cancel button for confirmed reservations
- Pre-fills from store customerName/customerPhone

### WaitlistSection
- Current wait status banner with color indicator (green/yellow/red)
- Join waitlist form with party size 1-8
- Your Position card showing # position, parties ahead, estimated wait with progress bar
- Leave Waitlist button
- Find My Spot lookup by phone
- Best Times to Visit with peak hours and recommended times
- Empty states for no one waiting / not on list

### RewardsSection
- Tab switcher: Rewards | Gift Cards
- Loyalty account lookup by phone
- Account dashboard: welcome message, points balance, total spent, visits, progress to next reward
- How It Works 3-step visual
- Available Rewards with 4 tiers (100/250/500/1000 points) and redeem buttons
- Sign Up form for new customers
- Gift Card purchase form with template selection (3 gradients), amount presets + custom, recipient, message, preview card
- My Gift Cards lookup by purchaser name with code copy, balance, status

### ContactSection
- Restaurant info card from /api/settings with name, address (locale-aware), phone, email
- Map placeholder with styled div
- Get Directions button (Google Maps link)
- Opening hours table with current day highlighted, open/closed badge
- Social media link buttons
- Feedback form with 5-star rating and textarea
- FAQ accordion with 5 questions
- Service cards: Catering and Private Events

## Technical Details
- All text uses translation system (t.*.*)
- RTL-aware with CSS logical properties (me-*, ms-*, ps-*, pe-*, text-start)
- Framer Motion animations (fadeIn, stagger, spring animations)
- Loading states with Loader2 spinners
- Error handling with toast notifications
- Responsive design (mobile-first, max-w-lg centered)
- Uses shadcn/ui components: Card, Button, Input, Label, Textarea, Select, Calendar, Popover, Tabs, Dialog, Badge, Progress, Accordion, RadioGroup, Separator

## Lint Result
✅ Clean - 0 errors, 0 warnings
