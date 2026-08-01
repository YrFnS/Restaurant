from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Missing patch anchor in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


schema_path = Path("prisma/schema.prisma")
schema = schema_path.read_text()

old = '''enum ReservationStatus {
  confirmed
  seated
  completed
  cancelled
  no_show
}

enum WaitlistStatus {'''
new = '''enum ReservationStatus {
  confirmed
  seated
  completed
  cancelled
  no_show
}

enum ReservationSource {
  customer
  staff
  import
}

enum WaitlistStatus {'''
if new not in schema:
    if old not in schema:
        raise SystemExit("ReservationSource enum anchor missing")
    schema = schema.replace(old, new, 1)

old = '''  timezone                   String   @default("UTC")
  operationalDayStartMinutes Int      @default(0)
  logoUrl                    String   @default("")'''
new = '''  timezone                                String   @default("UTC")
  operationalDayStartMinutes              Int      @default(0)
  reservationMinNoticeMinutes              Int      @default(60)
  reservationMaxAdvanceDays                Int      @default(365)
  reservationDefaultDurationMinutes        Int      @default(90)
  reservationTurnoverMinutes               Int      @default(15)
  reservationSlotIntervalMinutes           Int      @default(30)
  reservationMinPartySize                  Int      @default(1)
  reservationMaxPartySize                  Int      @default(12)
  reservationCustomerCancelCutoffMinutes   Int      @default(120)
  logoUrl                                  String   @default("")'''
if new not in schema:
    if old not in schema:
        raise SystemExit("RestaurantSettings reservation policy anchor missing")
    schema = schema.replace(old, new, 1)

old = '''// ─── Reservations ───
model Reservation {
  id            String            @id @default(cuid())
  customerName  String
  customerPhone String
  customerEmail String?
  partySize     Int
  tableId       String?
  table         RestaurantTable?  @relation(fields: [tableId], references: [id])
  customerId    String?
  customer      Customer?         @relation(fields: [customerId], references: [id])
  dateTime      DateTime
  status        ReservationStatus @default(confirmed)
  occasion      String?
  preference    String?
  notes         String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}

// ─── Waitlist ───'''
new = '''// ─── Reservations ───
model Reservation {
  id                 String            @id @default(cuid())
  idempotencyKey     String?           @unique(map: "Reservation_idempotencyKey_key")
  customerName       String
  customerPhone      String
  customerEmail      String?
  partySize          Int
  tableId            String?
  table              RestaurantTable?  @relation(fields: [tableId], references: [id])
  customerId         String?
  customer           Customer?         @relation(fields: [customerId], references: [id])
  dateTime           DateTime           @db.Timestamptz(3)
  durationMinutes    Int                @default(90)
  turnoverMinutes    Int                @default(15)
  endsAt             DateTime           @db.Timestamptz(3)
  releaseAt          DateTime           @db.Timestamptz(3)
  status             ReservationStatus  @default(confirmed)
  source             ReservationSource  @default(customer)
  occasion           String?
  preference         String?
  notes              String?
  seatedAt           DateTime?          @db.Timestamptz(3)
  completedAt        DateTime?          @db.Timestamptz(3)
  cancelledAt        DateTime?          @db.Timestamptz(3)
  noShowAt           DateTime?          @db.Timestamptz(3)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@index([status, dateTime], map: "Reservation_status_start_idx")
  @@index([tableId, dateTime, releaseAt], map: "Reservation_table_range_idx")
  @@index([customerPhone, dateTime], map: "Reservation_phone_start_idx")
}

model ReservationServicePeriod {
  id              String   @id @default(cuid())
  dayOfWeek       Int
  opensAtMinute   Int
  closesAtMinute  Int
  label           String   @default("")
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([dayOfWeek, opensAtMinute, closesAtMinute], map: "ReservationServicePeriod_unique_window_idx")
  @@index([dayOfWeek, isActive, opensAtMinute], map: "ReservationServicePeriod_active_day_idx")
}

model ReservationClosure {
  id             String   @id @default(cuid())
  startsAt       DateTime @db.Timestamptz(3)
  endsAt         DateTime @db.Timestamptz(3)
  reason         String   @default("")
  createdById    String?
  createdByName  String   @default("")
  createdAt      DateTime @default(now()) @db.Timestamptz(3)

  @@index([startsAt, endsAt], map: "ReservationClosure_range_idx")
}

// ─── Waitlist ───'''
if new not in schema:
    if old not in schema:
        raise SystemExit("Reservation model anchor missing")
    schema = schema.replace(old, new, 1)

