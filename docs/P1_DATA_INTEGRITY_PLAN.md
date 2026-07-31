# P1 Data-Integrity Implementation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-data-integrity`  
> **Base:** validated P0 head `5c8c2d93fe95f76aaeff7c433b175d8357ebd978`  
> **PR strategy:** stacked on `agent/p0-hardening` until P0 is merged  
> **Scope:** P1-A database and financial-model correctness  
> **Latest validated implementation checkpoint:** `6389f94b9376a291d8f069eb6d427b93294519cd`

This document is the implementation tracker for the first P1 branch. It intentionally keeps restaurant workflow redesigns, UI work, and production topology changes out of the data-integrity migration.

## Completion rule

A checkbox is complete only after the migration works on both an empty database and a representative pre-P1 database, TypeScript and production build pass, and integration tests prove the relevant values and records are preserved.

## Validated checkpoint

On `6389f94b9376a291d8f069eb6d427b93294519cd`:

- **P0 Validation #433** passed Prisma validation/generation, TypeScript, focused unit tests, ESLint, and production build.
- **P0 Integration #263** passed clean-database migration deployment, representative existing-data adoption, P0 regression coverage, PostgreSQL enum/timestamp assertions, exact-storage synchronization and constraints, and exact-value verification.

The workflow names retain their P0 labels because P1 is stacked on the P0 branch, but both now execute the P1 gates as well.

## Phase 1 — Domain constraints and timestamp semantics

- [x] Add Prisma enums for controlled operational values.
- [x] Convert order type, order status, order-item status, payment method/status, employee role, table status/shape, reservation status, waitlist status, cash movement type, KDS screen type/layout, dynamic-pricing type, and payment-event type/status.
- [x] Add an additive PostgreSQL migration that safely casts existing string values.
- [x] Reject migration when unknown legacy values exist instead of silently coercing them.
- [x] Change mutable records that previously used only `@default(now())` to Prisma-managed `@updatedAt` semantics.
- [x] Add database-backed tests proving enum catalogs, invalid-value rejection, generated enum round trips, and automatic timestamp updates.

## Phase 2 — Exact persisted financial values

### Representation decision

Use scaled PostgreSQL integers because the authoritative order engine already calculates in integer minor units. This avoids Decimal JSON serialization surprises and aligns storage with calculations:

- currency amounts and wages: minor units, scale `100`
- tax rates and dynamic multipliers: micros, scale `1_000_000`
- percentage discounts: basis points, scale `100`
- ingredient unit costs: micros, scale `1_000_000`

The migration follows **expand → application cutover → contract**. During expansion, legacy `Float` columns remain available while exact shadow columns are backfilled, constrained, and synchronized. The application then moves reads and writes to exact values before legacy columns and synchronization triggers are removed.

### Phase 2A — Expand and verify

- [x] Add exact shadow columns for restaurant settings, menu/modifier prices, customer spend, order/order-item totals, offers/promos, gift cards, wages, inventory costs, purchase totals, cash movements, pricing multipliers, and combo prices.
- [x] Preserve coordinates, layout measurements, inventory quantities, and other non-financial measurements as their existing numeric types.
- [x] Backfill existing rows deterministically with explicit half-up rounding.
- [x] Add synchronization triggers for legacy application writes during the expand window.
- [x] Add database bounds and exact/legacy consistency constraints.
- [x] Add a verification command that detects mismatched exact values.
- [x] Add clean-database and existing-data verification.
- [x] Add exact parser/formatter tests and database tests for half-up rounding, direct divergence rejection, negative-value rejection, multiplier precision, and gift-card balance invariants.

### Phase 2B — Application cutover

- [x] Add shared scaled-integer parsing, formatting, and safe numeric serialization helpers.
- [ ] Make exact fields first-class Prisma Client fields rather than ignored migration-only columns.
- [ ] Read authoritative prices, rates, costs, and totals from exact columns throughout supported workflows.
- [ ] Dual-write exact and compatibility columns during the transition, or replace synchronization with a reviewed equivalent.
- [ ] Preserve every public/staff API financial field as a JSON number.
- [ ] Remove remaining business calculations that depend on persisted binary floating-point values.
- [ ] Add API round-trip and boundary tests for exact values.

### Phase 2C — Contract

- [ ] Confirm no runtime read or write depends on legacy financial `Float` columns.
- [ ] Rehearse the contract migration against a protected production-like copy.
- [ ] Remove synchronization triggers.
- [ ] Remove or rename legacy financial columns without data loss.
- [ ] Make the exact fields the only authoritative persisted representation.
- [ ] Update baseline/deployment and rollback documentation.

## Phase 3 — Database invariants and indexes

- [x] Add check constraints for the expanded financial values, including non-negative bounds and exact/legacy consistency.
- [x] Add the implemented gift-card balance cross-field constraint.
- [ ] Add non-financial domain constraints for quantities, capacities, modifier minimum/maximum values, ratings, percentages, and operational ranges.
- [ ] Add payment-event tender/change and event-shape constraints where representable.
- [ ] Add unique or partial indexes for active sessions, active waitlist entries, payment lookups, and operational filters where justified by measured queries.
- [ ] Add a permanent constraint/index inventory test so future schema changes cannot silently remove critical invariants.

## Phase 4 — Financial event model completion

- [ ] Extend `PaymentEvent` to support capture, refund, void, and adjustment relationships.
- [ ] Reconcile order payment state from immutable events.
- [ ] Add refund and void reasons plus manager approval.
- [ ] Keep card and split payment disabled until their provider and reconciliation contracts are implemented.

## Phase 5 — Release and migration rehearsal

- [x] Deploy all current P1 migrations to an empty PostgreSQL database in CI.
- [x] Recreate the P0 schema and representative data, deploy P1 migrations, and compare counts/sentinels.
- [x] Verify current APIs remain on their pre-cutover numeric contracts because exact fields are ignored by Prisma during expansion.
- [ ] Complete Phase 2B and Phase 2C before declaring floating-point financial storage removed.
- [ ] Verify backup/restore and rollback against a protected deployment copy.
- [ ] Update `docs/REMEDIATION_PLAN.md` and the stacked PR with the final green commit and remaining P1 work.

## Explicitly outside this branch

- Cash-register sessions and closing reconciliation.
- Employee immutable time entries.
- Recipe/BOM and stock movement ledger.
- Reservation and waitlist workflow redesign.
- Multi-branch tenancy.
- Public routing, locale, accessibility, branding, observability, and performance work.

Those remain in the master P1/P2 roadmap and should be implemented in separate branches after this data foundation is merged.
