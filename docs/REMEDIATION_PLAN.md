# Restaurant Production Remediation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Tracking branch:** `agent/p0-hardening`  
> **Created:** 2026-07-30  
> **Last reconciled:** 2026-07-31  
> **Current milestone:** P0 — Critical security and financial integrity  
> **Latest green implementation commit:** `706d55deec612a51afd9c4371b47e47d29caf9dd`

---

## How this document is used

This file is the source of truth for remediation work. A task is complete only after its acceptance criteria and relevant tests pass.

### Status notation

- `[ ]` Open
- `[x]` Completed and validated
- `Partial` Implemented for the current supported flow, with explicitly listed follow-up work
- `Blocked` Waiting on an environment, operator action, or independent decision
- `Deferred` Intentionally moved to a later milestone

### Priority definitions

| Priority | Meaning |
| --- | --- |
| **P0** | Critical exposure or data/financial-integrity risk. Production use remains blocked until the release gate is complete. |
| **P1** | Major correctness, reliability, workflow, or architecture work. |
| **P2** | UX, accessibility, SEO, maintainability, observability, and polish. |

---

## Milestone summary

| Milestone | Scope | Status |
| --- | --- | --- |
| P0-A | Emergency containment and unsafe-behavior removal | Completed and validated |
| P0-B | Staff authentication, persisted sessions, RBAC, CSRF, audit | Completed for implemented flows; final coverage review remains under P0-E |
| P0-C | Server-authoritative ordering, payment containment, KDS outbox | Completed for supported cash/order flows; final coverage review remains under P0-E |
| P0-D | Privacy-safe access, cash/inventory containment, safe initialization | Completed and validated |
| P0-E | Test matrix and production release gate | In progress |
| P1-A | Database and financial-model correctness | In progress — migrations and cash capture ledger completed |
| P1-B | Restaurant workflow correctness | Not started |
| P1-C | KDS, analytics, and operational reliability | In progress — KDS outbox completed |
| P2-A | Public/admin UX, locale, SEO, accessibility | Not started |
| P2-B | Engineering quality, CI, observability, deployment docs | In progress |

---

# P0 — Critical security and financial integrity

## Validated CI baseline

On commit `706d55deec612a51afd9c4371b47e47d29caf9dd`:

- **P0 Validation #279** passed locked install, Prisma validation/generation, TypeScript, unit tests, ESLint, and production build.
- **P0 Integration #114** passed clean-database migration deployment, representative existing-data adoption, PIN migration/check, authentication/session smoke tests, authorization matrix, order integrity, tracking redaction, KDS outbox delivery, and cash payment-ledger checks.

## P0 exit criteria

- [x] No administrative page or mutation relies only on browser state for authorization.
- [x] Employee PINs are not returned by APIs and operational databases store verifiers rather than recoverable digits.
- [x] Protected API handlers validate a server-side persisted session and role.
- [x] Public endpoints return allowlisted customer-safe fields.
- [x] Order prices, modifiers, discounts, tax, fees, tips, and totals are calculated server-side.
- [x] Order creation is atomic and idempotent.
- [x] Order references are collision-resistant, unique, and separate from primary keys.
- [x] The production seed HTTP endpoint is removed.
- [x] Cash and inventory mutations require explicit permissions.
- [ ] Complete every originally planned P0 test case listed in P0-E, not only the current green suite.
- [x] TypeScript errors are enforced during production builds.
- [ ] Complete the protected real-data rehearsal, production worker setup, and independent security review.

---

## P0-A — Emergency containment

### P0-A01 Remove exposed quick-login credentials

- [x] Remove quick-login PIN buttons from `AdminLogin`.
- [x] Remove hardcoded credentials from rendered production UI/client bundles.
- [x] Keep demo credentials only in explicit development seed data.
- [x] Ensure production UI never displays working credentials.

### P0-A02 Stop exposing employee credentials and sensitive records

- [x] Replace unauthenticated employee enumeration with protected safe DTOs.
- [x] Never return PIN verifiers or session-token material.
- [x] Restrict wage, email, and phone fields to authorized staff administration.
- [x] Separate kitchen/public staff-display data from administrative employee data.
- [x] Prove unauthenticated callers receive `401` and unauthorized roles receive `403`.

