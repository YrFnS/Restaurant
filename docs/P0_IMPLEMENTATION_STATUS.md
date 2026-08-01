# P0 Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p0-hardening`  
> **Draft PR:** `#1`  
> **Validated source/test checkpoint:** `a83f81fd29133d379a3341dac7aa503126fa524e`  
> **Validated:** 2026-07-31  
> **Automated/source P0 status:** **Complete and green**  
> **Production release status:** **Blocked pending the operator and independent-review gates below.**

This document is the validated implementation companion to [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md). The roadmap retains the full P1/P2 backlog; this file records the exact P0 behavior proved by the repository's automated gates and separates it from work that can only be completed against the real deployment topology.

## Exact green validation baseline

The following GitHub Actions runs passed on the exact source/test checkpoint above:

- **P0 Validation #389**
- **P0 Integration #224**

### P0 Validation #389

Passed:

- locked dependency installation
- Prisma schema validation
- Prisma client generation
- strict TypeScript checking
- all focused security unit tests
- API mutation authorization inventory
- API read authorization/privacy inventory
- ESLint
- production build without ignored TypeScript errors

The validation workflow has read-only repository permissions and validates committed source without rewriting it.

### P0 Integration #224

The clean-database job passed:

- deployment of all committed migrations to an empty PostgreSQL 16 database
- representative development seeding
- employee PIN migration and verifier validation
- production build and standalone-server startup
- the complete database-backed P0 integration chain

The existing-data job also passed:

- recreation of the pre-P0 schema and representative legacy data
- adoption of the committed baseline migration
- deployment of every additive P0 migration
- preservation of every tracked legacy model count
- preservation of representative employee, order, customer, menu-item, and settings records
- migration of plaintext employee PINs to non-recoverable verifiers
- verification that the audit, session, rate-limit, outbox, and payment-event tables are usable

## Completed and validated source-level P0 scope

### Emergency containment and build safety

- Removed visible quick-login credentials and browser-side employee enumeration.
- Removed the production HTTP seed endpoint and predictable URL-secret bootstrap path.
- Disabled production Prisma query logging except errors.
- Removed TypeScript build-error suppression and restored React Strict Mode.
- Added locked install, Prisma validation, typecheck, unit, integration, lint, migration, and production-build gates.
- Added safe request IDs and stable public error codes/messages across hardened routes.
- Replaced the placeholder API response with a minimal non-cacheable health response.

### Staff authentication, sessions, and recovery

- Staff PIN authentication occurs only on the server.
- Employee PINs are stored as deterministic, peppered, memory-hard verifiers; the legacy column name remains only for migration compatibility.
- Existing plaintext PINs have controlled migration and verification commands.
- Login failures are generic and do not reveal employee identity or credential state.
- Login throttling and lockout use shared PostgreSQL counters scoped by request source and attempted credential identity.
- Successful authentication creates a signed HTTP-only cookie backed by a persisted session record.
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

### Authorization, route inventories, and safe DTOs

- One shared role-policy module is used by server guards and frontend navigation.
- Protected APIs enforce permissions independently of page visibility.
- Administrative, reporting, cash, inventory, KDS, reservation, order, table, menu, and staff operations fail closed.
- Operational table-status changes are separated from manager-only floor/layout changes.
- Kitchen users receive a redacted KDS DTO instead of full financial/customer order records.
- Strict allowlisted schemas replace arbitrary request-body assignment.
- Employee responses never return PIN verifiers or session tokens.
- The database-backed authorization matrix proves representative `401`, `403`, and allowed-role paths.
- A permanent mutation inventory discovers synchronous and asynchronous route handlers and fails CI when a new mutation lacks a staff guard or an explicitly reviewed ownership/public/internal-secret policy.
- A permanent read inventory fails CI when a new read is unclassified, when a protected read accesses the database before authorization, or when reviewed public/ownership reads lose required filtering, rate limiting, token checks, or DTO controls.

### Server-authoritative ordering and pricing

- Customer and POS clients submit selections rather than authoritative totals.
- Current item and modifier prices are loaded server-side.
- Required modifiers, option ownership, minimums, maximums, and malformed selections are enforced.
- Active dynamic-pricing and promo rules are evaluated server-side, including date and status boundaries.
- Tax, delivery, discounts, tips, and totals are calculated through integer-cent utilities with boundary tests.
- Unknown fields, unavailable items, invalid quantities, and client financial/payment fields are rejected.
- Minimum delivery order is enforced from the authoritative calculated amount.
- Public orders always begin unpaid.
- Order creation requires an idempotency key and derives a deterministic internal identity.
- Safe retries return the original result instead of creating duplicate orders.
- Human-readable order references are random, date-prefixed, unique, and separate from primary keys.
- Order, items, customer linkage, table state, audit event, and KDS outbox event are committed atomically.
- A forced final-side-effect failure test proves the complete transaction rolls back and can be retried safely.
- Invalid order and order-item state transitions are rejected.
- Destructive deletion of financially relevant orders/items is disabled.