schema_path.write_text(schema)

seed_path = Path("prisma/seed.ts")
seed = seed_path.read_text()

old = '''  PrismaClient,
  ReservationStatus,
  StaffRole,'''
new = '''  PrismaClient,
  ReservationSource,
  ReservationStatus,
  StaffRole,'''
if new not in seed:
    if old not in seed:
        raise SystemExit("Seed ReservationSource import anchor missing")
    seed = seed.replace(old, new, 1)

old = '''    "PurchaseReceiptLine", "PurchaseReceipt", "PurchaseOrderLine",
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer",'''
new = '''    "PurchaseReceiptLine", "PurchaseReceipt", "PurchaseOrderLine",
    "ReservationClosure", "ReservationServicePeriod",
    "OrderItem", "Order", "Reservation", "WaitlistEntry", "Customer",'''
if new not in seed:
    if old not in seed:
        raise SystemExit("Seed reservation cleanup anchor missing")
    seed = seed.replace(old, new, 1)

old = '''  console.log("  ✓ Settings");

  // ── 2. KITCHEN STATIONS ──'''
new = '''  console.log("  ✓ Settings");

  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
    await db.reservationServicePeriod.create({
      data: {
        dayOfWeek,
        opensAtMinute: 10 * 60,
        closesAtMinute: 23 * 60,
        label: "Regular service",
        isActive: true,
      },
    });
  }
  console.log("  ✓ 7 reservation service periods");

  // ── 2. KITCHEN STATIONS ──'''
if new not in seed:
    if old not in seed:
        raise SystemExit("Seed reservation periods anchor missing")
    seed = seed.replace(old, new, 1)

old = '''        customerId: custMap[r.phone],
        dateTime: r.date,
        status: r.status as ReservationStatus,
        occasion: r.occasion,
        preference: r.pref,
        notes: r.notes,'''
new = '''        customerId: custMap[r.phone],
        dateTime: r.date,
        durationMinutes: 90,
        turnoverMinutes: 15,
        endsAt: new Date(r.date.getTime() + 90 * 60_000),
        releaseAt: new Date(r.date.getTime() + 105 * 60_000),
        source: ReservationSource.import,
        status: r.status as ReservationStatus,
        seatedAt: r.status === "seated" ? r.date : null,
        completedAt: r.status === "completed" ? r.date : null,
        cancelledAt: r.status === "cancelled" ? r.date : null,
        noShowAt: r.status === "no_show" ? r.date : null,
        occasion: r.occasion,
        preference: r.pref,
        notes: r.notes,'''
if new not in seed:
    if old not in seed:
        raise SystemExit("Seed reservation snapshot anchor missing")
    seed = seed.replace(old, new, 1)

seed_path.write_text(seed)

read_inventory_path = Path("tests/security/route-read-inventory.test.ts")
read_inventory = read_inventory_path.read_text()
old = '''  "GET /api/reward-tiers": {
    markers: ["isActive: true", "select: {"],
    forbidden: [/\\bcustomer\\b/i, /\\bemail\\b/i, /\\bphone\\b/i],
  },
  "GET /api/settings": {'''
new = '''  "GET /api/reward-tiers": {
    markers: ["isActive: true", "select: {"],
    forbidden: [/\\bcustomer\\b/i, /\\bemail\\b/i, /\\bphone\\b/i],
  },
  "GET /api/reservations/availability": {
    markers: [
      "availabilityQuerySchema",
      "reservation-availability",
      "consumeRateLimit",
      "listReservationAvailability",
      "availableTableCount",
    ],
    forbidden: [
      /\\bcustomerPhone\\b/i,
      /\\bcustomerEmail\\b/i,
      /\\btableId\\b/i,
      /\\btokenHash\\b/i,
    ],
  },
  "GET /api/settings": {'''
if new not in read_inventory:
    if old not in read_inventory:
        raise SystemExit("Read inventory reservation availability anchor missing")
    read_inventory = read_inventory.replace(old, new, 1)
read_inventory_path.write_text(read_inventory)