### P0-A03 Disable unrestricted administrative mutations

- [x] Add shared fail-closed server guards.
- [x] Protect settings writes.
- [x] Protect menu/category/modifier writes.
- [x] Protect employee creation/update/delete and clock endpoints.
- [x] Protect kitchen-screen and station writes.
- [x] Protect KDS status mutations.
- [x] Protect order administrative mutations.
- [x] Protect table/floor mutations, separating operational status changes from manager-only layout changes.
- [x] Protect inventory, waste, and purchase-order mutations.
- [x] Protect cash drawer mutations.
- [x] Protect offers, promos, dynamic pricing, testimonials, feedback administration, and newsletter administration.
- [x] Protect reports and analytics.

### P0-A04 Stop accepting arbitrary database fields

- [x] Remove direct mass-assignment patterns from hardened write routes.
- [x] Define strict allowlisted schemas for protected/public mutations.
- [x] Reject unknown or invalid keys with safe `400` responses.
- [x] Normalize validation errors into stable API responses.

### P0-A05 Restore build safety

- [x] Remove TypeScript build-error suppression.
- [x] Add a dedicated `typecheck` command.
- [x] Fix TypeScript errors exposed by strict checking.
- [x] Restore strict production builds.
- [x] Run meaningful lint checks in CI.

---

## P0-B — Authentication, sessions, and authorization

### P0-B01 Replace client-side PIN authentication

- [x] Add a server-side login endpoint.
- [x] Look up only eligible active employees server-side.
- [x] Derive and verify a peppered memory-hard PIN verifier.
- [x] Never compare credentials in the browser.
- [x] Return generic invalid-credential responses.
- [x] Use constant-time comparisons where applicable.

### P0-B02 Migrate plaintext PINs to verifiers

Final design: the existing `pin` column is retained for zero-downtime compatibility, but secure rows contain only a verifier.

- [x] Remove operational dependence on plaintext PIN values.
- [x] Add controlled migration tooling for existing employees.
- [x] Hash development seed PINs during seed execution/migration.
- [x] Add a verifier-check command that fails when plaintext/invalid values remain.
- [x] Ensure API responses, audit metadata, and logs do not expose PINs or verifiers.

### P0-B03 Add secure persisted sessions

- [x] Use an HTTP-only, Secure-in-production, SameSite cookie.
- [x] Sign session tokens and persist a server-side session record.
- [x] Enforce absolute expiry and idle timeout.
- [x] Rotate the session identifier on login.
- [x] Revoke sessions on logout.
- [x] Revoke affected sessions on PIN change, role change, deactivation, and deletion.
- [x] Add a safe session-profile endpoint.
- [x] Remove sensitive authentication state from localStorage/Zustand persistence.

### P0-B04 Login abuse protection and recovery

- [x] Add shared per-source rate limiting.
- [x] Add shared per-attempted-identity limiting/temporary lockout behavior.
- [x] Record login security events without credentials.
- [x] Avoid user enumeration in messages and response structure.
- [x] Add a local interactive owner/admin PIN recovery command that revokes sessions and audits recovery.
- [ ] Add a database-backed integration test that deliberately reaches and releases the lockout threshold.

### P0-B05 Role-based access control

- [x] Define shared staff roles and role groups.
- [x] Define permissions for staff, menu, settings, cash, inventory, reporting, orders, KDS, reservations, and tables.
- [x] Add shared authenticated-session and role guards.
- [x] Apply permission checks inside API handlers.
- [x] Filter frontend navigation/actions using the same role policy.
- [x] Add a representative database-backed authorization matrix.
- [ ] Expand the matrix so every protected mutation has an explicit allowed-role and denied-role assertion.

### P0-B06 CSRF and browser-request protection

- [x] Protect state-changing cookie-authenticated requests from cross-site submission.
- [x] Validate same-origin or explicitly configured trusted origins.
- [x] Reject cross-site Fetch Metadata.
- [x] Require JSON content types for body-bearing JSON mutations.
- [x] Keep SameSite cookies as defense in depth.

