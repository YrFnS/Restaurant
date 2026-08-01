# Restaurant Production Remediation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Tracking branch:** `agent/p0-hardening`  
> **Created:** 2026-07-30  
> **Last reconciled:** 2026-07-31  
> **Current milestone:** P0 release operations, followed by P1 architecture/workflows  
> **Validated source/test checkpoint:** `a83f81fd29133d379a3341dac7aa503126fa524e`  
> **Automated/source P0:** **Complete**  
> **Production release:** **Blocked by the operator and independent-review gates in P0-E04.**

---

## How this document is used

This file is the source of truth for the remediation backlog. A source task is complete only after its acceptance criteria and relevant automated checks pass. Environment-specific release tasks remain open until they are completed against the real deployment topology and recorded here.

### Status notation

- `[ ]` Open
- `[x]` Completed and validated
- `Blocked` Waiting on environment/operator action or independent review
- `Deferred` Intentionally moved to a later milestone

### Priority definitions

| Priority | Meaning |
| --- | --- |
| **P0** | Critical security, privacy, or financial-integrity work. Automated/source work is complete; production remains blocked by the release gates. |
| **P1** | Major correctness, workflow, reliability, and architecture work. |
| **P2** | UX, accessibility, SEO, maintainability, observability, performance, and polish. |

---

## Milestone summary

| Milestone | Scope | Status |
| --- | --- | --- |
| P0-A | Emergency containment and unsafe-behavior removal | Completed and validated |
| P0-B | Authentication, persisted sessions, RBAC, browser protection, audit | Completed and validated |
| P0-C | Authoritative ordering, cash-payment containment, KDS outbox | Completed and validated for supported flows |
| P0-D | Privacy-safe ownership, initialization, cash/inventory containment | Completed and validated |
| P0-E | Automated validation and production release gate | Automated gate complete; production/operator gates open |
| P1-A | Database and financial-model correctness | In progress — migrations and cash capture ledger completed |
| P1-B | Restaurant workflow correctness | Not started |
| P1-C | KDS, analytics, jobs, backup/recovery | In progress — durable KDS outbox completed |
| P2-A | Public/admin UX, locale, SEO, accessibility | Not started |
| P2-B | Engineering quality, observability, deployment operations | In progress |

---

# P0 — Critical security and financial integrity

## Exact validated baseline

On commit `a83f81fd29133d379a3341dac7aa503126fa524e`:

- **P0 Validation #389** passed locked installation, Prisma validation/generation, TypeScript, focused security unit tests, mutation/read route inventories, ESLint, and production build.
- **P0 Integration #224** passed clean-database migration deployment, representative existing-data baseline adoption, PIN migration/check, the full database-backed P0 integration chain, KDS configuration lifecycle, KDS worker delivery, and payment-ledger verification.

Detailed evidence and the production-only gates are maintained in [`P0_IMPLEMENTATION_STATUS.md`](./P0_IMPLEMENTATION_STATUS.md). Deployment and rollback procedures are maintained in [`P0_DEPLOYMENT_RUNBOOK.md`](./P0_DEPLOYMENT_RUNBOOK.md).

## P0 exit criteria

### Automated/source criteria

- [x] No administrative page or mutation relies only on browser state for authorization.
- [x] Employee PINs are not returned by APIs and operational databases store non-recoverable verifiers.
- [x] Protected API handlers validate a persisted server-side session and allowed role.
- [x] Public/ownership reads are explicitly classified and preserve their filtering, token, rate-limit, and DTO controls.
- [x] Public endpoints return allowlisted customer-safe fields.
- [x] Order prices, modifiers, discounts, tax, fees, tips, and totals are calculated server-side.
- [x] Order creation is atomic, idempotent, and rollback-tested.
- [x] Public order references are collision-resistant and separate from primary keys.
- [x] The production seed HTTP endpoint is removed.
- [x] Cash and inventory mutations require explicit permissions.
- [x] Focused unit, integration, authorization, pricing, modifier, promo, lockout, rollback, ownership, KDS, migration, and payment tests pass.
- [x] TypeScript errors are enforced during production builds.

