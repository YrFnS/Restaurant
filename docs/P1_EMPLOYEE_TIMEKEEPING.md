# P1 Immutable Employee Timekeeping

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-employee-timekeeping`  
> **Stacked base:** `agent/p1-purchase-orders-receiving`  
> **Scope:** clock events, breaks, closed-shift summaries, labor cost, timezone/operational day, and audited corrections

## Purpose

The legacy employee model stores only `clockedIn`, `lastClockIn`, and `lastClockOut`. Every new clock action overwrites the previous state, so the restaurant cannot reconstruct historical hours, breaks, overnight shifts, labor cost, or manager corrections.

This slice makes timekeeping append-only. Clock and break events are immutable, open shifts may transition once to closed, closed summaries cannot be rewritten, and manager corrections are signed time adjustments with an actor and explanation.

## Restaurant time policy

The singleton restaurant settings now define:

- an IANA/PostgreSQL timezone, defaulting to `UTC` for migration safety;
- an operational-day boundary expressed as minutes after local midnight.

The operational date for each event is calculated in PostgreSQL from the configured timezone and operational-day boundary. A restaurant whose operational day starts at 04:00 can therefore keep a shift spanning midnight on the intended business date.

Unknown timezone names and invalid day boundaries are rejected.

## Time events

`EmployeeTimeEvent` stores immutable:

- clock in;
- clock out;
- break start;
- break end.

Every event records:

- employee;
- unique idempotency key;
- kiosk, manager, import, or system source;
- exact occurrence timestamp;
- operational date;
- actor identity and role;
- optional reason code, explanation, and metadata;
- immutable creation timestamp.

Events cannot be updated or deleted.

## Shift lifecycle

A clock-in event creates one open `EmployeeShift` with:

- employee and operational date;
- clock-in event and start timestamp;
- exact hourly-wage minor-unit snapshot;
- opening actor.

Only one open shift is permitted per employee.

Clock out closes the shift once and calculates:

- gross seconds;
- closed-break seconds;
- paid seconds;
- exact base labor cost using the wage snapshot;
- closing event, actor, and timestamp.

Open shifts may only transition once to closed. Closed shifts cannot be edited or deleted.

## Break lifecycle

Break start creates one open `EmployeeBreak` attached to the open shift. Only one open break is allowed for that shift.

Break end closes it once and records its duration. An employee cannot clock out while a break remains open. Closed breaks cannot be edited or deleted.

## Corrections

Historical corrections never rewrite an event, break, or closed shift. A manager appends an immutable `EmployeeTimeAdjustment` containing:

- unique idempotency key;
- closed shift;
- signed paid-seconds delta;
- exact signed labor-cost delta derived from the shift wage snapshot;
- reviewed reason code and explanation;
- manager identity, role, and timestamp.

The database locks the shift and rejects a correction that would make effective paid duration negative. Replaying the same idempotency key returns the original adjustment.

## Employee cache compatibility

`Employee.clockedIn`, `lastClockIn`, and `lastClockOut` remain temporary compatibility/read fields. The timekeeping service updates them transactionally with the event ledger.

Direct application or database changes to those fields are rejected unless they occur inside the reviewed timekeeping transaction. Employees with time history cannot be deleted, and an employee with an open shift cannot be deactivated.

## API behavior

### `/api/employees/clock`

- Kiosk actions authenticate with the employee PIN and shared PostgreSQL rate limits.
- Manager actions require a staff-administration session.
- Supported actions are clock in, clock out, break start, and break end.
- Kiosk requests cannot choose or backdate timestamps.
- Manager event timestamps must remain chronological and within the reviewed backdate window.
- Idempotency prevents duplicate events and duplicate open shifts.

### `/api/timekeeping`

- Managers can query shift history by operational date and optional employee.
- Responses include gross, break, paid, correction, and exact labor-cost totals.
- Managers can append signed time adjustments with a required reason and idempotency key.

## Operator workflow

The bilingual timesheet console shows:

- currently clocked-in employees;
- active breaks;
- live paid duration and labor cost;
- manager clock and break actions;
- historical shifts grouped by operational day;
- break, paid, adjustment, and labor-cost totals;
- append-only correction dialog.

## Migration policy

The migration preserves the latest usable legacy clock state:

- an active legacy clock-in becomes an imported open event and shift;
- a valid legacy clock-in/clock-out pair becomes imported events and one closed shift;
- the historical gap before the latest cached timestamps is not invented.

The employee cache must match the resulting open-shift state after migration.

## Validation gate

This slice is complete only when all of the following pass:

- clean migration deployment;
- representative existing-data adoption;
- Prisma schema validation and generated-client mapping;
- strict TypeScript, security inventories, ESLint, and production build;
- manager and kiosk authorization;
- shared kiosk rate limiting;
- clock-in replay and duplicate-open rejection;
- break start/end and active-break clock-out rejection;
- exact paid-time and labor-cost calculation;
- concurrent open-shift serialization;
- operational-date and timezone validation;
- append-only adjustment and replay;
- negative effective-duration rejection;
- event, break, shift, and adjustment immutability;
- direct employee clock-cache rejection;
- employee deactivation/deletion lifecycle guards;
- audit-event coverage;
- complete P0 and earlier P1 regression chain.

## Validated checkpoint

P1 Stacked Validation **#83** passed on exact implementation head:

```text
054b096a600782897ef1b6eaf6591326b50fbe58
```

The permanent validation jobs confirmed:

- locked installation, Prisma validation/generation, strict TypeScript, source-policy tests, ESLint, and production build;
- clean PostgreSQL migration deployment, exact seeded values, and the complete P0 and prior P1 regression chain;
- immutable clock, break, shift, and adjustment behavior, authorization, shared kiosk throttling, idempotency, concurrency, exact labor calculations, timezone/operational-day assignment, audit events, and lifecycle guards;
- representative legacy-data adoption with existing employee records and secure credentials preserved.

## Explicitly deferred

- schedule-versus-actual variance and attendance exceptions;
- overtime, holiday, premium, and jurisdiction-specific payroll rules;
- paid/unpaid break policy automation;
- employee self-service timesheet approval;
- biometric or hardware-terminal integrations;
- geofenced or device-bound clocking;
- leave, PTO, sickness, and absence workflows;
- payroll export and accounting journal generation;
- multi-branch time-policy scoping;
- destructive removal of the legacy employee clock-cache fields.

## Replay and reporting precision

Replays must match the full normalized request payload for the original event or adjustment. Historical timesheet summaries include closed shifts only and aggregate raw seconds plus exact minor-unit labor costs before converting once for display.
