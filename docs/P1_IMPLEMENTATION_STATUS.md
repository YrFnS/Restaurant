# P1 Data-Integrity Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-data-integrity`  
> **Base:** validated P0 head `5c8c2d93fe95f76aaeff7c433b175d8357ebd978`  
> **Validated implementation checkpoint:** `55ac63f8ffbc94b0f4daec3936dab78c55bc7685`  
> **Milestone:** P1-A — database and financial-model correctness  
> **Release status:** source-level P1-A expand/cutover work is green; the branch remains stacked on P0 and the destructive contract migration is intentionally deferred.

This document tracks the staged migration from floating-point financial storage to exact persisted values. The migration follows an expand-and-contract sequence so existing application versions and existing databases can be upgraded safely.

## Exact green checkpoint

The latest implementation checkpoint passed:

- **P0 Validation #511** — locked install, Prisma validation/generation, strict TypeScript, all focused security and data-integrity unit tests, exact financial write inventory, ESLint, and production build.
- **P0 Integration #341** — all migrations on an empty PostgreSQL 16 database, current seeding, PIN verification, exact-value verification, the complete P0 suite, P1 enum/timestamp/invariant tests, P1 exact-storage tests, first-class Prisma exact-field and JSON-safety tests, and representative legacy-database adoption.

The existing-data job generated a legacy Prisma Client from the legacy schema before seeding the pre-enum database, regenerated the current client before migration deployment, preserved all tracked legacy counts and sentinels, and verified every exact financial storage group after upgrade.

## Representation and rollout decision

The application standardizes on scaled integers because its authoritative order and payment calculations already use integer minor units. This avoids ambiguous financial JSON serialization and keeps database storage aligned with calculation inputs.

Reviewed scales:

- currency amounts and wages: minor units, scale `100`;
- tax rates and dynamic multipliers: micros, scale `1_000_000`;
- percentage discounts: basis points, scale `100`;
- ingredient unit costs: micros, scale `1_000_000`.

The rollout remains staged:

1. **Expand:** exact columns are added, backfilled, constrained, and synchronized while legacy application versions remain deployable.
2. **Application cutover:** exact fields are first-class Prisma fields; supported workflows read and write exact values while compatibility values remain available for older code and numeric API responses.
3. **Contract:** once no runtime path depends on legacy financial columns, synchronization triggers and legacy columns are removed through a separately reviewed and rehearsed migration.

## P1-A01 — Exact financial storage

### Phase 1: expand and verify

- [x] Add exact columns for every persisted currency amount.
- [x] Add scaled integer columns for tax, discount, multiplier, and unit-cost values.
- [x] Backfill existing rows deterministically.
- [x] Add database bounds that reject negative, non-finite, implausibly large, divergent, or cross-field-invalid values.
- [x] Keep exact columns synchronized while legacy application versions remain deployable.
- [x] Add `money:check` to detect any mismatch across 15 storage groups.
- [x] Run verification on clean-database and representative existing-data CI paths.
- [x] Add integration tests for trigger rounding, exact-column divergence, negative prices, multiplier precision, gift-card constraints, payment consistency, and concurrency indexes.

### Phase 2: application cutover

- [x] Add exact decimal-string/scaled-integer parsing, formatting, rounding, ratio, and safe-number primitives.
- [x] Define the scale contract for currency, rates, percentages, and unit costs.
- [x] Make exact fields first-class Prisma Client fields.
- [x] Globally omit BigInt exact fields from unreviewed shared-client results.
- [x] Prove default Prisma graphs remain JSON serializable and explicit exact selects return BigInt values.
- [x] Price orders from exact menu prices, modifier prices, tax, delivery, promo, and dynamic-pricing values.
- [x] Read checkout totals and cash balances from exact values.
- [x] Directly dual-write order totals, order-item prices, cash captures, manual cash entries, restaurant pricing settings, menu prices, modifier prices, dynamic multipliers, employee wages, and ingredient unit costs.
- [x] Preserve existing numeric public API contracts through omission and reviewed conversion helpers.
- [x] Remove persisted binary-float dependence from authoritative order pricing, checkout, and cash-balance calculations.
- [x] Add exact-field round-trip, overflow, currency-scale, trigger, constraint, and serialization tests.
- [x] Add a permanent source inventory proving every active financial write either dual-writes exact values or is explicitly classified as compatibility-only/deferred.
- Deferred: gift-card, purchase-order, combo-meal, customer-spend, special-offer, promo-code, and remaining report/analytics cutovers stay open until their complete workflows are implemented or reviewed.