### P0-B07 Security audit log

- [x] Add an append-only audit-event model and migration.
- [x] Record actor, role, session, action, entity, request ID, source hash, user agent, metadata, and timestamp.
- [x] Bound/redact metadata recursively.
- [x] Audit implemented settings, menu, employee, role/PIN, order, table, payment, cash, inventory, and waste flows.
- [x] Prevent audit update/delete through application APIs.
- [x] Restrict audit reads to owner/admin roles.
- Deferred: refund, void, processor callback, and other future privileged flows must emit audit events when implemented.

---

## P0-C — Server-authoritative order and pricing engine

### P0-C01 Minimal public order request

- [x] Accept only order type, customer input, table/delivery selection, notes, item IDs, quantities, modifier IDs, course, tip selection, and promo code.
- [x] Reject client-authoritative subtotal, tax, fees, discounts, total, payment state, and unit/line prices.
- [x] Reject invalid quantities, malformed lines, unavailable items, and unknown IDs.
- [x] Enforce practical line/payload limits.

### P0-C02 Server-side pricing

- [x] Load current item prices from the database.
- [x] Validate modifier ownership, required groups, minimums, and maximums.
- [x] Calculate modifier prices server-side.
- [x] Validate active dynamic-pricing rules.
- [x] Validate promo status, dates, and eligibility.
- [x] Calculate discounts, tax, delivery, tips, and total server-side.
- [x] Use shared integer-cent calculations and rounding.
- [x] Return authoritative quote/order values.

### P0-C03 Payment-state integrity

- [x] Public orders begin unpaid.
- [x] Public callers cannot mark orders paid.
- [x] Cash confirmation requires an authorized cashier/manager-compatible role.
- [x] Record successful cash capture as an immutable `PaymentEvent` separate from order fields.
- [x] Prevent loyalty effects from an untrusted client total.
- [x] Fail closed for card and split payment until those workflows exist.

### P0-C04 Collision-safe order references

- [x] Remove count-based order-number generation.
- [x] Use random date-prefixed references with a database uniqueness constraint.
- [x] Keep the internal primary key separate from the human-readable reference.
- [x] Handle uniqueness conflicts safely.
- [x] Add concurrent distinct-order reference coverage.
- [x] Document that references are non-sequential and do not use a branch/day reset counter.

### P0-C05 Idempotent order submission

- [x] Require a bounded idempotency key.
- [x] Map the key deterministically to the internal order identity.
- [x] Return the original result for safe retries.
- [x] Prevent duplicate orders from double-clicks/reconnects/concurrent retries.
- [ ] Define and document an explicit long-term idempotency retention policy.

### P0-C06 Atomic order transaction

- [x] Create order and items atomically.
- [x] Link/create the customer atomically where applicable.
- [x] Resolve and validate the table server-side.
- [x] Update table state in the order transaction.
- [x] Write audit and KDS outbox records in the same transaction.
- [x] Publish realtime KDS delivery only after commit.
- [ ] Add a forced mid-transaction failure test proving every related write rolls back.

### P0-C07 Reliable KDS event delivery

- [x] Add an outbox record inside order/KDS transactions.
- [x] Deliver after commit.
- [x] Retry failed delivery with attempts, backoff, leases, and error visibility.
- [x] Support safe concurrent workers using database locking.
- [x] Authenticate the internal worker endpoint.
- [x] Keep bounded polling fallback.
- [x] Test realtime delivery through a KDS mock.
- Blocked: configure the production scheduler and queue monitoring in the target environment.

### P0-C08 State-transition rules

- [x] Define valid order transitions.
- [x] Define valid order-item transitions.
- [x] Reject invalid jumps and unknown states.
- [x] Record completion/fired/ready timestamps for implemented transitions.
- [x] Require appropriate roles for implemented completion/cancellation operations.
- Deferred: refund, void, recall, and manager-approval workflows are P1.

---

## P0-D — Privacy, initialization, cash, and sensitive operations

### P0-D01 Remove production seed HTTP access

- [x] Remove/disable `/api/seed`.
- [x] Remove fallback seed secrets and query-string secret usage.
- [x] Keep explicit CLI development seeding.
- [x] Commit a migration-based production initialization path.
- [x] Document clean-database and existing-database bootstrap procedures.