### Production release criteria

- [ ] Rehearse backup, baseline adoption, migration, verification, and rollback against a protected copy of the real deployment database.
- [ ] Provision and verify independent production secrets, trusted origins, and final service URLs.
- [ ] Configure the KDS outbox schedule, queue monitoring, and repeated-failure incident handling.
- [ ] Complete an independent security-focused review of the final diff and deployment procedure.
- [ ] Perform and document the controlled post-deployment smoke test against the live topology.

---

## P0-A — Emergency containment

### P0-A01 Remove exposed quick-login credentials

- [x] Remove quick-login PIN buttons from `AdminLogin`.
- [x] Remove working credentials from rendered production UI/client bundles.
- [x] Keep demo credentials only in explicit development seed data.
- [x] Ensure production UI never displays credentials.

### P0-A02 Stop exposing employee credentials and sensitive records

- [x] Replace unauthenticated employee enumeration with protected safe DTOs.
- [x] Never return PIN verifiers or session-token material.
- [x] Restrict wage, email, phone, and schedules to authorized staff administration.
- [x] Separate kitchen/public staff-display data from administrative employee data.
- [x] Prove unauthenticated callers receive `401` and unauthorized roles receive `403`.

### P0-A03 Disable unrestricted administrative mutations

- [x] Add shared fail-closed server guards.
- [x] Protect settings, menu, category, modifier, employee, clock, KDS, station, screen, order, table, floor, inventory, waste, purchase-order, cash, pricing, offer, testimonial, feedback-administration, newsletter-administration, reporting, and analytics mutations.
- [x] Separate operational table status permissions from manager-only structural/layout permissions.
- [x] Add a permanent mutation inventory that fails CI for new unclassified synchronous or asynchronous handlers.

### P0-A04 Stop accepting arbitrary database fields

- [x] Remove direct mass assignment from hardened write routes.
- [x] Define strict allowlisted schemas for protected and public mutations.
- [x] Reject unknown/invalid keys with safe `400` responses.
- [x] Normalize validation errors into stable API responses.

### P0-A05 Restore build safety

- [x] Remove TypeScript build-error suppression.
- [x] Add a dedicated `typecheck` command.
- [x] Fix errors exposed by strict checking.
- [x] Restore React Strict Mode and strict production builds.
- [x] Run meaningful lint and production build checks in CI.

---

## P0-B — Authentication, sessions, and authorization

### P0-B01 Replace client-side PIN authentication

- [x] Add a server-side login endpoint.
- [x] Look up only eligible active employees server-side.
- [x] Derive/verify a peppered memory-hard PIN verifier.
- [x] Never compare credentials in the browser.
- [x] Return generic invalid-credential responses.
- [x] Use constant-time comparisons where applicable.

### P0-B02 Migrate plaintext PINs to verifiers

Final design: the existing `pin` column is retained for zero-downtime compatibility, but secure rows contain only a verifier.

- [x] Remove operational dependence on plaintext PIN values.
- [x] Add controlled migration tooling for existing employees.
- [x] Hash development seed PINs during seed execution/migration.
- [x] Add a verifier-check command that fails when plaintext/invalid values remain.
- [x] Ensure API responses, audit metadata, and logs expose neither PINs nor verifiers.

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

- [x] Add shared per-source limiting.
- [x] Add shared per-attempted-identity limiting and temporary lockout.
- [x] Record security-relevant login events without credentials.
- [x] Avoid user enumeration in messages/response structure.
- [x] Add a local interactive owner/admin PIN recovery command that revokes sessions and audits recovery.
- [x] Test lockout threshold, source/identity scoping, fixed-window recovery, successful reset, and audit behavior against PostgreSQL.

### P0-B05 Role-based access control

- [x] Define shared staff roles and role groups.
- [x] Define permissions for staff, menu, settings, cash, inventory, reporting, orders, KDS, reservations, and tables.
- [x] Apply authenticated-session and role checks inside API handlers.
- [x] Filter frontend navigation/actions with the same policy.
- [x] Add a database-backed authorization matrix covering representative anonymous, denied-role, and allowed-role paths.
- [x] Add permanent mutation/read inventories so every route is staff-protected or explicitly classified as reviewed public, ownership-controlled, or internal-secret access.