### Phase 3: contract

- [ ] Confirm no runtime reads or writes depend on legacy financial `Float` columns across the deferred models.
- [ ] Rehearse the contract migration against a protected production-like copy.
- [ ] Remove synchronization triggers.
- [ ] Remove or rename legacy columns without data loss.
- [ ] Make exact fields the only authoritative persisted financial fields.
- [ ] Update baseline and deployment documentation.

The contract phase must not be mixed into the current PR. It is destructive, depends on completing or explicitly retiring every deferred financial model, and requires a protected deployment-copy rehearsal and rollback plan.

## P1-A03 — Domain constraints and enums

- [x] Add fail-fast migration preflight for unknown legacy controlled values.
- [x] Convert order type/status and order-item status.
- [x] Convert payment method/status/event type.
- [x] Convert employee roles.
- [x] Convert table, reservation, waitlist, cash, KDS, and dynamic-pricing states.
- [x] Add catalog tests proving the exact reviewed enum labels.
- [x] Add database tests proving unknown enum values are rejected.
- [x] Add cross-field bounds for settings, menu, modifiers, orders, tables, reservations, waitlist, ratings, schedules, inventory, KDS, rate limits, outbox events, and payment events.
- [x] Add concurrency-safe partial uniqueness for active waitlist entries and successful payment captures.
- [x] Add active-reservation and active-order indexes.
- Deferred: add matching constraints to future refund, register, stock-ledger, recipe, and loyalty models when those workflows are introduced.

## P1-A04 — Timestamp semantics

- [x] Replace mutable operational `@default(now())` timestamps with `@updatedAt` semantics.
- [x] Preserve immutable event timestamps.
- [x] Add database-backed tests proving `createdAt` stays fixed while `updatedAt` advances.
- [ ] Add restaurant timezone and operational-day decisions before changing reporting behavior.

## Current validation gate

- [x] Prisma schema validation and generation pass.
- [x] Strict TypeScript and ESLint pass.
- [x] Focused money, schema-inventory, write-inventory, enum, role, invariant, and serialization tests pass.
- [x] Production build passes.
- [x] Clean-database migrations, seeding, exact-value verification, and full runtime tests pass.
- [x] Existing-data adoption, record preservation, and exact-value verification pass.
- [x] P0 security and restaurant integration suites remain green.
- [x] Exact-field application cutover and numeric JSON compatibility pass for supported workflows.
- [ ] Protected deployment-copy rehearsal and contract-migration rollback pass.
- [ ] Deferred financial models are resolved before any contract migration removes compatibility columns.

## Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-31 | Created the stacked P1 data-integrity branch and staged migration plan. | Branch confirmed identical to the validated P0 head before P1 changes. |
| 2026-07-31 | Added PostgreSQL enums, migration preflight, timestamp corrections, exact-value expansion columns, synchronization triggers, financial constraints, verification tooling, and database tests. | Validation #433 and Integration #263 passed on `6389f94`. |
| 2026-07-31 | Added domain invariants and partial indexes, made exact fields first-class with safe global omission, cut authoritative order/payment/cash calculations to exact values, dual-wrote active administrative financial workflows, and added runtime JSON-safety/round-trip tests. | Validation #499 and Integration #329 passed on `4a91f2e`. |
| 2026-07-31 | Added the permanent exact-financial-write inventory, reconciled every active financial mutation, and classified incomplete financial models as deferred from the contract migration. | Validation #511 and Integration #341 passed on `55ac63f`. |