### P0-D02 Privacy-safe order tracking

- [x] Require an exact reference plus an opaque signed credential.
- [x] Reject prefix/partial lookup.
- [x] Return a customer-safe tracking DTO.
- [x] Exclude private customer, staff, internal financial/database, and token fields.
- [x] Apply shared rate limiting.

### P0-D03 Reservation privacy

- [x] Allow public creation through a strict schema.
- [x] Prevent public reservation listing.
- [x] Require an opaque resource credential for customer access.
- [x] Require reservation roles for staff listing/management.
- [x] Separate public/customer and staff responses.
- [ ] Add HTTP integration coverage proving one reservation token cannot access another reservation.

### P0-D04 Waitlist privacy

- [x] Allow public joining through a strict schema.
- [x] Prevent public queue/phone enumeration.
- [x] Require an opaque resource credential for customer status.
- [x] Require host/manager-compatible roles for queue management.
- [ ] Add HTTP integration coverage proving one waitlist token cannot access another entry.

### P0-D05 Protect analytics and reports

- [x] Require reporting roles.
- [x] Expose no business aggregates publicly.
- [x] Bound supported query ranges and result limits in hardened endpoints.

### P0-D06 Cash containment

- [x] Require cash roles for reads/writes.
- [x] Validate movement type and positive bounded amount.
- [x] Derive actor identity from the session.
- [x] Calculate balance from the full authoritative ledger.
- [x] Audit manual movements and cash capture.
- [x] Make payment event, order state, table state, cash entry, and audit write atomic.
- [x] Prove checkout replay does not duplicate capture or drawer sale.

### P0-D07 Inventory containment

- [x] Require inventory roles.
- [x] Reject invalid waste quantities.
- [x] Remove generic arbitrary PATCH behavior from hardened inventory writes.
- [x] Make waste logging and stock reduction atomic.
- [x] Prevent waste from reducing stock below zero.
- [x] Audit inventory and waste changes.

### P0-D08 Error and log safety

- [x] Stop returning raw database exceptions to public callers.
- [x] Use stable codes and safe messages.
- [x] Add request IDs.
- [x] Avoid logging PINs, session/customer access tokens, full customer payloads, or secrets.
- [x] Disable production Prisma query logging by default.

---

## P0-E — Validation and release gate

### P0-E01 Focused tests

- [ ] Add focused pricing calculation tests.
- [ ] Add modifier ownership/required/min/max tests.
- [ ] Add promo eligibility/date-limit tests.
- [ ] Add tax/delivery/tip rounding boundary tests.
- [x] Test representative order transitions.
- [x] Test role policy and representative API permission boundaries.
- [x] Test tracking DTO redaction.
- [ ] Test shared login rate-limit and lockout behavior against PostgreSQL.

### P0-E02 Database-backed integration tests

- [x] Login creates a persisted secure session.
- [x] Logout revokes the session.
- [x] Unauthenticated protected resources return `401`.
- [x] Representative authenticated-but-unauthorized operations return `403`.
- [x] Employee PIN/private authentication fields cannot be enumerated.
- [x] Tampered order financial fields are rejected.
- [x] Concurrent distinct orders receive unique references.
- [x] Duplicate idempotency keys do not create duplicate orders.
- [ ] Force an order-side-effect failure and prove the transaction rolls back.
- [x] Order tracking cannot be accessed without the matching credential.
- [ ] Add cross-customer reservation and waitlist HTTP isolation tests.

### P0-E03 End-to-end/API smoke tests

- [x] Staff login and logout.
- [ ] Authorized menu mutation with persisted audit verification.
- [ ] Customer orders an item with configured required/optional modifiers.
- [x] KDS receives durable/realtime events and polling remains available.
- [x] Kitchen/order item progression follows valid transitions.
- [x] Customer tracks an order with the opaque credential.
- [x] Cashier/admin-compatible role captures cash payment and replay is safe.

### P0-E04 Release gate

