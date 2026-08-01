from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Missing patch anchor in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/reservations/availability.ts",
    'import { Prisma, PrismaClient } from "@prisma/client";\nimport { db } from "@/lib/db";\n\nexport type ReservationClient = PrismaClient | Prisma.TransactionClient;',
    'import { Prisma } from "@prisma/client";\nimport { db } from "@/lib/db";\n\nexport type ReservationClient = Pick<\n  Prisma.TransactionClient,\n  "$queryRaw" | "$executeRaw"\n>;',
)

replace_once(
    "src/app/api/reservation-settings/route.ts",
    '''    if (parsed.data.type === "period") {
      const period = await db.$transaction(async (tx) => {
        const data = {
          dayOfWeek: parsed.data.dayOfWeek,
          opensAtMinute: timeToMinutes(parsed.data.opensAt),
          closesAtMinute: timeToMinutes(parsed.data.closesAt),
          label: parsed.data.label,
          isActive: parsed.data.isActive,
        };
        const saved = parsed.data.id
          ? await tx.reservationServicePeriod.update({
              where: { id: parsed.data.id },
              data,
            })
          : await tx.reservationServicePeriod.create({ data });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: parsed.data.id
            ? "reservation.service_period.update"
            : "reservation.service_period.create",
          entityType: "ReservationServicePeriod",
          entityId: saved.id,
          context,
          metadata: { after: saved },
        });
        return saved;
      });
      return NextResponse.json({ period }, { status: parsed.data.id ? 200 : 201 });
    }

    const localStart = parsed.data.localStart;
    const localEnd = parsed.data.localEnd;
    const closure = await db.$transaction(async (tx) => {''',
    '''    if (parsed.data.type === "period") {
      const periodInput = parsed.data;
      const period = await db.$transaction(async (tx) => {
        const data = {
          dayOfWeek: periodInput.dayOfWeek,
          opensAtMinute: timeToMinutes(periodInput.opensAt),
          closesAtMinute: timeToMinutes(periodInput.closesAt),
          label: periodInput.label,
          isActive: periodInput.isActive,
        };
        const saved = periodInput.id
          ? await tx.reservationServicePeriod.update({
              where: { id: periodInput.id },
              data,
            })
          : await tx.reservationServicePeriod.create({ data });
        await writeAuditEvent(tx, {
          actor: auth.session,
          action: periodInput.id
            ? "reservation.service_period.update"
            : "reservation.service_period.create",
          entityType: "ReservationServicePeriod",
          entityId: saved.id,
          context,
          metadata: { after: saved },
        });
        return saved;
      });
      return NextResponse.json(
        { period },
        { status: periodInput.id ? 200 : 201 }
      );
    }

    const closureInput = parsed.data;
    const localStart = closureInput.localStart;
    const localEnd = closureInput.localEnd;
    const closure = await db.$transaction(async (tx) => {''',
)

replace_once(
    "src/app/api/reservation-settings/route.ts",
    '''          reason: parsed.data.reason,
          createdById: auth.session.id,''',
    '''          reason: closureInput.reason,
          createdById: auth.session.id,''',
)

replace_once(
    "src/app/api/reservations/[id]/route.ts",
    '''      let targetTable = null;
      if (targetTableId) {''',
    '''      let targetTable: Awaited<
        ReturnType<typeof assertReservationTableAvailable>
      > | null = null;
      if (targetTableId) {''',
)

replace_once(
    "tests/integration/p1-reservation-availability.ts",
    '''  const firstKey = `p1-reassign-first-${crypto.randomUUID()}`;
  const first = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: `+96475084${Math.floor(Math.random() * 1000000)}`,
    key: firstKey,
  });
  status(first, 201, "First reassignment reservation");
  const replay = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: first.data.reservation.customerPhone || "",
    name: first.data.reservation.customerName,
    key: firstKey,
  });
  // Public DTO intentionally omits phone, so replay with a changed payload must conflict.
  status(replay, 409, "Changed-payload idempotency conflict");''',
    '''  const firstKey = `p1-reassign-first-${crypto.randomUUID()}`;
  const firstPhone = `+96475084${Math.floor(Math.random() * 1000000)}`;
  const first = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    key: firstKey,
  });
  status(first, 201, "First reassignment reservation");
  const replay = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    name: first.data.reservation.customerName,
    key: firstKey,
  });
  status(replay, 200, "Reservation idempotent replay");
  assert.equal(replay.data.replayed, true);
  const replayConflict = await book({
    date: reassignDate,
    time: reassignTime,
    partySize: 8,
    phone: firstPhone,
    name: "Changed reservation payload",
    key: firstKey,
  });
  status(replayConflict, 409, "Changed-payload idempotency conflict");
  assert.equal(
    replayConflict.data.code,
    "RESERVATION_IDEMPOTENCY_CONFLICT"
  );''',
)
