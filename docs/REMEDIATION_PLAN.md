# Restaurant Production Remediation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Tracking branch:** `agent/p1-loyalty-gift-cards`  
> **Base:** consolidated `main` at waitlist merge `cb65546b9b2216b7dd82ce20a0cf170a1d7e387a`  
> **Created:** 2026-07-30  
> **Last reconciled:** 2026-08-02  
> **Current milestone:** P1 revenue analytics and remaining operational workflows  
> **Automated/source gate:** **Complete for all implemented P0 and P1 slices**  
> **Production release:** **Blocked by real-environment rehearsal, production configuration, independent review, and deployment smoke gates.**

This file is the current master status. Detailed design, policy, migration, and validation evidence remains in the dedicated milestone documents and repository history:

- [`P0_IMPLEMENTATION_STATUS.md`](./P0_IMPLEMENTATION_STATUS.md)
- [`P0_DEPLOYMENT_RUNBOOK.md`](./P0_DEPLOYMENT_RUNBOOK.md)
- [`P1_IMPLEMENTATION_STATUS.md`](./P1_IMPLEMENTATION_STATUS.md)
- [`P1_CASH_REGISTER_SESSIONS.md`](./P1_CASH_REGISTER_SESSIONS.md)
- [`P1_PAYMENT_REVERSALS.md`](./P1_PAYMENT_REVERSALS.md)
- [`P1_STOCK_LEDGER_RECIPES.md`](./P1_STOCK_LEDGER_RECIPES.md)
- [`P1_PURCHASE_ORDERS_RECEIVING.md`](./P1_PURCHASE_ORDERS_RECEIVING.md)
- [`P1_EMPLOYEE_TIMEKEEPING.md`](./P1_EMPLOYEE_TIMEKEEPING.md)
- [`P1_RESERVATION_AVAILABILITY.md`](./P1_RESERVATION_AVAILABILITY.md)
- [`P1_WAITLIST_OPERATIONS.md`](./P1_WAITLIST_OPERATIONS.md)
- [`P1_LOYALTY_GIFT_CARDS.md`](./P1_LOYALTY_GIFT_CARDS.md)

## Status notation

- `[x]` completed and validated
- `[ ]` open
- `Blocked` requires production/operator action
- `Deferred` intentionally moved to a later slice

---

# Milestone summary

| Milestone | Scope | Status |
| --- | --- | --- |
| P0-A | Emergency containment and unsafe-behavior removal | Completed and validated |
| P0-B | Authentication, sessions, RBAC, browser protection, audit | Completed and validated |
| P0-C | Authoritative ordering, cash containment, reliable KDS events | Completed and validated for supported flows |
| P0-D | Customer privacy and sensitive-operation containment | Completed and validated |
| P0-E | Automated validation and production release gate | Automated gate complete; production gates open |
| P1-A | Exact money, domain integrity, payment ledger, reversals | Foundation complete; contract migration deferred |
| P1-B01 | Cash-register sessions and reconciliation | Completed and validated |
| P1-B02 | Immutable employee timekeeping | Completed and validated |
| P1-B03 | Recipes and immutable stock ledger | Completed and validated |
| P1-B04 | Suppliers, purchase orders, and partial receiving | Completed and validated |
| P1-B05 | Waste through immutable stock movements | Core path complete; reporting and approvals open |
| P1-B06 | Restaurant-local reservations and safe table allocation | Completed and validated |
| P1-B07 | Capacity-aware waitlist, table holds, and guest lifecycle | Completed and validated |
| P1-B08 | Loyalty and gift-card ledgers | Completed and validated |
| P1-C | KDS topology, analytics, jobs, backup/recovery | KDS outbox complete; remaining work open |
| P2 | UX, accessibility, SEO, observability, performance | Not started as a coordinated phase |

---

# Consolidated branch history

PRs #1–#10 were merged into `main` in dependency order. The loyalty and gift-card slice branches directly from the merged waitlist foundation:

```text
main @ cb65546b9b2216b7dd82ce20a0cf170a1d7e387a
└── agent/p1-loyalty-gift-cards  (PR #12)
```

Validated checkpoints:

| Slice | Validated head or PR | Evidence |
| --- | --- | --- |
| P0 security and financial integrity | `5c8c2d93fe95f76aaeff7c433b175d8357ebd978` | P0 Validation #393, P0 Integration #228, Vercel check |
| P1 exact money and domain integrity | `55ac63f8ffbc94b0f4daec3936dab78c55bc7685` | Validation #511, Integration #341 |
| P1 cash-register sessions | `c44030bcb222fa78f8c50152dbab81187877e59d` | Validation #558, Integration #388 |
| P1 payment reversals | `87d787b1b39b6ed93caf5493b7fec2911a2c211c` | P1 Stacked Validation #6 |
| P1 recipes and immutable stock ledger | `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d` | P1 Stacked Validation #32 |
| P1 suppliers, purchase orders, and partial receiving | `0e0eab253ed43a42e2d0beb88da97ba8e9a3b633` | P1 Stacked Validation #53 |
| P1 immutable employee timekeeping | `054b096a600782897ef1b6eaf6591326b50fbe58` | P1 Stacked Validation #83 |
| P1 reservation availability and allocation | merged through PR #8 | P0 Validation #793 and P0 Integration #623 |
| P1 capacity-aware waitlist operations | merged through PR #10 | P0 Validation #929 and P0 Integration #759 |
| P1 loyalty and gift-card ledgers | `ec659035f51598c36d1aebb041096e9c1328c05b` | P0 Validation #1084 and P0 Integration #930 |

---

# Production release gates

These remain required even though repository-level gates are green:

- [ ] Rehearse backup, baseline adoption, migration, verification, and rollback against a protected copy of the real deployment database.
- [ ] Provision and verify independent production secrets, trusted origins, database/application URLs, KDS URLs, and worker secrets.
- [ ] Configure authenticated KDS and waitlist worker schedules, monitoring, and repeated-failure handling.
- [ ] Complete an independent security- and data-integrity-focused review of the final release stack.
- [ ] Perform and document controlled post-deployment smoke tests against the real topology.
- [ ] Verify restore and rollback procedures before enabling destructive contract migrations.

---

# P0 — Critical security and financial integrity

Completed source criteria:

- [x] Server-side employee authentication with non-recoverable, peppered PIN verifiers.
- [x] Persisted, revocable, expiring HTTP-only staff sessions.
- [x] Shared role policy enforced by APIs and reflected in navigation.
- [x] Trusted-origin, Fetch Metadata, JSON-content-type, and SameSite browser protections.
- [x] Shared PostgreSQL login and public-endpoint rate limiting.
- [x] Strict schemas, privacy-safe DTOs, and permanent API mutation/read inventories.
- [x] Authoritative server-side pricing, promotions, tax, fees, tips, and totals.
- [x] Atomic, idempotent order creation with rollback and collision coverage.
- [x] Scoped ownership credentials for order, reservation, and waitlist access.
- [x] Immutable audit events for implemented privileged and financial operations.
- [x] Immutable cash-capture events and replay-safe checkout.
- [x] Additive Prisma migrations with clean and representative existing-data rehearsals.
- [x] Durable transactional KDS outbox with authenticated processing and bounded retries.
- [x] Locked install, Prisma validation, TypeScript, tests, lint, and production build in CI.

---

# P1-A — Database and financial-model correctness

## Completed foundation

- [x] Exact scaled-integer fields and deterministic backfill for supported money, rate, wage, and inventory paths.
- [x] First-class exact Prisma fields with safe JSON omission policy.
- [x] PostgreSQL enums, bounds, cross-field constraints, indexes, and mutable timestamp corrections.
- [x] Immutable payment-event ledger with successful cash captures.
- [x] Parent-linked partial/full cash refunds and eligible full-payment voids.
- [x] Manager authorization, reviewed reasons, idempotency, open-register enforcement, and concurrency protection for reversals.

## Open contract work

- [ ] Resolve combo meals, remaining customer lifetime-spend compatibility, special offers, promo administration, and remaining analytics reads before contract migration.
- [x] Add loyalty and gift-card domain constraints together with complete append-only ledgers.
- [ ] Rehearse destructive contract migration against a protected production-like database copy.
- [ ] Remove synchronization triggers and legacy financial `Float` columns only after all runtime dependencies are gone.
- [ ] Define retention and anonymization policy for customer, session, rate-limit, outbox, payment, inventory, timekeeping, waitlist, loyalty, gift-card, and audit data.
- [ ] Decide whether multi-branch support is required and add scoping before expanding beyond one restaurant.

