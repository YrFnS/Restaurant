# Restaurant Production Remediation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Tracking branch:** `agent/p1-purchase-orders-receiving`  
> **Created:** 2026-07-30  
> **Last reconciled:** 2026-07-31  
> **Current milestone:** P1 restaurant workflow correctness — timekeeping, reservations, waitlist, and loyalty  
> **Automated/source P0:** **Complete**  
> **Production release:** **Blocked by real-environment rehearsal, configuration, independent review, and deployment smoke gates.**

This is the master roadmap. Detailed implementation evidence remains in the dedicated milestone documents:

- [`P0_IMPLEMENTATION_STATUS.md`](./P0_IMPLEMENTATION_STATUS.md)
- [`P0_DEPLOYMENT_RUNBOOK.md`](./P0_DEPLOYMENT_RUNBOOK.md)
- [`P1_IMPLEMENTATION_STATUS.md`](./P1_IMPLEMENTATION_STATUS.md)
- [`P1_CASH_REGISTER_SESSIONS.md`](./P1_CASH_REGISTER_SESSIONS.md)
- [`P1_PAYMENT_REVERSALS.md`](./P1_PAYMENT_REVERSALS.md)
- [`P1_STOCK_LEDGER_RECIPES.md`](./P1_STOCK_LEDGER_RECIPES.md)
- [`P1_PURCHASE_ORDERS_RECEIVING.md`](./P1_PURCHASE_ORDERS_RECEIVING.md)

## Status notation

- `[x]` completed and validated
- `[ ]` open
- `Blocked` requires deployment/operator action
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
| P1-A | Database, exact money, constraints, payment ledger | Exact-money foundation and cash reversals complete; contract migration deferred |
| P1-B01 | Cash-register sessions and reconciliation | Completed and validated |
| P1-B03 | Recipes and immutable stock ledger | Completed and validated |
| P1-B04 | Suppliers, purchase orders, and partial receiving | Completed and validated |
| P1-C | KDS, analytics, jobs, backup/recovery | KDS outbox complete; remaining work open |
| P2 | UX, accessibility, SEO, observability, performance | Not started as a coordinated phase |

---

# Validated branch stack

The work is intentionally stacked and must be reviewed or merged in order:

```text
main
└── agent/p0-hardening
    └── agent/p1-data-integrity
        └── agent/p1-cash-register-sessions
            └── agent/p1-payment-reversals
                └── agent/p1-stock-ledger-recipes
                    └── agent/p1-purchase-orders-receiving
```

Validated completed checkpoints:

| Slice | Validated head | Evidence |
| --- | --- | --- |
| P0 security and financial integrity | `5c8c2d93fe95f76aaeff7c433b175d8357ebd978` | P0 Validation #393, P0 Integration #228, Vercel check |
| P1 exact money and domain integrity | `55ac63f8ffbc94b0f4daec3936dab78c55bc7685` | Validation #511, Integration #341 |
| P1 cash-register sessions | `c44030bcb222fa78f8c50152dbab81187877e59d` | Validation #558, Integration #388 |
| P1 payment reversals | `87d787b1b39b6ed93caf5493b7fec2911a2c211c` | P1 Stacked Validation #6 |
| P1 recipes and immutable stock ledger | `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d` | P1 Stacked Validation #32 |
| P1 suppliers, purchase orders, and partial receiving | `432d02814528db9097eee3595658b6953d30f669` | P1 Stacked Validation #46 |

---

# P0 — Critical security and financial integrity

## P0 source criteria

- [x] Replace browser-side PIN checks with server-side verification.
- [x] Store non-recoverable, peppered PIN verifiers.
- [x] Use persisted, revocable, expiring HTTP-only sessions.
- [x] Enforce shared role policy inside APIs and reflect it in navigation.
- [x] Add browser-origin, Fetch Metadata, JSON-content-type, and SameSite protections.
- [x] Add shared PostgreSQL login and public-endpoint rate limiting.
- [x] Protect administrative reads and mutations with strict schemas and safe DTOs.
- [x] Add permanent API mutation and read/privacy inventories.
- [x] Calculate order prices, modifiers, promotions, tax, fees, tips, and totals server-side.
- [x] Make order creation atomic, idempotent, rollback-tested, and collision-safe.
- [x] Add signed ownership credentials for order, reservation, and waitlist access.
- [x] Add immutable audit events for implemented privileged and financial operations.
- [x] Add immutable cash-capture events and replay-safe checkout.
- [x] Add committed Prisma migrations with clean and representative existing-data rehearsals.
- [x] Add a durable KDS transactional outbox, authenticated worker, retries, and polling fallback.
- [x] Enforce TypeScript, focused tests, lint, and production build in CI.

## P0 production release gates

