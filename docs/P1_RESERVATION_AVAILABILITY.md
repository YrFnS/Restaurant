# P1 Reservation Availability and Table Allocation

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-reservation-availability`  
> **Base:** consolidated `main` after PRs #1–#7  
> **Scope:** restaurant-local availability, weekly service periods, closures, table allocation, lifecycle transitions, customer cancellation, and database concurrency

## Purpose

The current reservation endpoint assigns the smallest table that appears free inside a fixed plus-or-minus 90-minute window. It evaluates opening hours in the application server timezone, has no holiday or closure model, does not store a reservation end or turnover buffer, and can double-book a table when concurrent requests race.

This slice establishes one reservation-capacity engine shared by public booking, staff operations, the reservation calendar, and the future waitlist workflow.

## Policy decisions

- Reservation input is expressed as a restaurant-local date and time, then converted to an exact UTC instant using the configured IANA/PostgreSQL timezone.
- Weekly service periods are independent from general display hours and may contain multiple periods per weekday.
- Overnight service periods are supported when the closing minute is earlier than the opening minute.
- Full-day and partial-day closures override weekly service periods.
- Every reservation snapshots its dining duration and turnover buffer. Later policy changes do not reinterpret existing bookings.
- Table occupancy uses the half-open range `[startsAt, releaseAt)`.
- Active `confirmed` and `seated` reservations block the assigned table.
- PostgreSQL exclusion constraints are the final concurrency boundary against table double-booking.
- Public availability responses contain aggregate capacity only; they do not expose table IDs, customer records, or other reservations.
- Preference is a soft table-ordering hint. It does not promise a particular physical table or section.
- This slice allocates one configured table per reservation. Physical table combinations remain deferred until adjacency/combinability is explicitly modeled.
- Customer cancellation is allowed only for a confirmed booking and before the configured cutoff.
- Seating, completion, cancellation, no-show, and reassignment are transactional and audited.

## Restaurant reservation policy

The singleton restaurant settings gain:

- minimum booking notice in minutes;
- maximum booking horizon in days;
- default dining duration in minutes;
- turnover/cleaning buffer in minutes;
- public slot interval in minutes;
- minimum and maximum party size;
- customer cancellation cutoff in minutes;
- automatic table assignment toggle.

Values are bounded by database checks and API schemas.

## Weekly service and closures

`ReservationServicePeriod` stores reusable weekly periods:

- weekday `0` through `6`;
- opening minute after local midnight;
- closing minute after local midnight;
- optional bilingual/operator label;
- active state.

`ReservationClosure` stores exact UTC start/end instants plus an operator reason and actor snapshot. The administration API accepts restaurant-local values and performs timezone conversion on the server.

The migration seeds one period for every weekday using the existing restaurant `openTime` and `closeTime`, preserving current behavior while enabling later schedule refinement.

## Reservation snapshot

Each reservation stores:

- exact start instant;
- exact dining end instant;
- exact release instant including turnover;
- snapshotted duration and turnover minutes;
- source (`customer`, `staff`, or `import`);
- lifecycle timestamps for seating, completion, cancellation, and no-show;
- optional assigned table.

Existing reservations are backfilled using the configured default duration and turnover policy.

## Availability engine

For a requested restaurant-local date, party size, and optional preference, the engine:

1. validates party-size and advance-window policy;
2. resolves weekly service periods, including prior-day overnight continuation;
3. subtracts closures;
4. generates slots at the configured interval;
5. calculates the exact occupancy range for each slot;
6. counts compatible tables not blocked by an active reservation;
7. returns safe aggregate slot DTOs.

Booking repeats the calculation inside a transaction, locks compatible table rows, rechecks overlap, and inserts the reservation. PostgreSQL rejects any remaining conflicting write.

## API surface

### Public

- `GET /api/reservations/availability`
  - query: restaurant-local date, party size, optional preference;
  - shared rate limiting;
  - safe aggregate slots only.
- `POST /api/reservations`
  - restaurant-local `date` and `time` contract;
  - authoritative duration, turnover, table, and UTC conversion;
  - duplicate-customer protection;
  - opaque ownership token.
- `PATCH /api/reservations/:id`
  - ownership token permits eligible customer cancellation only.

### Staff

- `GET /api/reservations`
  - bounded filters and restaurant-local display fields.
- `PATCH /api/reservations/:id`
  - controlled status transitions, table reassignment, and notes;
  - transactional table-state effects and audit event.
- `GET/PUT/POST/DELETE /api/reservation-settings`
  - policy, weekly periods, and closures;
  - reservation-management authorization before body parsing;
  - immutable audit history.

## Lifecycle

```text
confirmed -> seated -> completed
     |          |
     |          -> cancelled
     -> cancelled
     -> no_show
```

Terminal states cannot transition. Customer cancellation is narrower than staff cancellation and obeys the configured cutoff.

## Operator workflow

The customer reservation screen will:

- query live availability instead of showing hard-coded times;
- submit restaurant-local date/time values;
- show the restaurant timezone;
- handle no-slot, stale-slot, loading, and conflict responses;
- retain scoped reservation credentials on the current device.

The staff workflow will:

- group calendar entries using restaurant-local dates rather than UTC dates;
- display start, end, table, party, and status;
- check mutation errors visibly;
- link to a bilingual reservation-policy editor;
- support weekly periods and temporary closures.

## Migration and compatibility

The migration is additive:

- existing reservations receive duration, end, release, and source snapshots;
- existing opening and closing settings seed weekly service periods;
- no historical booking is invented or removed;
- an overlap preflight blocks deployment if existing active reservations already double-book a table.

The old browser-generated ISO booking contract is replaced by restaurant-local date/time. There is no silent dependence on the customer browser timezone.

## Validation gate

This slice is complete only when all of the following pass:

- clean migration deployment;
- representative existing-data adoption;
- Prisma validation and generated-client mappings;
- strict TypeScript, source-policy tests, ESLint, and production build;
- public availability privacy and rate limiting;
- restaurant-local timezone conversion;
- normal and overnight weekly periods;
- full and partial closures;
- notice, horizon, party-size, duration, turnover, and slot-interval policy;
- concurrent booking with no table double-booking;
- direct database overlap rejection;
- duplicate-customer handling;
- reassignment conflict handling;
- confirmed, seated, completed, cancelled, and no-show transitions;
- customer cancellation cutoff;
- audit events and table-state effects;
- complete P0 and earlier P1 regression chain.

## Explicitly deferred

- physical table combinations and adjacency rules;
- deposits, card authorization, and cancellation fees;
- customer rescheduling and self-service detail editing;
- email, SMS, and messaging-provider delivery;
- recurring events and banquet contracts;
- multi-branch capacity pools;
- waitlist estimates and automatic waitlist-to-reservation promotion;
- demand forecasting, overbooking, and yield management.
