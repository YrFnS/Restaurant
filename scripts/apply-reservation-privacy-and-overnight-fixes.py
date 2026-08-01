from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Missing patch anchor in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/reservations/availability.ts",
    '''    table: reservation.table
      ? {
          id: reservation.table.id,
          number: reservation.table.number,
          section: reservation.table.section,
        }
      : null,''',
    '''    table: reservation.table
      ? {
          number: reservation.table.number,
          section: reservation.table.section,
        }
      : null,''',
)

replace_once(
    "src/lib/reservations/availability.ts",
    '''      SELECT
        requested."localDate"::timestamp +
          make_interval(mins => period."opensAtMinute") AS "localStart",
        requested."localDate"::timestamp +''',
    '''      SELECT
        requested."localDate",
        requested."localDate"::timestamp +
          make_interval(mins => period."opensAtMinute") AS "localStart",
        requested."localDate"::timestamp +''',
)

replace_once(
    "src/lib/reservations/availability.ts",
    '''      SELECT
        requested."localDate"::timestamp AS "localStart",
        requested."localDate"::timestamp +
          make_interval(mins => period."closesAtMinute") AS "localEnd"''',
    '''      SELECT
        requested."localDate",
        requested."localDate"::timestamp AS "localStart",
        requested."localDate"::timestamp +
          make_interval(mins => period."closesAtMinute") AS "localEnd"''',
)

replace_once(
    "src/lib/reservations/availability.ts",
    '''      CROSS JOIN LATERAL generate_series(
        service_windows."localStart",
        service_windows."localEnd" - make_interval(
          mins => policy."durationMinutes" + policy."turnoverMinutes"
        ),
        make_interval(mins => policy."slotIntervalMinutes")
      ) AS generated("localStart")
    ),''',
    '''      CROSS JOIN LATERAL generate_series(
        service_windows."localStart",
        service_windows."localEnd" - make_interval(
          mins => policy."durationMinutes" + policy."turnoverMinutes"
        ),
        make_interval(mins => policy."slotIntervalMinutes")
      ) AS generated("localStart")
      WHERE generated."localStart"::date = service_windows."localDate"
    ),''',
)

replace_once(
    "src/app/api/reservations/[id]/route.ts",
    '''  ReservationAvailabilityError,
  serializeReservationForStaff,
} from "@/lib/reservations/availability";''',
    '''  ReservationAvailabilityError,
  serializeReservationForCustomer,
  serializeReservationForStaff,
} from "@/lib/reservations/availability";''',
)

replace_once(
    "src/app/api/reservations/[id]/route.ts",
    '''  return NextResponse.json(
    {
      reservation: serializeReservationForStaff(
        result.reservation,
        result.timezone
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );''',
    '''  const reservation = input.customerAuthorized
    ? serializeReservationForCustomer(result.reservation, result.timezone)
    : serializeReservationForStaff(result.reservation, result.timezone);
  return NextResponse.json(
    { reservation },
    { headers: { "Cache-Control": "no-store" } }
  );''',
)

replace_once(
    "tests/integration/p1-reservation-availability.ts",
    '''  status(second, 201, "Second reassignment reservation");
  const reassign = await api<any>(
    `/api/reservations/${encodeURIComponent(first.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ tableId: second.data.reservation.table.id }),
    }
  );''',
    '''  status(second, 201, "Second reassignment reservation");
  const secondStored = await db.reservation.findUniqueOrThrow({
    where: { id: second.data.reservation.id },
    select: { tableId: true },
  });
  assert.ok(secondStored.tableId, "Second reservation must have a stored table");
  const reassign = await api<any>(
    `/api/reservations/${encodeURIComponent(first.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ tableId: secondStored.tableId }),
    }
  );''',
)

replace_once(
    "tests/integration/p1-reservation-availability.ts",
    '''  const seated = await api<any>(
    `/api/reservations/${encodeURIComponent(lifecycle.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "seated" }),
    }
  );''',
    '''  const lifecycleStored = await db.reservation.findUniqueOrThrow({
    where: { id: lifecycle.data.reservation.id },
    select: { tableId: true },
  });
  assert.ok(lifecycleStored.tableId, "Lifecycle reservation must have a stored table");
  const seated = await api<any>(
    `/api/reservations/${encodeURIComponent(lifecycle.data.reservation.id)}`,
    {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ status: "seated" }),
    }
  );''',
)

replace_once(
    "tests/integration/p1-reservation-availability.ts",
    '''  const table = await db.restaurantTable.findUniqueOrThrow({
    where: { id: lifecycle.data.reservation.table.id },
  });''',
    '''  const table = await db.restaurantTable.findUniqueOrThrow({
    where: { id: lifecycleStored.tableId! },
  });''',
)

replace_once(
    "tests/security/reservation-availability-source-inventory.test.ts",
    '''    expect(availabilityRoute).not.toContain("customerEmail");
    expect(availabilityRoute).not.toContain("tableId");''',
    '''    expect(availabilityRoute).not.toContain("customerEmail");
    expect(availabilityRoute).not.toContain("tableId");
    expect(service).not.toContain("id: reservation.table.id");
    expect(service).toContain(
      'generated."localStart"::date = service_windows."localDate"'
    );''',
)