- [ ] Rehearse backup, baseline adoption, migration, verification, and rollback against a protected copy of the real deployment database.
- [ ] Provision and verify independent production secrets, trusted origins, database/application URLs, and KDS service URLs.
- [ ] Configure the authenticated KDS worker schedule, queue monitoring, and repeated-failure handling.
- [ ] Complete an independent security-focused review of the final stack and deployment procedure.
- [ ] Perform and document the controlled post-deployment smoke test against the real topology.

---

# P1-A — Database and financial-model correctness

## P1-A01 Exact financial storage

- [x] Define exact scales for currency, wages, rates, percentages, and unit costs.
- [x] Add scaled-integer exact columns and deterministic legacy backfill.
- [x] Keep compatibility values synchronized during expand/application-cutover stages.
- [x] Make exact fields first-class Prisma fields for supported workflows.
- [x] Prevent accidental `BigInt` JSON exposure through shared omission policy.
- [x] Use exact values for authoritative menu pricing, modifiers, tax, delivery, promotions, dynamic pricing, tips, orders, checkout, cash, wages, and ingredient unit costs.
- [x] Add exact-value constraints, verification tooling, runtime tests, and write-path inventory.
- [ ] Resolve gift cards, purchase orders, combo meals, customer lifetime spend, special offers, promo administration, and remaining analytics reads before contract migration.
- [ ] Rehearse the destructive contract migration against a protected production-like copy.
- [ ] Remove synchronization triggers and legacy financial `Float` columns only after all runtime dependencies are gone.

## P1-A02 Domain enums, constraints, timestamps, and indexes

- [x] Convert order, order-item, payment, employee-role, table, reservation, waitlist, cash, KDS, and dynamic-pricing controlled values to enums.
- [x] Add fail-fast migration preflight for unknown legacy values.
- [x] Add cross-field bounds and concurrency-safe partial uniqueness.
- [x] Correct mutable `updatedAt` behavior and preserve immutable event timestamps.
- [x] Add indexes for common order, reservation, kitchen, cash, employee, payment, session, and outbox paths.
- [x] Add inventory movement, unit conversion, recipe, production-consumption, and stock-ledger constraints and indexes.
- [ ] Add purchase-order and loyalty domain constraints with their complete workflows.
- [ ] Define restaurant timezone and operational-day semantics.
- [ ] Define retention/anonymization policy for customer, session, rate-limit, outbox, payment, inventory, and audit data.

## P1-A03 Payment ledger and reversals

- [x] Add immutable successful cash-capture events.
- [x] Link captures to exact cash-register sessions.
- [x] Add parent-linked partial/full cash refunds.
- [x] Add eligible full-payment cash voids.
- [x] Require manager authorization, reviewed reason code, written reason, idempotency, and an open register.
- [x] Prevent over-refunds, duplicate voids, cross-order parents, partial voids, and concurrent reversal races in PostgreSQL.
- [x] Reconcile order state to `partially_refunded`, `refunded`, or `voided` from the event ledger.
- [x] Add bilingual manager reversal console and full database-backed tests.
- [ ] Add processor-backed card capture/refund/authorization reversal.
- [ ] Add split tender and per-tender reversal.
- [ ] Add item-level refund allocation, tax/discount allocation, receipts, and customer notifications.

## P1-A04 Branch and tenant boundaries

- [x] Record current scope as one restaurant.
- [ ] Decide whether multi-branch support is required.
- [ ] Add branch ownership/scoping and tenant-isolation tests if required.

---

# P1-B — Restaurant workflow correctness

## P1-B01 Cash-register sessions

- [x] Add register and device identity.
- [x] Add opening float, cashier identity, and opening timestamp.
- [x] Link sales, refunds, pay-ins, payouts, and drops to an open session.
- [x] Calculate exact expected closing balance.
- [x] Record counted cash, signed discrepancy, threshold, and manager approval.
- [x] Prevent multiple open sessions for one register.
- [x] Serialize checkout, movements, and closing through row locks.
- [x] Make closed sessions and close records immutable.
- [x] Add persistent POS assignment and open/close workflow.
- [ ] Add register edit, reassignment, deactivation, retirement, denomination counts, and dual-custody safe drops.
- [ ] Remove the legacy headerless checkout fallback after every deployed terminal is assigned.

## P1-B02 Employee timekeeping

- [ ] Add immutable clock, break, and shift entries.
- [ ] Support audited manager corrections instead of rewriting historical state.
- [ ] Calculate hours from events.
- [ ] Define overnight-shift and restaurant-timezone behavior.

## P1-B03 Recipes and immutable stock ledger

Completed and validated scope:

- [x] Add exact ingredient balances in base-unit micros.
- [x] Add per-ingredient unit conversions.
- [x] Add versioned recipes/BOMs for menu items.
- [x] Add modifier-specific recipe components.
- [x] Add immutable stock movements with source references and idempotency.
- [x] Add opening-balance movements for migrated inventory.
- [x] Add receiving, waste, positive/negative adjustment, production-consumption, and correction/reversal movements.
- [x] Consume recipe stock exactly once when an item enters production, including direct KDS jumps.
- [x] Store an immutable recipe ID/version or permanent untracked decision on each order item at first production.
- [x] Block configured production when stock is insufficient unless the ingredient explicitly permits negative stock.
- [x] Prevent direct quantity edits after ledger cutover.
- [x] Preserve movement cost snapshots and calculate cost impact.
- [x] Add database immutability, balance, conversion, recipe-ownership, snapshot, and concurrency constraints.
- [x] Add bilingual manager/inventory APIs, operator workflow, source inventories, and database-backed integration tests.

Policy decisions for this slice:

- Consumption occurs when an order item first enters production (`preparing`, or a later state reached directly).
- The first decision is permanent for that order item: a newer recipe cannot consume it again, and a recipe published after an untracked production start cannot deduct it retroactively.
- Cancelling after production does not silently return ingredients; a reviewed correction movement is required.
- Refunds do not automatically return physical stock.
- Missing recipes remain visible as permanently untracked items for that production lifecycle rather than blocking every legacy menu item.

Deferred from this slice:

- [ ] Lots, batches, expiry dates, serial tracking, and multi-location bins.
- [ ] Weighted-average, FIFO, or another formal valuation method.
- [ ] Vendor returns and stock transfers.
- [ ] Automatic physical-stock return on refunds or cancellations.
- [ ] Destructive removal of the legacy `Ingredient.quantity` compatibility field.

## P1-B04 Purchase orders

Completed and validated scope:

- [x] Add first-class supplier records with stable codes, contact details, payment terms, and active/inactive policy.
- [x] Add exact purchase-order lines with ingredient, purchasing-unit, conversion, quantity, and cost snapshots.
- [x] Add draft, submitted, partially received, received, and cancelled workflow.
- [x] Freeze commercial terms and lines after submission.
- [x] Add idempotent purchase-order creation and controlled submission/cancellation.
- [x] Support partial and full receiving through exact immutable stock-receipt movements.
- [x] Serialize concurrent receipt attempts and prevent over-receiving.
- [x] Preserve immutable receipt and receipt-line history.
- [x] Add reviewed purchase-receipt correction through linked stock reversals.
- [x] Prevent generic stock reversal from bypassing purchasing reconciliation.
- [x] Adopt legacy supplier text and purchase-order headers without inventing line history.
- [x] Add bilingual supplier, order, receiving, receipt, and correction operator workflows.
- [x] Add Prisma mappings, exact-value omission policy, audit coverage, source inventories, database tests, and existing-data rehearsal.

Deferred from this slice:

- [ ] Supplier invoices, accounts payable, taxes, and payment scheduling.
- [ ] Approval thresholds and multi-step procurement authorization.
- [ ] Vendor returns, debit notes, and supplier credits.
- [ ] Lots, batches, expiry dates, serial numbers, and multi-location receiving.
- [ ] Weighted-average, FIFO, or another formal inventory valuation method.
- [ ] Automatic reorder suggestions, supplier transmission, and document attachments.

## P1-B05 Waste

- [x] Route all new waste through immutable stock movements.
- [x] Add unit conversion, exact cost impact, idempotency, and reviewed correction support.
- [ ] Add configurable approval thresholds and role policy.
- [ ] Report by ingredient, reason, employee, and operational day.

## P1-B06 Reservation availability

- [ ] Add restaurant timezone, weekday hours, holidays, and closures.
- [ ] Enforce duration, overlap, capacity, and table compatibility.
- [ ] Support unassigned capacity planning and table allocation.
- [ ] Complete cancellation, no-show, seated, completed, and notification behavior.

## P1-B07 Waitlist

- [ ] Improve estimates using capacity, party size, reservations, and turnover.
- [ ] Complete notify, confirm, seat, cancel, and no-show transitions.
- [ ] Add notification expiry and compatible-table assignment.

## P1-B08 Loyalty and gift cards

- [ ] Define earning and reversal policy from trusted payment events.
- [ ] Add immutable point transactions.
- [ ] Add concurrency-safe gift-card issue, redemption, refund, and adjustment ledger.

---

# P1-C — KDS, analytics, jobs, and recovery

## P1-C01 Production-ready KDS