- [x] Locked dependency install passes.
- [x] Prisma schema validation and generation pass.
- [x] `bun run lint` passes.
- [x] `bun run typecheck` passes.
- [x] Current committed unit/integration suites pass.
- [x] `bun run build` passes without ignored errors.
- [x] Migrations deploy successfully to a clean PostgreSQL database in CI.
- [x] Baseline adoption and additive migrations preserve representative legacy data in CI.
- [ ] Rehearse against a protected copy of the real deployment database and verify restore/rollback.
- [ ] Configure production KDS worker scheduling and monitoring.
- [ ] Complete all open P0-E test cases above.
- [ ] Complete an independent security-focused review.
- [ ] Perform and document the controlled production post-deployment smoke test.

---

# P1 — Correctness, workflows, and architecture

## P1-A — Database and financial-model correctness

### P1-A01 Replace floating-point money

- [ ] Convert persisted monetary values to `Decimal` or smallest-unit integers.
- [ ] Define currency precision and rounding rules.
- [ ] Migrate existing values safely.
- [ ] Add serialization helpers.

### P1-A02 Commit and enforce Prisma migrations

- [x] Stop ignoring `prisma/migrations/`.
- [x] Commit a pre-P0 baseline migration.
- [x] Use `prisma migrate deploy` in production procedures.
- [x] Reserve `db push` for controlled development.
- [x] Add clean and existing-data migration checks to CI.
- [x] Document backup, baseline adoption, and rollback procedures.

### P1-A03 Add domain enums and constraints

- [ ] Order type/status.
- [ ] Order-item status.
- [ ] Payment status/method/event type.
- [ ] Employee role.
- [ ] Table status/shape/section.
- [ ] Reservation and waitlist status.
- [ ] Cash movement type.
- [ ] Kitchen screen type/layout.
- [ ] Inventory movement type.
- [ ] Promotion type.

### P1-A04 Fix timestamp semantics

- [ ] Use `@updatedAt` on mutable records where appropriate.
- [ ] Add explicit event timestamps for business events.
- [ ] Standardize UTC storage and restaurant-timezone presentation.

### P1-A05 Payment, refund, and void ledger

- [x] Add immutable successful cash-capture events.
- [ ] Support split payments.
- [ ] Support refunds tied to original payments/order lines.
- [ ] Support void reasons and manager approval.
- [x] Prevent destructive deletion of financially relevant orders.
- [ ] Reconcile order payment state from the full event ledger.

### P1-A06 Branch/tenant boundaries

- [ ] Decide single restaurant versus multi-branch architecture.
- [ ] Add branch ownership where required.
- [ ] Scope sessions, references, tables, settings, staff, inventory, reports, and KDS.
- [ ] Add isolation tests.

### P1-A07 Indexes and retention

- [ ] Review indexes for orders, customers, reservations, KDS, inventory, audit, and reports.
- [ ] Add pagination to large lists.
- [ ] Define retention/anonymization for customer, session, rate-limit, outbox, payment, and audit data.

---

## P1-B — Restaurant workflow correctness

### P1-B01 Cash register sessions

- [ ] Add register/device identity and opening float.
- [ ] Assign cashier/opening time.
- [ ] Link sales, refunds, pay-ins, payouts, and drops.
- [ ] Calculate expected closing balance.
- [ ] Record actual count/discrepancy and manager approval.
- [ ] Prevent edits to closed sessions.

### P1-B02 Employee timekeeping

- [ ] Add immutable time entries and breaks.
- [ ] Support audited manager corrections.
- [ ] Calculate hours from entries.
- [ ] Define overnight-shift/timezone behavior.

### P1-B03 Recipe and stock ledger

- [ ] Add recipes/BOMs and units/conversions.
- [ ] Add immutable stock movements.
- [ ] Consume/reverse stock based on configured production/refund policy.
- [ ] Add receiving and adjustment workflows.
- [ ] Define negative-stock policy.

### P1-B04 Purchase orders

- [ ] Add lines, suppliers, and terms.
- [ ] Add draft/submitted/received/cancelled workflow.
- [ ] Support partial receiving and stock receipts.
- [ ] Preserve price/quantity history.

### P1-B05 Waste workflow