---

# P1-B — Restaurant workflow correctness

## P1-B01 Cash-register sessions

- [x] Register/device identity, opening float, cashier identity, and opening timestamp.
- [x] Register-linked sales, refunds, pay-ins, payouts, drops, and exact expected balance.
- [x] Counted cash, signed discrepancy, configurable threshold, and manager approval.
- [x] One open session per register, row-lock serialization, immutable close records, and persistent POS assignment.
- [ ] Register editing, reassignment, retirement, denomination counts, and dual-custody safe drops.
- [ ] Remove the legacy headerless checkout fallback after every deployed terminal is assigned.

## P1-B02 Employee timekeeping

- [x] Immutable clock, break, shift, and manager-adjustment history.
- [x] One open shift and one open break per employee under concurrency.
- [x] Exact wage and labor-cost snapshots with operational-day and overnight semantics.
- [x] Protected kiosk/manager APIs and bilingual timesheet workflow.
- [ ] Payroll export/locking, overtime policy, schedule variance, leave, geofencing, biometrics, and offline terminals.

## P1-B03 Recipes and immutable stock ledger

- [x] Exact ingredient balances, unit conversion, versioned recipes, and modifier recipe components.
- [x] Immutable opening, receipt, waste, adjustment, production-consumption, and reversal movements.
- [x] Consume stock exactly once at first production and persist the recipe version or permanent untracked decision.
- [x] Explicit negative-stock policy, movement cost snapshots, and database concurrency/immutability constraints.
- [ ] Lots, batches, expiry, serial tracking, multi-location bins, valuation method, transfers, and automatic physical returns.

## P1-B04 Purchase orders

- [x] First-class suppliers and exact purchase-order lines.
- [x] Draft, submitted, partially received, received, and cancelled lifecycle.
- [x] Immutable submitted terms, partial/full receiving, concurrent over-receipt prevention, and reviewed receipt correction.
- [x] Bilingual supplier, ordering, receiving, receipt, and correction workflows.
- [ ] Supplier invoices, AP, approval thresholds, vendor returns, tax, payment scheduling, attachments, and automatic reorder suggestions.

## P1-B05 Waste

- [x] Route new waste through immutable stock movements with unit conversion, exact cost, idempotency, and correction support.
- [ ] Add configurable approval thresholds and role policy.
- [ ] Report waste by ingredient, reason, employee, and operational day.

## P1-B06 Reservation availability

- [x] Restaurant-local timezone conversion and weekly/overnight service periods.
- [x] Full/partial closures, notice, horizon, party-size, duration, turnover, and slot policy.
- [x] Aggregate-only public availability without table or customer disclosure.
- [x] Transactional automatic allocation and staff reassignment with PostgreSQL table-overlap exclusion.
- [x] Ownership-token cancellation cutoff and audited confirmed, seated, completed, cancelled, and no-show lifecycle.
- [x] Bilingual public, calendar, settings, period, and closure workflows.
- [ ] Physical table combinations, customer rescheduling/editing, deposits, cancellation fees, overbooking policy, and provider notifications.

## P1-B07 Waitlist

Completed and validated scope:

- [x] Replace the fixed FIFO quote with capacity-, party-size-, occupancy-, reservation-, turnover-, and queue-aware estimates.
- [x] Simulate one availability lane per physical table and store projected seating time plus estimate timestamp.
- [x] Add idempotent public joins, duplicate-active-phone protection, safe aggregate reads, and scoped ownership credentials.
- [x] Complete notify, confirm, seat, cancel, no-show, and automatic notification-expiry transitions.
- [x] Assign and temporarily hold one compatible open table only when a party is notified.
- [x] Enforce one active notified hold per table and serialize queue changes with advisory and row locks.
- [x] Release holds transactionally after cancellation, no-show, expiry, or seating.
- [x] Recheck reservation conflicts while seating and update the entry and physical table atomically.
- [x] Prevent deletion, capacity reduction, or manual release of a table with an active waitlist hold.
- [x] Add configurable waitlist policy, an authenticated expiry worker, immutable audit events, and privacy-safe customer/staff DTOs.
- [x] Add bilingual customer and host workflows with projected seating, countdowns, confirmation, and lifecycle actions.
- [x] Add additive migrations, legacy-entry adoption, PostgreSQL lifecycle constraints, source inventories, clean-database tests, and complete P0/P1 regression coverage.

