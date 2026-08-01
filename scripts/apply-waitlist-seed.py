from pathlib import Path

path = Path("prisma/seed.ts")
text = path.read_text()

if "P1 waitlist seeded hold" in text:
    print("Waitlist seed adoption is already applied.")
    raise SystemExit(0)

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

if old not in text:
    raise SystemExit("Waitlist seed block was not found")
text = text.replace(old, new, 1)

helper = """function pastDate(days: number) { return new Date(Date.now() - days * 86400000); }
function micros(value: number) { return BigInt(Math.round(value * 1_000_000)); }"""
helper_replacement = """function pastDate(days: number) { return new Date(Date.now() - days * 86400000); }
function addMinutes(value: Date, minutes: number) { return new Date(value.getTime() + minutes * 60000); }
function micros(value: number) { return BigInt(Math.round(value * 1_000_000)); }"""

if helper not in text:
    raise SystemExit("Seed date-helper marker was not found")

path.write_text(text.replace(helper, helper_replacement, 1))
print("Applied valid waitlist estimate and notification-hold snapshots to the seed.")
