# P0 Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p0-hardening`  
> **Draft PR:** `#1`  
> **Validated implementation commit:** `706d55deec612a51afd9c4371b47e47d29caf9dd`  
> **Last validated:** 2026-07-31  
> **Release decision:** **Blocked — the implemented suite is green, but the remaining P0 acceptance cases and production-only gates must still be completed.**

This document is the implementation companion to [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md). It records what has been implemented and proved by automated checks, and keeps untested acceptance cases distinct from production-only operator work.

## Exact green validation baseline

The following GitHub Actions runs passed on the exact validated implementation commit:

- **P0 Validation #279**
- **P0 Integration #114**

Documentation-only commits after that checkpoint do not change runtime behavior, but their workflows must also remain green before merge.

### P0 Validation #279

Passed:

- locked dependency installation
- Prisma schema validation
- Prisma client generation
- strict TypeScript checking
- focused unit tests
- ESLint
- production build

The validation workflow has read-only repository permissions and validates committed source without rewriting it.

### P0 Integration #114

The clean-database job passed:

- deployment of every committed migration to an empty PostgreSQL 16 database
- representative development seeding
- employee PIN migration and verifier check
- production build and standalone-server startup
- login, persistent session, logout, and revoked-session behavior
- representative anonymous and role-based authorization boundaries
- safe employee and KDS DTO redaction
- server-authoritative order pricing and rejection of financial-field tampering
- concurrent idempotency and unique order-reference behavior
- durable KDS event creation, authenticated worker execution, and realtime delivery
- signed order tracking and response redaction
- atomic cash checkout, replay protection, payment-event creation, cash-drawer linkage, and audit linkage

The existing-data job also passed:

- recreation of the pre-P0 schema and representative legacy data
- adoption of the committed baseline migration
- deployment of all additive P0 migrations
- preservation of every tracked legacy model count
- preservation of representative employee, order, customer, menu-item, and settings records
- migration of plaintext employee PINs to non-recoverable verifiers
- verification that all new P0 tables are usable

## Completed and validated

### Emergency containment and build safety

- Removed visible quick-login credentials and browser-side employee enumeration.
- Removed the production HTTP seed endpoint.
- Disabled production Prisma query logging except errors.
- Removed TypeScript build-error suppression.
- Restored strict typecheck, lint, unit-test, integration-test, migration, and production-build gates.
- Added request IDs and safe public error codes/messages across hardened routes.

### Staff authentication and recovery

- Staff PIN authentication occurs only on the server.
- PINs are stored as deterministic, peppered, memory-hard verifiers rather than recoverable digits.
- Existing plaintext PINs have controlled migration and verification commands.
- Login failures are generic and do not reveal employee identity or credential state.
- Login abuse controls use shared PostgreSQL counters rather than per-process memory.
- Limits are scoped by both request source and attempted credential identity.
- Successful authentication creates a signed, HTTP-only cookie backed by a persisted session record.
- Sessions have absolute expiry, idle expiry, server-side revocation, and identifier rotation.
- Logout revokes the database session; account deactivation, role change, PIN change, and deletion revoke affected sessions.
- Sensitive authentication state is not persisted in Zustand/localStorage.
- Owner/admin PIN recovery is available only through an interactive local CLI that hides input, revokes sessions, and writes an audit event.

### Browser-request protection

- State-changing API requests are filtered centrally.
- Cross-site Fetch Metadata is rejected.
- `Origin` is restricted to the application origin plus explicitly configured trusted origins.
- JSON mutation endpoints reject unsafe body content types.
- SameSite cookies remain defense in depth rather than the only CSRF control.

### Authorization and safe DTOs

- One shared role-policy module is used by server guards and frontend navigation.
- Protected APIs enforce permissions independently of page visibility.
- Administrative, reporting, cash, inventory, KDS, reservation, order, table, menu, and staff operations fail closed.
- Operational table-status changes are separated from manager-only floor/layout changes.
- Kitchen users receive a redacted KDS DTO rather than full financial/customer order records.
- Strict allowlisted schemas replace arbitrary request-body assignment.
- Employee responses never return PIN verifiers or session tokens.
- The database-backed authorization matrix proves representative `401`, `403`, and allowed-role paths.

### Server-authoritative ordering

- Customer and POS clients submit selections rather than authoritative totals.
- Current item and modifier prices are loaded server-side.
- Modifier ownership and selection bounds are enforced by the pricing service.
- Active dynamic-pricing and promo rules are evaluated server-side.
- Tax, delivery, discounts, tips, and totals are calculated through integer-cent utilities.
- Unknown fields, unavailable items, invalid quantities, malformed selections, and client financial fields are rejected.
- Public orders always begin unpaid.
- Order creation requires an idempotency key and derives a deterministic internal identity.
- Safe retries return the original result instead of creating duplicate orders.
- Human-readable order references are random, date-prefixed, unique, and separate from primary keys.
- Order, items, customer linkage, table state, audit event, and KDS outbox event are committed atomically.
- Invalid order and order-item state transitions are rejected.
- Destructive deletion of financially relevant orders/items is disabled.

### Durable KDS delivery

- Order creation and KDS/order status mutations write outbox events inside the same transaction as the business change.
- Immediate delivery is attempted only after commit.
- Failed events remain queued with retry time, attempt count, lease state, and bounded error details.
- Workers claim rows safely with database locking and support concurrent instances.
- The internal worker endpoint requires a constant-time compared bearer secret.
- The worker reports stable `processed`, `delivered`, and `failed` counters.
- Polling remains a display fallback.
- Integration tests use a realtime mock and verify successful delivery and outbox state.

### Payment and cash containment