- [ ] Add unit/cost/approval semantics.
- [ ] Produce stock movements and cost impact.
- [ ] Report by ingredient, reason, branch, and employee.

### P1-B06 Reservation availability engine

- [ ] Respect opening hours, holidays, closures, capacity, overlap, and duration.
- [ ] Support unassigned capacity planning.
- [ ] Complete cancellation/no-show/seated/completed behavior.

### P1-B07 Waitlist engine

- [ ] Improve estimates using capacity, party size, reservations, and turnover.
- [ ] Complete notify/confirm/seat/cancel/no-show transitions.
- [ ] Add notification expiry and compatible-table assignment.

### P1-B08 Loyalty and gift cards

- [ ] Grant/reverse points from trusted paid/refund events.
- [ ] Add immutable point transactions.
- [ ] Secure gift-card redemption and concurrency.

---

## P1-C — KDS, analytics, and operational reliability

### P1-C01 Production-ready KDS transport

- [ ] Finalize deployable realtime topology and service authentication.
- [ ] Support multiple instances, reconnect/resubscribe, health checks, and metrics.
- [x] Keep bounded polling fallback.
- [x] Add a durable transactional outbox and authenticated retry endpoint.
- [ ] Configure final production worker/runtime topology.

### P1-C02 Correct KDS totals and state

- [x] Replace client-side “latest 200” order counting with a redacted aggregate in the KDS endpoint.
- [ ] Use restaurant timezone for operational-day boundaries.
- [ ] Complete course/hold/fire/recall/bump workflows and audits.

### P1-C03 Correct revenue analytics

- [ ] Recognize revenue from paid/completed payment events according to policy.
- [ ] Deduct refunds/voids and exclude unpaid/cancelled orders.
- [ ] Use database aggregation, bounded ranges, pagination, and restaurant timezone.
- [ ] Read operating hours from settings.

### P1-C04 Background jobs and outbox processing

- [x] Add durable, idempotent KDS outbox processing with retries and visibility.
- [ ] Add dead-letter policy and alert thresholds.
- [ ] Extend durable jobs to notifications, email/SMS, and analytics rollups.

### P1-C05 Backup and recovery

- [ ] Define automated production backups and recovery targets.
- [ ] Test restore using the actual deployment provider.
- [ ] Define point-in-time recovery expectations.
- [ ] Protect uploaded assets/configuration.

---

# P2 — UX, accessibility, SEO, maintainability, and polish

## P2-A — Public and admin experience

### P2-A01 Real routes and navigation

- [ ] Add proper public routes, deep links, Back/Forward behavior, loading/error states, and code splitting.

### P2-A02 Dynamic branding

- [ ] Remove remaining template branding and apply configured identity to public, admin, KDS, tracking, receipts, metadata, and social previews.

### P2-A03 Server-aware English/Arabic locale

- [ ] Use a URL segment/server-readable cookie, correct server `lang`/`dir`, localized metadata/errors/receipts, and complete RTL verification.

### P2-A04 Accessibility

- [ ] Complete labels, accessible names, semantic navigation, focus states, dialog behavior, reduced motion, contrast, keyboard, and screen-reader testing.

### P2-A05 Error/loading/offline behavior

- [ ] Improve server-error presentation, duplicate-submit prevention, retries, empty states, KDS degradation, and POS/KDS offline strategy.

### P2-A06 Opening-hours correctness

- [ ] Add weekday/holiday/overnight exceptions, restaurant timezone, and shared order/reservation evaluation.

### P2-A07 Admin information architecture

- [ ] Unify admin layouts and improve tablet/mobile workflows, navigation, fetch duplication, empty states, and confirmations.

### P2-A08 Receipts and printing

- [ ] Add configurable A4/receipt layouts, bilingual RTL output, tax/discount/payment details, and audited reprints where required.

---

## P2-B — Engineering quality and operations

### P2-B01 Meaningful lint rules

- [ ] Re-enable remaining high-value rules and document narrow exceptions.

### P2-B02 Test and CI pipeline

- [x] Add unit-test command.
- [x] Add database-backed integration-test command/workflow.
- [ ] Add browser end-to-end tests.
- [x] Run install, migrations, typecheck, tests, lint, and build in GitHub Actions.
- [ ] Configure required branch-protection checks.
- [ ] Add dependency and secret scanning.