### Durable KDS delivery and configuration

- Order creation and KDS/order status mutations write outbox events inside the same transaction as the business change.
- Immediate delivery is attempted only after commit.
- Failed events remain queued with retry time, attempt count, lease state, and bounded error details.
- Workers claim rows safely with database locking and support concurrent instances.
- The internal worker endpoint requires a constant-time-compared bearer secret.
- The worker reports stable `processed`, `delivered`, and `failed` counters.
- Polling remains a display fallback.
- Integration tests use a realtime mock and verify successful delivery and outbox state.
- Station and screen create/update/delete operations are authorized, audited, and delivered through the durable outbox.
- Station slug changes cascade exact screen/menu references transactionally.
- Referenced stations cannot be deleted.
- The complete station/screen lifecycle is now part of `test:integration` and passed in P0 Integration #224.

### Payment and cash containment

- Cash checkout requires an authorized staff session and trusts the stored order total.
- Tendered cash and change are validated server-side.
- A successful checkout creates one immutable `PaymentEvent`, one cash-drawer sale, the order payment update, table update, and one audit event in one transaction.
- Payment idempotency prevents duplicate successful captures and duplicate drawer entries.
- Card and split-payment paths fail closed until their providers and full workflows are implemented.
- Manual cash mutations require explicit roles, positive bounded amounts, server-derived actors, and audit events.
- Cash balance is calculated from the authoritative ledger rather than only the latest rows.

### Customer privacy and ownership isolation

- Order tracking requires the exact order reference plus a resource-scoped signed credential, or an authorized order-management session.
- Kitchen/host roles cannot use the staff tracking fallback.
- Tracking responses are allowlisted and exclude private customer, payment, database, and token fields.
- Customer cancellation requires the matching order credential and is transactional, audited, rate-limited, and replay-safe.
- Reservation and waitlist ownership use resource-specific opaque credentials.
- Reservation credentials cannot authorize waitlist resources and vice versa.
- Cross-customer read/cancel attempts receive non-enumerating responses.
- Recent-order, recent-reservation, loyalty, promo, quote, tracking, cancellation, reservation, waitlist, feedback, newsletter, clock, and login public paths use shared limits where appropriate.
- Public callers cannot list reservation, waitlist, employee, customer-phone, or full business order data.
- Business analytics and reports require reporting roles.

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
  - employee creation/update/deletion and clock events
  - settings and dynamic-pricing changes
  - menu/category/item price and availability changes
  - KDS station/screen lifecycle changes
  - order creation, customer cancellation, and order-status changes
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

## Automated test matrix now covered

### Focused unit tests

- PIN validation, verifier creation, verification, and configuration behavior
- request-origin/Fetch-Metadata policy
- resource-scoped order/reservation/waitlist access tokens and tamper detection
- deterministic order identity from idempotency keys
- audit metadata redaction and bounding
- rate-limit key derivation
- shared role policy
- complete API mutation authorization inventory
- complete API read authorization/privacy inventory

### Database-backed integration tests

- `p0-smoke.ts`: login/session/logout, safe employees, authoritative ordering, idempotency, unique references, outbox creation, signed tracking, cash checkout, and revocation
- `p0-authorization-matrix.ts`: representative anonymous, administrative, operational, reporting, inventory, cash, table, and kitchen boundaries
- `p0-login-lockout.ts`: threshold, credential/source scoping, fixed-window recovery, successful reset, and audit behavior
- `p0-pricing.ts`: subtotal, tax, delivery, tips, promos, dynamic pricing, and minimum-delivery boundaries
- `p0-shared-public-limits.ts`: shared PostgreSQL throttling across reviewed public endpoints
- `p0-menu-modifiers.ts`: required/optional modifier ownership and selection bounds, configured-modifier ordering, and audited menu mutation
- `p0-order-rollback.ts`: forced transactional rollback and safe retry
- `p0-customer-order-cancel.ts`: ownership, rate limiting, transition, table release, audit, outbox, and replay behavior
- `p0-customer-isolation.ts`: cross-resource and cross-customer reservation/waitlist isolation
- `p0-recent-owned.ts`: resource-token-scoped recent lookups and loyalty access
- `p0-kds-config.ts`: station/screen create, rename, reference cascade, protected delete, audit, and durable-event lifecycle
- `p0-kds-worker.ts`: internal worker authentication, processing, delivery, and cleared error state
- `p0-payment-ledger.ts`: immutable capture, amounts, idempotency, cash-drawer link, and audit link
- `p0-existing-data-rehearsal.ts`: representative baseline adoption, data preservation, and verifier migration