### P0-B06 CSRF and browser-request protection

- [x] Protect state-changing cookie-authenticated requests from cross-site submission.
- [x] Validate the application origin and explicitly trusted origins.
- [x] Reject cross-site Fetch Metadata.
- [x] Require JSON content types for body-bearing JSON mutations.
- [x] Keep SameSite cookies as defense in depth.

### P0-B07 Security audit log

- [x] Add an append-only audit-event model and migration.
- [x] Record actor, role, session, action, entity, request ID, source hash, user agent, bounded metadata, and timestamp.
- [x] Recursively redact credential-like metadata.
- [x] Audit implemented authentication, employee, clock, settings, dynamic-pricing, menu, KDS configuration, order, cancellation, table, payment, cash, inventory, and waste flows.
- [x] Prevent audit update/delete through application APIs.
- [x] Restrict audit reads to owner/admin roles.
- Deferred: future refund, void, processor-callback, permission-edit, and other privileged flows must emit audit events when implemented.

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
- [x] Calculate discount, tax, delivery, tips, and final total server-side.
- [x] Use shared integer-cent calculations and rounding.
- [x] Enforce minimum delivery order from the authoritative total.
- [x] Return authoritative quote/order values.

### P0-C03 Payment-state integrity

- [x] Public orders begin unpaid.
- [x] Public callers cannot mark orders paid.
- [x] Cash confirmation requires an authorized cash role.
- [x] Record successful cash capture as an immutable `PaymentEvent` separate from order fields.
- [x] Prevent loyalty effects from untrusted client totals.
- [x] Fail closed for card and split payment until complete workflows exist.

### P0-C04 Collision-safe order references

- [x] Remove count-based order-number generation.
- [x] Use random date-prefixed references with a uniqueness constraint.
- [x] Keep the internal primary key separate from the human-readable reference.
- [x] Handle uniqueness conflicts safely.
- [x] Test concurrent distinct-order reference uniqueness.
- [x] Document that references are non-sequential and do not use a reset counter.

### P0-C05 Idempotent order submission

- [x] Require a bounded idempotency key.
- [x] Map it deterministically to the internal order identity.
- [x] Return the original result for safe retries.
- [x] Prevent duplicates from double-clicks, reconnects, and concurrent retries.
- [x] Retention policy: idempotency persists for the lifetime of the non-destructively retained order record; the raw key is not stored, only its deterministic derived identity.

### P0-C06 Atomic order transaction

- [x] Create order and items atomically.
- [x] Link/create the customer atomically where applicable.
- [x] Resolve/validate the table server-side and update its state transactionally.
- [x] Write audit and KDS outbox records in the same transaction.
- [x] Publish realtime KDS delivery only after commit.
- [x] Force a final-side-effect failure and prove order, items, customer, table, audit, and outbox changes roll back and retry safely.

### P0-C07 Reliable KDS event delivery

- [x] Add outbox records inside order/KDS/configuration transactions.
- [x] Deliver only after commit.
- [x] Retry failed delivery with attempts, backoff, leases, and bounded error visibility.
- [x] Support safe concurrent workers using database locking.
- [x] Authenticate the internal worker endpoint.
- [x] Keep bounded polling fallback.
- [x] Test realtime delivery through a KDS mock.
- [x] Test station/screen create, rename, reference cascade, protected delete, audit, and durable-event lifecycle.
- Blocked: configure the production scheduler and queue monitoring in the target environment.

### P0-C08 State-transition rules

- [x] Define valid order and order-item transitions.
- [x] Reject invalid jumps and unknown states.
- [x] Record completion/fired/ready/cancellation timestamps for implemented transitions.
- [x] Require appropriate roles or resource ownership for supported cancellation/completion operations.
- Deferred: refund, void, recall, and manager-approval workflows are P1.

---

## P0-D — Privacy, initialization, cash, and sensitive operations

### P0-D01 Remove production seed HTTP access