Policy decisions:

- Waiting entries have no table assignment; a table hold begins only at notification.
- Estimates are conservative quotes and are recalculated after every queue or capacity change.
- One notified entry may hold one physical table, and one physical table may have only one active waitlist hold.
- Customer confirmation is recorded without adding another active status; staff may require confirmation before seating.
- Historical terminal entries are retained instead of hard-deleted.

Deferred:

- [ ] SMS, email, and messaging-provider delivery or callbacks.
- [ ] Physical table combinations and adjacency.
- [ ] Automatic waitlist-to-reservation promotion.
- [ ] Customer party-size/preference editing after join.
- [ ] Predictive machine-learning estimates, deposits, offline host synchronization, and multi-branch queues.

## P1-B08 Loyalty and gift cards

- [x] Define trusted earning, redemption, adjustment, and reversal policy from successful payment events.
- [x] Add immutable loyalty-point transactions with idempotency, payload binding, and concurrency safety.
- [x] Reconcile earned and redeemed points on refunds and voids without rewriting history.
- [x] Add concurrency-safe gift-card issue, redemption, refund, void, and adjustment transactions.
- [x] Store exact balances and hash-only redemption credentials with one-time secret return.
- [x] Support gift-card-only and gift-card-plus-cash checkout with tender-aware reversals.
- [x] Add manager authorization, audit evidence, privacy-safe public lookup, and bilingual operator/customer workflows.
- [x] Add additive migrations, permanent source inventories, dedicated database integration, and existing-data adoption.

Deferred:

- [ ] Loyalty expiration buckets, promotional multipliers, and automated tier progression.
- [ ] Online processor-funded gift-card purchase, transfer/replacement, offline redemption, and provider delivery.
- [ ] Item-level refund allocation and broader card-processor or multi-card split tender.
- [ ] Multi-branch liability scoping and destructive removal of compatibility balance fields.

---

# P1-C — KDS, analytics, jobs, and recovery

## KDS

- [x] Transactional outbox, authenticated retry endpoint, bounded polling fallback, and safe aggregate reads.
- [ ] Finalize multi-instance realtime topology, broker, service authentication, reconnect behavior, health checks, and metrics.
- [ ] Complete course, hold, fire, recall, bump, and audit workflows.
- [ ] Configure production worker/runtime topology and repeated-failure handling.

## Revenue analytics

- [ ] Define revenue-recognition and operational-day policy.
- [ ] Recognize revenue from trusted payment events and deduct refunds/voids.
- [ ] Exclude unpaid/cancelled orders and use database aggregation with bounded ranges and restaurant timezone.
- [ ] Add reconciliation to cash-register, payment, order, inventory, and labor ledgers.

## Jobs, monitoring, backup, and recovery

- [ ] Add dead-letter policy, alert thresholds, structured logging, metrics, readiness, and error monitoring.
- [ ] Extend durable jobs to provider notifications, email/SMS, and analytics rollups.
- [ ] Define automated production backups, recovery targets, and point-in-time recovery.
- [ ] Test restore and rollback with the actual provider.
- [ ] Protect uploaded assets and production configuration.

---

# P2 — Experience, maintainability, and polish

## Public and admin experience

- [ ] Add real public routes, deep links, Back/Forward behavior, loading/error states, and code splitting.
- [ ] Remove remaining template branding and apply configured identity everywhere.
- [ ] Render English/Arabic locale server-side with correct `lang`, `dir`, metadata, errors, and receipts.
- [ ] Complete accessibility, keyboard, focus, reduced-motion, contrast, and screen-reader testing.
- [ ] Improve retries, offline behavior, empty states, and duplicate-submit handling.
- [ ] Add weekday, holiday, overnight, and timezone-aware opening-hours evaluation.
- [ ] Unify admin layouts and improve tablet/mobile workflows.
- [ ] Add configurable bilingual A4 and receipt printing with audited reprints.

## Engineering and operations

