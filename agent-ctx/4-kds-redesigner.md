---
Task ID: 4
Agent: kds-redesigner
Task: Redesign kitchen/KDS page to match reference and use app theme

Work Log:
- Read all 5 kitchen component files and understood the current architecture
- Identified that KitchenDisplay.tsx and KitchenScreenSelector.tsx used hardcoded dark theme (bg-zinc-900, text-zinc-100, etc.)
- Identified that t.staff.* translation keys were referenced but missing from locale files
- Redesigned KitchenDashboard.tsx as the main KDS display with reference design
- Redesigned kitchen/page.tsx to show KitchenDashboard directly instead of KitchenScreenSelector
- Redesigned KitchenDisplay.tsx to use theme-aware classes instead of hardcoded dark theme
- Redesigned KitchenScreenSelector.tsx to use theme-aware classes
- Redesigned StationDisplay.tsx with consistent theme-aware design
- Added "staff" section to both en.json and ar.json with 35+ translation keys
- Lint passes clean, dev server compiling successfully

Stage Summary:
- All 5 kitchen component files redesigned to use theme-aware classes
- Kitchen KDS now respects light/dark mode toggle
- Station data fetched from /api/stations API
- ALL DAY summary bar and stats bar added
- Responsive grid layout (1/2/3 columns) for order cards
- Full RTL support with dir and logical CSS properties
- 35+ new i18n keys added in staff section for both English and Arabic