- [x] Remove `/api/seed`.
- [x] Remove fallback seed secrets and query-string secret usage.
- [x] Keep explicit CLI development seeding.
- [x] Commit a migration-based production initialization path.
- [x] Document clean-database and existing-database bootstrap procedures.

### P0-D02 Privacy-safe order tracking and cancellation

- [x] Require an exact reference plus an opaque signed credential, or an allowed order-management session.
- [x] Reject prefix/partial lookup.
- [x] Return a customer-safe tracking DTO.
- [x] Exclude private customer, staff, internal database, credential, and payment-state fields from public ownership responses.
- [x] Apply shared rate limiting.
- [x] Restrict the staff fallback to order-management roles.
- [x] Make customer cancellation ownership-controlled, transition-checked, transactional, audited, outbox-backed, and replay-safe.

### P0-D03 Reservation privacy

- [x] Allow public creation through a strict schema.
- [x] Prevent public reservation listing.
- [x] Require an opaque resource credential for customer access/cancellation.
- [x] Require reservation roles for staff listing/management.
- [x] Separate customer-safe and staff responses.
- [x] Prove one reservation token cannot access/cancel another reservation and invalid credentials do not reveal existence.

### P0-D04 Waitlist privacy

- [x] Allow public joining through a strict schema.
- [x] Prevent public queue/phone enumeration; expose only aggregate count without ownership proof.
- [x] Require an opaque resource credential for customer status/cancellation.
- [x] Require host/manager-compatible roles for queue management.
- [x] Prove one waitlist token cannot access/cancel another entry or cross-authorize a reservation resource.

### P0-D05 Protect analytics and reports

- [x] Require reporting roles.
- [x] Expose no business-sensitive aggregates publicly.
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
- [x] Remove generic arbitrary PATCH behavior from hardened writes.
- [x] Make waste logging and stock reduction atomic.
- [x] Prevent waste from reducing stock below zero.
- [x] Audit inventory and waste changes.

### P0-D08 Error, log, and read-route safety

- [x] Stop returning raw database exceptions to public callers.
- [x] Use stable codes and safe messages.
- [x] Add request IDs.
- [x] Avoid logging PINs, session/customer access tokens, full customer payloads, or secrets.
- [x] Disable production Prisma query logging by default.
- [x] Return a minimal non-cacheable health response.
- [x] Return an explicit allowlisted public testimonial DTO.
- [x] Add a permanent read inventory that rejects unclassified reads and authorization-after-database-access regressions.

---

## P0-E — Validation and release gate

### P0-E01 Focused security/domain tests

- [x] PIN verifier and configuration behavior.
- [x] Request-origin/Fetch-Metadata policy.
- [x] Resource-scoped access tokens and tamper detection.
- [x] Deterministic idempotency identity.
- [x] Audit metadata redaction/bounding.
- [x] Rate-limit key derivation.
- [x] Shared role policy.
- [x] Pricing, tax, delivery, tip, promo, dynamic-pricing, and minimum-delivery boundaries.
- [x] Modifier ownership, required/min/max selection, and configured-modifier ordering.
- [x] Shared login lockout and fixed-window recovery against PostgreSQL.
- [x] API mutation authorization inventory.
- [x] API read authorization/privacy inventory.

### P0-E02 Database-backed integration tests

- [x] Login creates a persisted secure session and logout revokes it.
- [x] Unauthenticated protected resources return `401`.
- [x] Representative authenticated-but-unauthorized operations return `403`.
- [x] Employee PIN/private authentication fields cannot be enumerated.
- [x] Tampered order financial fields are rejected.
- [x] Concurrent distinct orders receive unique references.
- [x] Duplicate idempotency keys do not create duplicate orders.
- [x] Forced order-side-effect failure rolls back every related write and retry succeeds once.
- [x] Order tracking/cancellation requires the matching credential.
- [x] Cross-customer reservation and waitlist isolation is enforced.
- [x] Recent-order/reservation and loyalty lookups are credential scoped.

### P0-E03 API/operational smoke tests

