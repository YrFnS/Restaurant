from pathlib import Path

changed = False

seed_path = Path("prisma/seed.ts")
seed = seed_path.read_text()

if "P1 waitlist seeded hold" not in seed:
    old = '''  for (const w of wlData) {
    await db.waitlistEntry.create({
      data: { ...w, status: w.status as WaitlistStatus },
    });
  }
  console.log(`  ✓ ${wlData.length} waitlist entries`);'''

    new = '''  const waitlistSeededAt = new Date();
  const seededHoldTable = tableRecords.find((table: any) => table.number === 9);
  for (const w of wlData) {
    const notified = w.status === "notified";
    if (notified && seededHoldTable) {
      // P1 waitlist seeded hold: a notified entry must own a real table hold.
      await db.restaurantTable.update({
        where: { id: seededHoldTable.id },
        data: { status: TableStatus.reserved, seatedAt: null },
      });
    }
    await db.waitlistEntry.create({
      data: {
        ...w,
        status: w.status as WaitlistStatus,
        source: ReservationSource.import,
        tableId: notified ? seededHoldTable?.id : null,
        estimatedSeatAt: notified
          ? waitlistSeededAt
          : addMinutes(waitlistSeededAt, w.estimatedWait),
        estimateCalculatedAt: waitlistSeededAt,
        notifiedAt: notified ? waitlistSeededAt : null,
        notificationExpiresAt: notified
          ? addMinutes(waitlistSeededAt, 10)
          : null,
        notificationConfirmedAt: notified ? waitlistSeededAt : null,
      },
    });
  }
  console.log(`  ✓ ${wlData.length} waitlist entries`);'''

    if old not in seed:
        raise SystemExit("Waitlist seed block was not found")
    seed = seed.replace(old, new, 1)

    helper = """function pastDate(days: number) { return new Date(Date.now() - days * 86400000); }
function micros(value: number) { return BigInt(Math.round(value * 1_000_000)); }"""
    helper_replacement = """function pastDate(days: number) { return new Date(Date.now() - days * 86400000); }
function addMinutes(value: Date, minutes: number) { return new Date(value.getTime() + minutes * 60000); }
function micros(value: number) { return BigInt(Math.round(value * 1_000_000)); }"""

    if helper not in seed:
        raise SystemExit("Seed date-helper marker was not found")
    seed = seed.replace(helper, helper_replacement, 1)
    seed_path.write_text(seed)
    changed = True
    print("Applied valid waitlist estimate and notification-hold snapshots to the seed.")

isolation_path = Path("tests/integration/p0-customer-isolation.ts")
isolation = isolation_path.read_text()
waitlist_boundary = "  await db.reservationServicePeriod.deleteMany();"
if waitlist_boundary not in isolation:
    raise SystemExit("Reservation/waitlist test boundary was not found")
reservation_part, waitlist_part = isolation.split(waitlist_boundary, 1)
wrong_payload = 'body: JSON.stringify({ action: "cancel" })'
correct_payload = 'body: JSON.stringify({ status: "cancelled" })'
reservation_replacements = reservation_part.count(wrong_payload)
if reservation_replacements:
    reservation_part = reservation_part.replace(wrong_payload, correct_payload)
    isolation_path.write_text(
        reservation_part + waitlist_boundary + waitlist_part
    )
    changed = True
    print(
        f"Restored {reservation_replacements} reservation cancellation payload(s) "
        "without changing the waitlist action contract."
    )

if not changed:
    print("Waitlist compatibility updates are already applied.")
