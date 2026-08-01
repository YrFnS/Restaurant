# P1 Waitlist Operations and Capacity Estimates

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-waitlist-capacity`  
> **Base:** consolidated `main` after reservation availability  
> **Status:** Implemented and validated  
> **Scope:** capacity-aware estimates, notification holds, customer confirmation, seating, expiry, privacy, auditing, and database concurrency

## Purpose

The previous waitlist estimated `15 + 12 × parties ahead`, ordered every party in one global FIFO queue, and changed statuses directly without assigning a compatible table, expiring notifications, reserving capacity, or auditing operator actions.

This slice makes the waitlist use the restaurant's real tables, current table occupancy, future reservations, party size, soft section preference, turnover policy, and notification holds.

## Policy decisions

- Waitlist input is accepted only while the waitlist is enabled and the restaurant is inside a configured reservation service period without an active closure.
- Party-size bounds are shared with reservation policy.
- Estimates simulate one availability lane per physical table.
- A lane includes current table occupancy, upcoming active reservations, active notification holds, and simulated parties already ahead in the compatible queue.
- Preference is a soft ordering hint and never promises a specific section.
- The estimate is a quote, not a reservation. It is recalculated after every join, cancellation, notification, expiry, no-show, and seating event.
- A waiting entry has no table assignment.
- Notification assigns and temporarily holds one currently open compatible table.
- The notification has an exact expiry timestamp. Expired notifications become `no_show` and release their table hold.
- Customer confirmation is represented by `notificationConfirmedAt`; the existing `notified` status remains the active hold state.
- When confirmation is required, staff cannot seat the party until the customer or an authorized staff member confirms.
- Seating locks the entry and table, rechecks reservation conflict, marks the entry seated, and changes the table to `seated` in one transaction.
- Customer access remains scoped to an opaque waitlist token. Public aggregate responses never expose guest names, phone numbers, entry IDs, or table IDs.
- Staff lifecycle mutations are authorized before request-body parsing and create immutable audit events.
- Historical terminal entries are retained rather than deleted.

## Waitlist settings

The singleton restaurant settings gain:

- `waitlistEnabled`;
- `waitlistAverageTurnoverMinutes`;
- `waitlistNotificationExpiryMinutes`;
- `waitlistEstimatePaddingMinutes`;
- `waitlistMaxQuoteMinutes`;
- `waitlistRequireConfirmation`.

The restaurant timezone, reservation service periods, closures, and reservation party-size bounds are reused rather than duplicated.

## Waitlist snapshot

Each entry stores:

- optional idempotency key;
- source (`customer`, `staff`, or `import`);
- soft section preference;
- current estimate and estimated seating instant;
- estimate calculation timestamp;
- assigned table, only after notification;
- notification, expiry, and confirmation timestamps;
- seated, cancelled, and no-show timestamps.

Existing entries are adopted additively. Legacy notified entries return to `waiting` for a fresh estimate because the previous schema did not contain a trustworthy physical table hold.

## Capacity estimate

For every active entry, the estimator:

1. loads compatible tables and current table state;
2. adds current occupancy blocks using `seatedAt` and average turnover;
3. adds active reservation blocks using exact `[dateTime, releaseAt)` snapshots;
4. adds notification holds through expiry plus expected dining time;
5. processes waiting entries in queue order;
6. finds the earliest compatible gap long enough for expected dining time;
7. applies bounded quote padding and stores the estimate;
8. returns a position ordered by projected seating time and join time.

The algorithm is intentionally conservative. It does not overbook, combine physical tables, or promise a specific table before notification.

## Lifecycle

```text
waiting -> notified -> seated
   |          |  \
   |          |   -> no_show (manual or expiry)
   |          -> cancelled
   -> cancelled
   -> no_show
```

`notificationConfirmedAt` distinguishes a confirmed notified party without adding another active database status.

## API surface

### Public

- `GET /api/waitlist`
  - aggregate queue state without credentials;
  - scoped entry state with `id` and token;
  - shared rate limiting and no private aggregate data.
- `POST /api/waitlist`
  - validated join request;
  - required idempotency key;
  - authoritative estimate and scoped access token.
- `PATCH /api/waitlist/:id`
  - token-scoped `confirm` or `cancel` only.

### Staff

- `GET /api/waitlist?admin=true`
  - active and recent entries with compatible operational details.
- `PUT /api/waitlist`
  - force estimate refresh after authorized operational changes.
- `PATCH /api/waitlist/:id`
  - notify, confirm, seat, cancel, and no-show actions.
- `GET/PATCH /api/waitlist/settings`
  - waitlist policy management.
- `GET/POST /api/internal/waitlist`
  - authenticated expiry and estimate worker.

## Concurrency boundaries

- A global advisory queue lock serializes queue-changing operations.
- Idempotency and phone advisory locks serialize join retries and duplicate active entries.
- Notification locks compatible table rows before assignment.
- PostgreSQL retains the active-phone partial unique index.
- PostgreSQL adds one active notified hold per table.
- Seating rechecks current reservation overlap while the table row is locked.
- Deadlocks and serialization conflicts return an explicit retryable `409`, not a partial mutation or generic `500`.

## Operator workflow

The bilingual waitlist console provides:

- live active and recent queues;
- capacity-derived quote, projected seating time, and position;
- notification and confirmation state;
- notification expiry countdown;
- assigned table and section;
- notify, confirm, seat, cancel, no-show, and refresh actions;
- waitlist policy controls.

The customer workflow provides:

- restaurant-open and waitlist-enabled state;
- dynamic party-size bounds;
- optional section preference;
- capacity-derived quote and projected seating time;
- notification expiry status;
- customer confirmation and cancellation.

## Validation

The completed slice is protected by permanent static and database-backed gates covering:

- clean migration deployment;
- representative existing-data adoption;
- Prisma schema mappings;
- strict TypeScript, source-policy tests, ESLint, and production build;
- public privacy and rate limiting;
- join idempotency and changed-payload conflict;
- duplicate active-phone rejection;
- capacity- and party-size-aware estimates;
- current occupancy and future reservation effects;
- priority-aware table notification;
- one active hold per table under concurrency;
- customer confirmation authorization;
- notification expiry and hold release;
- transactional seating and table-state update;
- cancellation and no-show hold release;
- table deletion, status, and capacity protections while a hold is active;
- immutable audit events;
- complete P0 and earlier P1 regression coverage.

The exact branch head passed both the permanent P0 Validation workflow and the complete PostgreSQL-backed P0/P1 integration workflow before the pull request was marked ready for review.

## Explicitly deferred

- SMS, email, and messaging-provider delivery;
- two-way provider callbacks;
- physical table combinations and adjacency;
- customer party-size or preference editing after join;
- automatic waitlist-to-reservation promotion;
- multi-branch queues;
- predictive machine-learning estimates;
- deposits or waitlist fees;
- offline host-device synchronization.