- Cash checkout requires an authorized staff session and trusts the stored order total.
- Tendered cash and change are validated server-side.
- A successful checkout creates one immutable `PaymentEvent`, one cash-drawer sale, the order payment update, table update, and one audit event in one transaction.
- Payment idempotency prevents duplicate successful captures and duplicate drawer entries.
- Card and split-payment paths fail closed until their providers and workflows are implemented.
- Manual cash mutations require explicit roles, positive bounded amounts, server-derived actors, and audit events.
- Cash balance is calculated from the authoritative ledger rather than only the latest rows.

### Customer privacy

- Order tracking requires the exact order reference plus a resource-scoped signed credential.
- Tracking responses are allowlisted and exclude private customer, payment, database, and token fields.
- Reservation and waitlist ownership use resource-specific opaque credentials.
- Public callers cannot list reservation, waitlist, employee, or phone-number order data.
- Business analytics and reports require reporting roles.
- Public endpoints and tracking operations use shared rate limits where appropriate.

### Inventory containment

- Inventory reads and mutations require explicit inventory roles.
- Ingredient writes use strict schemas.
- Waste quantities must be positive and cannot exceed available stock.
- Waste logging and stock reduction are atomic.
- Inventory mutations and waste adjustments create audit records.

### Append-only audit trail

- `AuditEvent` has a committed additive migration and no update/delete API.
- Audit records contain actor, role, session, action, entity, request ID, source hash, user agent, timestamp, and bounded/redacted metadata.
- Audit writes are part of the protected transaction for implemented privileged and financial flows, including:
  - successful login and privileged PIN recovery
  - employee creation/update/deletion
  - settings changes
  - menu creation, deletion, price, availability, and category changes
  - order creation and order-status changes
  - table operational and layout changes
  - cash checkout and manual cash movements
  - ingredient and waste changes
- Only owner/admin roles can read audit events.

### Migration discipline

- `prisma/migrations/` is committed and no longer ignored.
- A pre-P0 baseline migration is committed.
- Additive migrations are committed for audit events, persistent sessions, shared rate limits, KDS outbox events, and payment events.
- Production uses `prisma migrate deploy`; `db push` remains for controlled development only.
- CI proves clean-database deployment and representative existing-data baseline adoption.
- Backup, first-adoption, rollback, KDS worker, and privileged-recovery procedures are documented in [`P0_DEPLOYMENT_RUNBOOK.md`](./P0_DEPLOYMENT_RUNBOOK.md).

## Remaining P0 blockers

### 1. Complete the original automated acceptance matrix

The current suite is green, but these planned cases are still open:

- focused pricing calculations and monetary rounding boundaries
- required/optional modifier ownership, minimum, and maximum selection tests
- promo eligibility and date-boundary tests
- database-backed login lockout threshold/recovery behavior
- an explicit forced order-transaction rollback test
- cross-customer reservation-token HTTP isolation
- cross-customer waitlist-token HTTP isolation
- an authorized menu mutation smoke test with audit verification
- a customer order containing configured modifiers rather than the current simple no-required-modifier item
- broader allowed/denied assertions for every protected mutation, beyond the current representative authorization matrix

### 2. Rehearse against a protected copy of the real deployment database

The representative existing-data CI rehearsal is green, but the operator must still:

- take and verify a restorable backup
- restore a recent real production-like copy into isolation
- record row-count and sentinel checks appropriate to that deployment
- follow the baseline-adoption procedure exactly
- run `db:deploy`, PIN migration/check, production build, and operational smoke tests
- rehearse rollback from the verified backup

### 3. Provision and verify production secrets

Independent production values must be configured for session signing, PIN peppering, customer/order access, rate-limit hashing, and the KDS worker. Trusted origins and service URLs must match the final topology.

### 4. Configure the KDS retry schedule and monitoring

The authenticated worker endpoint is implemented and tested. Production still needs a trusted scheduler, queue-growth monitoring, and incident handling for repeated delivery failures.

### 5. Complete an independent security-focused review

A reviewer should inspect the final diff, role matrix, migration adoption procedure, production settings, and operational rollback plan before the PR is marked ready or deployed.

### 6. Perform the controlled post-deployment smoke test

After deployment, verify login/logout/revocation, authorized administration, public order placement, KDS progression, signed tracking, cash capture/payment ledger, reservation/waitlist access, audit records, and worker execution against the live topology.

## Explicitly deferred beyond P0

These items remain important but are tracked as P1/P2 while currently unsupported paths fail closed:

- Decimal/smallest-unit storage migration for all persisted monetary columns
- full refund, void, card, and split-payment workflows
- register opening/closing sessions and reconciliation
- immutable stock movement/recipe ledger
- multi-branch tenancy decision and isolation
- final production realtime topology beyond the durable outbox and polling fallback
- broader accessibility, routing, observability, performance, and UX work

## Current release gate

| Gate | Status |
| --- | --- |
| Locked dependency install | Passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| TypeScript | Passed |
| Current focused unit tests | Passed |
| ESLint | Passed |
| Production build | Passed |
| Clean-database migration deployment | Passed in CI |
| Representative existing-data adoption rehearsal | Passed in CI |
| PIN migration and verifier check | Passed in both CI paths |
| Database-backed authentication/order smoke suite | Passed |
| Representative authorization matrix | Passed |
| KDS outbox worker and realtime delivery | Passed |
| Payment-ledger replay checks | Passed |
| Remaining original P0 test cases | Open |
| Protected real-data backup/restore rehearsal | Open — operator action |
| Production KDS scheduler and monitoring | Open — operator action |
| Independent security review | Open |
| Controlled production deployment smoke test | Open |

The branch is substantially hardened and the committed suite is green. P0 remains open until the missing acceptance cases and production gates above are completed and documented.