- [x] Staff login, session lookup, logout, and revocation.
- [x] Authorized menu mutation with persisted audit verification.
- [x] Customer ordering with configured modifiers.
- [x] KDS receives durable/realtime events and polling remains available.
- [x] Kitchen/order-item progression follows valid transitions.
- [x] KDS station/screen configuration lifecycle and reference safety.
- [x] Customer tracks and cancels through opaque ownership credentials.
- [x] Cash capture and replay-safe immutable payment ledger.
- [x] Clean-database migration deployment.
- [x] Representative existing-data baseline adoption and preservation.

### P0-E04 Production release gate

- [x] Locked dependency install passes.
- [x] Prisma schema validation/generation pass.
- [x] `bun run lint` passes.
- [x] `bun run typecheck` passes.
- [x] Focused unit and full database-backed integration suites pass.
- [x] `bun run build` passes without ignored errors.
- [x] Migrations deploy successfully to a clean PostgreSQL database in CI.
- [x] Baseline adoption/additive migrations preserve representative legacy data in CI.
- [ ] Rehearse against a protected copy of the real deployment database and verify restore/rollback.
- [ ] Provision/verify production secrets, trusted origins, and service URLs.
- [ ] Configure production KDS worker scheduling, monitoring, and alert handling.
- [ ] Complete an independent security-focused review.
- [ ] Perform/document the controlled production post-deployment smoke test.

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
- [x] Add clean/existing-data migration checks to CI.
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

- [x] Record the current P0 scope as a single restaurant.
- [ ] Decide whether multi-branch support is required.
- [ ] Add branch ownership/scoping where required.
- [ ] Add tenant-isolation tests.

### P1-A07 Indexes and retention

- [ ] Review indexes for orders, customers, reservations, KDS, inventory, audit, payments, sessions, and reports.
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

- [ ] Add restaurant timezone and operational-day policy.
- [ ] Respect weekday hours, holidays, closures, capacity, overlap, and duration.
- [ ] Support unassigned capacity planning and optimized table allocation.
- [ ] Complete cancellation/no-show/seated/completed behavior and notifications.

### P1-B07 Waitlist engine

- [ ] Improve estimates using capacity, party size, reservations, and turnover.
- [ ] Complete notify/confirm/seat/cancel/no-show transitions.
- [ ] Add notification expiry and compatible-table assignment.

### P1-B08 Loyalty and gift cards

- [ ] Define earning/reversal policy from trusted paid/refund events.
- [ ] Add immutable point transactions.
- [ ] Secure gift-card redemption and concurrency.

---

## P1-C — KDS, analytics, and operational reliability

### P1-C01 Production-ready KDS transport

- [x] Add transactional outbox, authenticated retry endpoint, and bounded polling fallback.
- [ ] Finalize deployable realtime topology and service authentication.
- [ ] Support shared broker/multiple instances, reconnect/resubscribe, health checks, and metrics.
- [ ] Configure final production worker/runtime topology.

### P1-C02 Correct KDS totals and state

- [x] Replace client-side “latest 200” order counting with a redacted aggregate.
- [ ] Use restaurant timezone for operational-day boundaries.
- [ ] Complete course/hold/fire/recall/bump workflows and audits.

### P1-C03 Correct revenue analytics

- [ ] Define revenue-recognition/refund policy.
- [ ] Recognize revenue from trusted payment/completion events.
- [ ] Deduct refunds/voids and exclude unpaid/cancelled orders.
- [ ] Use database aggregation, bounded ranges, pagination, and restaurant timezone.
- [ ] Read operating hours from settings.

### P1-C04 Background jobs and outbox processing

- [x] Add durable idempotent KDS outbox processing with retries and visibility.
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

- [ ] Add weekday/holiday/overnight exceptions, restaurant timezone, and shared ordering/reservation evaluation.

### P2-A07 Admin information architecture

- [ ] Unify admin layouts and improve tablet/mobile workflows, navigation, fetch duplication, empty states, and confirmations.

### P2-A08 Receipts and printing

- [ ] Add configurable A4/receipt layouts, bilingual RTL output, tax/discount/payment details, and audited reprints where required.

---

## P2-B — Engineering quality and operations

