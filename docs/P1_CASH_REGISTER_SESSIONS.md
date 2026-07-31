# P1 Cash-Register Sessions

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-cash-register-sessions`  
> **Stacked base:** `agent/p1-data-integrity`  
> **Scope:** register identity, open/close lifecycle, cash reconciliation, and ledger linkage

## Purpose

The existing cash drawer was a restaurant-wide list of movements. A sale, payout, or cash drop had no register identity, no cashier shift, no opening float, no closing count, and no immutable reconciliation record. This slice makes every new explicit-register cash operation belong to one serialized open session.

## Data model

### CashRegister

A register represents one configured cash terminal or device assignment.

- unique register code;
- unique device identity;
- display name and location;
- active/inactive state;
- exact discrepancy-approval threshold in currency minor units.

### CashRegisterSession

A session records the operational lifetime of an open drawer.

- one open session per register;
- exact opening float;
- opening cashier identity and timestamp;
- idempotent opening key;
- open or closed state;
- immutable opening data;
- immutable after closing.

### CashRegisterClose

A close record is an append-only reconciliation result.

- exact expected cash;
- exact counted cash;
- signed discrepancy;
- threshold captured at close time;
- approval requirement and approving manager;
- approval reason when required;
- closing cashier, note, and timestamp;
- one immutable close record per session;
- idempotent closing key.

### Ledger linkage

`CashDrawerEntry` and `PaymentEvent` receive nullable `registerSessionId` links. Existing rows remain valid. New register-aware writes link both the drawer movement and payment event to the same open session.

## Concurrency and integrity rules

The database, not the browser, enforces the lifecycle:

1. A partial unique index permits only one open session per register.
2. Register opening locks the register row before checking or creating a session.
3. Cash movement, checkout, and close operations lock the open session.
4. A close cannot race a sale or payout; the operations serialize on the same session row.
5. Ledger links can only be assigned while the target session is open.
6. A ledger session link cannot be moved after assignment.
7. Closed sessions cannot be modified or deleted.
8. Close records cannot be modified or deleted.
9. A close record can only be inserted after its session has been closed.
10. The recorded discrepancy must equal counted cash minus expected cash.

## Expected cash

Expected cash is calculated entirely from exact minor-unit values:

```text
opening float
+ pay-ins
+ cash sales
+ opening-float or positive adjustments
- payouts
- refunds
- cash drops
```

The API rejects a close when the movement history would produce a negative expected balance.

## Authorization

- Register provisioning: owner, administrator, or manager.
- Register open, ledger read, cash movement, checkout, and exact close: owner, administrator, manager, or cashier.
- Discrepancy above the register threshold: owner, administrator, or manager, with an approval reason.

Authorization runs before JSON parsing and before database access for protected handlers.

## Device identity

Explicit register operations use:

```text
X-Register-Id
X-Register-Device-Id
```

The register ID and configured device ID must match. A copied register ID is insufficient on a different device identity.

Opening and closing also require a valid `Idempotency-Key` header. Repeating an accepted key returns the original result instead of creating another session or close record.

## API surface

### `GET /api/registers`

Lists configured registers and their current open session for authorized cash staff.

### `POST /api/registers`

Creates a register. Manager-level authorization is required.

### `GET /api/registers/:id/session`

Returns the current open session for the matching device.

### `POST /api/registers/:id/session`

Opens a register with an exact opening float.

### `PATCH /api/registers/:id/session`

Closes and reconciles a register. The request supplies the session ID and counted cash. Large discrepancies require manager approval.

### `GET /api/cash`

With register headers, returns the current session ledger and expected cash. Without headers, it preserves the existing global historical ledger response for administration and backward compatibility.

### `POST /api/cash`

Requires explicit register headers and an open session. The movement is attached to that session.

### `POST /api/pos/checkout`

Cash checkout attaches both its `CashDrawerEntry` and immutable `PaymentEvent` to the locked open register session.

## Compatibility transition

The current POS frontend does not yet persist a register assignment. To avoid breaking the already-green checkout flow during this backend slice, headerless checkout uses a clearly identified compatibility register:

```text
register: LEGACY-WEB-POS
device: legacy-web-pos
opening float: 0
```

The compatibility session is created only when a headerless checkout first needs it and emits a `cash.session.auto-open` audit event. Manual cash movements do **not** receive this fallback; they require an explicitly opened register.

The next UI slice should provision or select a register, persist its device identity locally, require opening before charging, display the live expected balance, and expose the counted-close workflow. Once that UI is deployed and existing terminals are assigned, the compatibility fallback can be removed through a separate reviewed change.

## Validation gate

This branch is complete only when all of the following are green:

- Prisma schema validation and generation;
- strict TypeScript;
- source inventory for tables, triggers, row locks, authorization, and ledger linkage;
- ESLint and production build;
- migration deployment on an empty PostgreSQL database;
- representative legacy-database adoption;
- all P0 and P1 regression suites;
- register provisioning authorization;
- device mismatch rejection;
- idempotent opening and closing;
- one-open-session concurrency behavior;
- checkout and payout linkage;
- cashier exact close;
- manager-approved discrepancy close;
- post-close mutation rejection;
- immutable session and close records;
- required audit events.

## Explicitly deferred

- POS register-selection and opening/closing user interface;
- denomination-by-denomination count sheets;
- safe drops with dual custody;
- card terminal settlement batches;
- split tender;
- refunds and voids;
- multi-location register policy;
- offline register synchronization.