## Recorded P0 implementation decisions

- **Authentication:** custom server-side PIN login with persisted revocable sessions.
- **PIN storage:** scrypt-derived deterministic verifier with a deployment-only pepper; the legacy column name is retained for safe rollout, but it contains no recoverable PIN after migration.
- **Session policy:** eight-hour default absolute lifetime and thirty-minute default idle lifetime, configurable within bounded limits.
- **Authorization:** shared role policy enforced in API handlers and reflected in frontend navigation.
- **CSRF/browser policy:** allowed-origin validation, Fetch Metadata, JSON content-type enforcement, and SameSite cookies.
- **Order identity:** deterministic internal ID from the idempotency key plus a separate date-prefixed random public reference.
- **Money calculation:** integer cents for authoritative calculations; migration of every persisted legacy `Float` column is deferred to P1.
- **KDS reliability:** transactional PostgreSQL outbox with authenticated retry worker and polling fallback.
- **Payment containment:** immutable cash capture events; card, refund, void, and split flows remain disabled or deferred until their complete ledgers/workflows exist.
- **Deployment scope:** current implementation remains single-restaurant; multi-branch tenancy is a separate P1 architecture decision.

## Remaining production release gates

These cannot be honestly closed by repository CI alone.

### 1. Protected copy of the real deployment database

An operator must:

- take and verify a restorable backup
- restore a recent real deployment copy into isolation
- record deployment-specific row-count and sentinel checks
- follow the baseline-adoption procedure exactly
- run migration deploy, PIN migration/check, production build, and operational smoke tests
- rehearse rollback from the verified backup

### 2. Production secrets and topology

Provision independent production values for session signing, PIN peppering, order/customer access, rate-limit hashing, and the KDS worker. Verify trusted origins, database URLs, application URLs, and realtime service URLs against the final topology.

### 3. KDS scheduler and monitoring

Configure a trusted scheduler to invoke the authenticated outbox worker at least once per minute. Add queue-growth and repeated-failure monitoring plus an incident response path.

### 4. Independent security-focused review

A reviewer other than the implementer should inspect the final diff, role matrix, public-route classifications, migration adoption procedure, production settings, and rollback plan before the PR is marked ready.

### 5. Controlled production deployment smoke test

After deployment, verify login/logout/revocation, authorized administration, public order placement, KDS progression, signed tracking, customer cancellation, cash capture/payment ledger, reservation/waitlist ownership, audit records, and worker execution against the live topology.

## Explicitly deferred beyond P0

These remain important and are tracked in P1/P2 while unsupported high-risk paths fail closed:

- Decimal/smallest-unit migration for all persisted monetary columns
- complete refund, void, card, and split-payment workflows
- register opening/closing sessions and reconciliation
- immutable recipe/stock movement ledger
- multi-branch tenancy and isolation
- production realtime broker/topology beyond the durable outbox and bounded polling fallback
- broader reservation capacity optimization and wait-time prediction
- accessibility, route architecture, SEO, observability, performance, and general UX work

## Current release gate

| Gate | Status |
| --- | --- |
| Locked dependency install | Passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| TypeScript | Passed |
| Focused security unit tests | Passed |
| API mutation inventory | Passed |
| API read/privacy inventory | Passed |
| ESLint | Passed |
| Production build | Passed |
| Clean-database migration deployment | Passed in CI |
| Representative existing-data adoption | Passed in CI |
| PIN migration and verifier check | Passed in both CI paths |
| Database-backed P0 integration chain | Passed |
| Authorization matrix | Passed |
| Pricing/modifier/promo/rollback/isolation cases | Passed |
| KDS configuration, outbox worker, and realtime delivery | Passed |
| Payment-ledger replay checks | Passed |
| Automated/source P0 gate | **Complete** |
| Protected real-deployment database rehearsal | Open — operator action |
| Production secrets/topology verification | Open — operator action |
| Production KDS scheduler and monitoring | Open — operator action |
| Independent security review | Open |
| Controlled production deployment smoke test | Open — operator action |

The automated/source P0 implementation is complete at the validated checkpoint. Keep PR #1 in draft and do not deploy until every production release gate above is completed and documented.