### P2-B01 Meaningful lint rules

- [ ] Re-enable remaining high-value rules and document narrow exceptions.

### P2-B02 Test and CI pipeline

- [x] Add focused unit tests.
- [x] Add database-backed integration tests/workflows.
- [x] Add mutation and read route-inventory regression tests.
- [ ] Add browser end-to-end tests.
- [x] Run locked install, migrations, typecheck, tests, lint, and build in GitHub Actions.
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

# Implementation sequence

## Change set 1 — Tracking and containment

- [x] Create the remediation plan and P0 branch.
- [x] Remove exposed PIN UI, employee enumeration, HTTP seed access, and production query logging.
- [x] Add fail-closed protection to administrative mutations.

## Change set 2 — Authentication foundation

- [x] Add PIN verifiers and migration/check tooling.
- [x] Add persisted login/session/logout and revocation.
- [x] Remove sensitive browser auth state.
- [x] Add shared login limiting and privileged recovery.

## Change set 3 — Authorization and validation

- [x] Add shared roles/guards.
- [x] Add strict schemas and safe DTOs.
- [x] Apply authorization across protected APIs.
- [x] Add append-only audit events.
- [x] Add permanent mutation/read route inventories.

## Change set 4 — Order integrity

- [x] Add server pricing and strict order requests.
- [x] Add safe references, idempotency, rollback-tested atomic creation, and ownership cancellation.
- [x] Add immutable cash payment events.
- [x] Add durable KDS outbox delivery and configuration lifecycle protection.

## Change set 5 — Privacy and sensitive operations

- [x] Add signed order/reservation/waitlist ownership access and cross-customer isolation.
- [x] Protect reports, cash, inventory, table, and KDS data.
- [x] Normalize safe errors/logging and public read DTOs.

## Change set 6 — P0 validation and release

- [x] Complete repository-level automated P0 validation.
- [ ] Rehearse with a protected copy of the real database and verify rollback.
- [ ] Provision production secrets/topology and configure KDS retry operations.
- [ ] Complete independent review and controlled deployment smoke test.

---

# Recorded decisions

- [x] Authentication/session strategy: signed cookie plus persisted revocable PostgreSQL session.
- [x] PIN strategy: deterministic peppered scrypt verifier retained in the legacy column for migration compatibility.
- [x] Session lifetime: bounded configurable absolute TTL and idle timeout.
- [x] Permission strategy: shared central role groups used by API guards and frontend visibility.
- [x] CSRF strategy: origin + Fetch Metadata + JSON content type + SameSite cookie.
- [x] Money calculation strategy: integer cents for authoritative calculations; persisted Float migration deferred to P1.
- [x] Order reference format: date-prefixed random unique non-sequential reference.
- [x] Idempotency retention: lifetime of the retained order record; raw key is not persisted.
- [ ] Revenue recognition and refund policy.
- [ ] Loyalty earning/reversal policy.
- [x] Current deployment scope: single restaurant; multi-branch remains a P1 decision.
- [ ] Restaurant timezone and operational-day boundary.
- [x] KDS reliability strategy: transactional outbox, authenticated retries, realtime delivery, polling fallback.
- [ ] Final realtime deployment topology and notification providers.
- [ ] Production backup, restore, point-in-time recovery, and alert targets.

---

# Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-30 | Created remediation roadmap and P0 tracking branch. | Initial repository audit. |
| 2026-07-31 | Implemented containment, authentication, persisted sessions, RBAC, browser protection, authoritative ordering, privacy controls, audit trail, migrations, KDS outbox, and cash payment events. | Progressive P0 CI runs. |
| 2026-07-31 | Added pricing/modifier/promo/lockout/rollback/ownership/KDS-configuration tests, shared public limits, route inventories, explicit public DTOs, and final tracker reconciliation. | P0 Validation #389 and P0 Integration #224 green on `a83f81f`. |
| 2026-07-31 | Marked automated/source P0 complete while retaining real-database, production configuration, scheduler/monitoring, independent review, and live smoke gates. | Reconciled against committed code, tests, workflows, status report, and deployment runbook. |