### P2-B03 Observability

- [x] Add request IDs and actor/session correlation foundations.
- [ ] Add structured logging, error monitoring, metrics, readiness endpoints, and alerting.

### P2-B04 Performance

- [ ] Add pagination, safe caching/invalidation, image optimization, bundle review, and controlled query profiling.

### P2-B05 Deployment documentation

- [x] Document required environment variables without real secrets.
- [x] Document migration, KDS worker, privileged recovery, bootstrap, backup, and rollback procedures.
- [ ] Document final supported Bun/Node/PostgreSQL versions and provider-specific deployment steps.

### P2-B06 Dependency and configuration cleanup

- [ ] Remove unused auth/SDK dependencies.
- [ ] Enforce one package-manager/lockfile strategy.
- [ ] Validate security headers, CSP, cache, and image-host configuration.

---

# Planned implementation sequence

## Change set 1 — Tracking and containment

- [x] Create this remediation plan and tracking branch.
- [x] Remove exposed PIN UI, employee enumeration, `/api/seed`, and production query logging.
- [x] Add fail-closed protection to administrative mutations.

## Change set 2 — Authentication foundation

- [x] Add PIN verifiers and migration/check tooling.
- [x] Add persisted login/session/logout.
- [x] Remove sensitive browser auth state.
- [x] Add shared login rate limiting and privileged recovery.

## Change set 3 — Authorization and validation

- [x] Add shared role definitions and guards.
- [x] Add strict schemas and safe DTOs.
- [x] Apply authorization across protected APIs.
- [x] Add the append-only audit foundation.

## Change set 4 — Order integrity

- [x] Add server pricing and strict order requests.
- [x] Add safe references, idempotency, and atomic creation.
- [x] Add immutable cash payment events.
- [x] Add durable KDS outbox delivery.

## Change set 5 — Privacy and sensitive operations

- [x] Add signed tracking/reservation/waitlist access.
- [x] Protect reports, cash, inventory, table, and KDS data.
- [x] Normalize safe errors/logging.

## Change set 6 — P0 validation and release

- [x] Add current unit, integration, authorization, migration, KDS, and payment checks.
- [ ] Complete the open test cases in P0-E.
- [ ] Rehearse with a protected copy of the real database and verify rollback.
- [ ] Configure production KDS retry operations.
- [ ] Complete security review and controlled deployment smoke test.

---

# Recorded decisions

- [x] Authentication/session strategy: signed cookie plus persisted revocable PostgreSQL session.
- [x] PIN strategy: deterministic peppered scrypt verifier retained in the existing column for compatibility.
- [x] Session lifetime: configurable absolute TTL and idle timeout.
- [x] Permission strategy: shared central role groups used by API guards and frontend visibility.
- [x] CSRF strategy: origin + Fetch Metadata + JSON content type + SameSite cookie.
- [x] Money calculation strategy: integer cents for authoritative calculations; persisted Float migration deferred to P1.
- [x] Order reference format: date-prefixed random unique reference, non-sequential.
- [ ] Idempotency retention policy.
- [ ] Revenue recognition and refund policy.
- [ ] Loyalty earning/reversal policy.
- [ ] Single-location versus multi-branch scope.
- [ ] Restaurant timezone and operational-day boundary.
- [x] KDS reliability strategy: transactional outbox, authenticated retries, realtime delivery, polling fallback.
- [ ] Final realtime deployment topology and notification providers.
- [ ] Production backup, restore, and recovery targets.

---

# Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-30 | Created remediation roadmap and P0 tracking branch. | Initial repository audit. |
| 2026-07-31 | Implemented containment, authentication, persisted sessions, RBAC, CSRF protection, authoritative ordering, privacy controls, audit trail, migrations, KDS outbox, cash payment events, and CI integration suites. | P0 Validation #279 and P0 Integration #114 green on `706d55d`. |
| 2026-07-31 | Reconciled the tracker with validated work and kept uncovered acceptance cases and production-only gates open. | Compared committed code/tests with the original P0 checklist. |