- [x] Focused unit and database-backed integration tests.
- [x] API mutation/read inventories and locked CI install/migration/typecheck/test/lint/build.
- [ ] Browser end-to-end tests.
- [ ] Required branch-protection checks, dependency scanning, and secret scanning.
- [ ] Structured logs, monitoring, metrics, readiness, and alerts.
- [ ] Pagination, safe caching/invalidation, image optimization, bundle review, and query profiling.
- [ ] Final supported Bun/Node/PostgreSQL and provider-specific deployment documentation.
- [ ] Remove unused dependencies and enforce one package-manager strategy.
- [ ] Validate CSP, security headers, cache rules, and image-host configuration.

---

# Recorded decisions

- [x] Authentication uses a signed cookie plus a persisted, revocable PostgreSQL session.
- [x] PINs use peppered memory-hard verifiers retained in the legacy column during migration compatibility.
- [x] Shared role groups are enforced by APIs and reflected in frontend visibility.
- [x] Browser mutations require trusted origin, Fetch Metadata, JSON content type, and SameSite protection.
- [x] Order references are random, date-prefixed, unique, and non-sequential; order creation is idempotent.
- [x] Supported money paths use exact scaled integers while legacy floats remain only during expand/contract migration.
- [x] Cash operations and reversals use immutable parent-linked payment events and open-register effects.
- [x] KDS reliability uses a transactional outbox, authenticated retries, realtime delivery, and polling fallback.
- [x] Current deployment scope is one restaurant.
- [x] Stock consumption occurs on first production entry and stores an immutable recipe version or permanent untracked decision.
- [x] Submitted purchasing terms and receipts are immutable; reviewed corrections reconcile with the stock ledger.
- [x] Timekeeping history is append-only and uses restaurant timezone plus operational-day assignment.
- [x] Reservation occupancy uses restaurant-local input and snapshotted half-open `[startsAt, releaseAt)` ranges.
- [x] Public reservation availability is aggregate-only; customer cancellation is ownership-token scoped and cutoff-controlled.
- [x] Waitlist estimates simulate compatible table capacity, occupancy, reservation ranges, turnover, active holds, and parties ahead.
- [x] A notified waitlist party receives one expiring compatible-table hold; confirmation, seating, cancellation, no-show, and expiry are transactional and audited.
- [x] Loyalty earning, redemption, adjustment, and reversal are driven by successful payment events; expiration remains deferred until explicit FIFO buckets exist.
- [x] Gift-card value is an exact append-only liability ledger with hash-only redemption credentials and tender-aware refunds.
- [ ] Revenue-recognition policy.
- [ ] Multi-branch requirement.
- [ ] Final realtime topology and notification providers.
- [ ] Production backup, restore, point-in-time recovery, and alert targets.

---

# Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-30 | Created remediation roadmap and P0 tracking branch. | Initial repository audit. |
| 2026-07-31 | Completed P0 containment, authentication, RBAC, privacy, authoritative ordering, auditing, migrations, KDS outbox, and CI. | P0 Validation #393 and P0 Integration #228 green at `5c8c2d9`. |
| 2026-07-31 | Added exact storage, domain integrity, cash-register sessions, and immutable payment reversals. | Validation #511/#558 and stacked reversal validation green. |
| 2026-07-31 | Added exact inventory, versioned recipes, immutable stock movements, purchasing, receiving, and reviewed corrections. | P1 Stacked Validation #32 and #53 green. |
| 2026-08-01 | Added immutable employee shifts, breaks, labor snapshots, corrections, and operational-day policy. | P1 Stacked Validation #83 green. |
| 2026-08-01 | Added restaurant-local reservation policy, service periods, closures, safe availability, transactional allocation, lifecycle controls, and bilingual workflows. | P0 Validation #793 and P0 Integration #623 green. |
| 2026-08-01 | Added capacity-aware wait estimates, expiring table holds, customer confirmation, transactional seating/release, bilingual customer/host workflows, authenticated expiry processing, privacy controls, and full regression coverage. | P0 Validation #929 and P0 Integration #759 green on PR #10. |
| 2026-08-01 | Added immutable loyalty events, exact gift-card transactions, stored-value checkout, tender-aware reversals, privacy-safe lookup, and bilingual management/customer workflows. | P0 Validation #1084 and P0 Integration #930 green at `ec659035`. |