- [x] Add transactional outbox, authenticated retry endpoint, and bounded polling fallback.
- [x] Replace client-side latest-200 counting with a redacted aggregate.
- [ ] Finalize multi-instance realtime topology, broker, service authentication, reconnect behavior, health checks, and metrics.
- [ ] Complete course, hold, fire, recall, bump, and audit workflows.
- [ ] Configure production worker/runtime topology.

## P1-C02 Revenue analytics

- [ ] Define revenue-recognition and operational-day policy.
- [ ] Recognize revenue from trusted payment events.
- [ ] Deduct refunds and voids and exclude unpaid/cancelled orders.
- [ ] Use database aggregation, bounded ranges, pagination, and restaurant timezone.
- [ ] Read operating hours from settings.

## P1-C03 Jobs, monitoring, backup, and recovery

- [x] Add durable idempotent KDS outbox processing with retries and visibility.
- [ ] Add dead-letter policy, alert thresholds, structured logging, metrics, readiness, and error monitoring.
- [ ] Extend durable jobs to notifications, email/SMS, and analytics rollups.
- [ ] Define automated production backups and recovery targets.
- [ ] Test restore and point-in-time recovery with the actual provider.
- [ ] Protect uploaded assets and configuration.

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

- [x] Add focused unit and database-backed integration tests.
- [x] Add API mutation/read inventory tests and locked CI install/migration/typecheck/test/lint/build.
- [ ] Add browser end-to-end tests.
- [ ] Configure required branch-protection checks, dependency scanning, and secret scanning.
- [ ] Add structured logs, monitoring, metrics, readiness, and alerts.
- [ ] Add pagination, safe caching/invalidation, image optimization, bundle review, and query profiling.
- [ ] Document final supported Bun/Node/PostgreSQL versions and provider-specific deployment steps.
- [ ] Remove unused dependencies and enforce one package-manager strategy.
- [ ] Validate CSP, security headers, cache rules, and image-host configuration.

---

# Recorded decisions

- [x] Authentication: signed cookie plus persisted revocable PostgreSQL session.
- [x] PIN storage: peppered memory-hard verifier retained in the legacy column during migration compatibility.
- [x] Permissions: shared role groups enforced by APIs and reflected in frontend visibility.
- [x] Browser mutation protection: trusted origin + Fetch Metadata + JSON content type + SameSite cookie.
- [x] Order references: date-prefixed, random, unique, and non-sequential.
- [x] Order idempotency: deterministic internal order identity retained with the order.
- [x] Money: exact scaled integers; legacy floats remain only during expand/contract migration.
- [x] Cash operations: immutable payment events and register-session ledger.
- [x] Refunds/voids: append-only parent-linked events with manager approval and open-register cash effects.
- [x] KDS reliability: transactional outbox, authenticated retries, realtime delivery, and polling fallback.
- [x] Current deployment scope: one restaurant.
- [x] Stock consumption timing: first entry into production; no silent return on cancellation/refund.
- [x] Stock recipe snapshot: first production stores an immutable recipe version or a permanent untracked decision.
- [x] Purchasing receipts: submitted terms are immutable; partial receipts and reviewed corrections reconcile atomically with the stock ledger.
- [ ] Restaurant timezone and operational-day boundary.
- [ ] Revenue recognition policy.
- [ ] Loyalty earning/reversal policy.
- [ ] Multi-branch requirement.
- [ ] Final realtime topology and notification providers.
- [ ] Production backup, restore, point-in-time recovery, and alert targets.

---

# Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-30 | Created remediation roadmap and P0 tracking branch. | Initial repository audit. |
| 2026-07-31 | Completed source-level P0 containment, authentication, RBAC, privacy, authoritative ordering, audit, migrations, KDS outbox, and CI. | P0 Validation #393 and P0 Integration #228 green at `5c8c2d9`. |
| 2026-07-31 | Added exact financial storage, domain enums, timestamps, constraints, indexes, exact runtime cutover, and migration rehearsals. | Validation #511 and Integration #341 green at `55ac63f`. |
| 2026-07-31 | Added POS register assignment, opening/closing, cash reconciliation, immutable close records, and register-linked payment/cash ledgers. | Validation #558 and Integration #388 green at `c44030b`. |
| 2026-07-31 | Added immutable cash refunds and voids, manager console, ledger reconciliation, and concurrency/database protections. | P1 Stacked Validation #6 green at `87d787b`. |
| 2026-07-31 | Added exact inventory balances, unit conversions, immutable stock movements, versioned recipes, production consumption snapshots, bilingual operator workflow, and full regression coverage. | P1 Stacked Validation #32 green at `8e66dfd`. |
| 2026-07-31 | Added first-class suppliers, exact purchase-order lines, immutable submitted terms, partial/full receiving, reviewed receipt correction, bilingual operator workflow, and full regression coverage. | P1 Stacked Validation #46 green at `432d028`. |
