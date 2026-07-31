# P1 Data-Integrity Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-data-integrity`  
> **Base:** validated P0 head `5c8c2d93fe95f76aaeff7c433b175d8357ebd978`  
> **Validated checkpoint:** `6389f94b9376a291d8f069eb6d427b93294519cd`  
> **Milestone:** P1-A — database and financial-model correctness  
> **Release status:** work in progress; this branch is stacked on P0 and must merge after P0.

This document tracks the staged migration from floating-point financial storage to exact persisted values. The migration follows an expand-and-contract sequence so existing application versions and existing databases can be upgraded safely.

## Exact green checkpoint

The first P1 checkpoint passed:

- **P0 Validation #433** — locked install, Prisma validation/generation, strict TypeScript, focused security and data-integrity unit tests, ESLint, and production build.
- **P0 Integration #263** — all migrations on an empty PostgreSQL 16 database, current seeding, PIN verification, exact-value verification, the complete P0 suite, P1 enum/timestamp tests, P1 exact-storage tests, and representative legacy-database adoption.

The existing-data job generated a legacy Prisma Client from the legacy schema before seeding the pre-enum database, regenerated the current client before migration deployment, preserved all tracked legacy counts and sentinels, and verified every exact shadow group after upgrade.

## Representation and rollout decision

The application will standardize on scaled integers because its authoritative order and payment calculations already use integer minor units. This avoids Prisma `Decimal` JSON serialization ambiguity and keeps database storage aligned with calculation inputs.

Reviewed scales:

- currency amounts and wages: minor units, scale `100`;
- tax rates and dynamic multipliers: micros, scale `1_000_000`;
- percentage discounts: basis points, scale `100`;
- ingredient unit costs: micros, scale `1_000_000`.

The rollout remains staged:

1. **Expand:** exact columns are added, backfilled, constrained, and synchronized while legacy application versions remain deployable.
2. **Application cutover:** exact fields become first-class Prisma fields; supported workflows read and write exact values while compatibility values remain available for older code and numeric API responses.
3. **Contract:** once no runtime path depends on the legacy financial columns, synchronization triggers and legacy columns are removed through a rehearsed migration.

## P1-A01 — Exact financial storage

### Phase 1: expand and verify

- [x] Add exact shadow columns for every persisted currency amount.
- [x] Add scaled integer shadow columns for tax, discount, multiplier, and unit-cost values.
- [x] Backfill existing rows deterministically.
- [x] Add database bounds that reject negative, non-finite, implausibly large, or cross-field-invalid financial values.
- [x] Keep exact columns synchronized while legacy application versions remain deployable.
- [x] Add `money:check` to detect any mismatch across 15 storage groups.
- [x] Run verification on clean-database and representative existing-data CI paths.
- [x] Add integration tests for trigger rounding, exact-column divergence, negative prices, multiplier precision, and gift-card balance constraints.

### Phase 2: application cutover

- [x] Add exact decimal-string/scaled-integer parsing, formatting, and safe-number primitives.
- [x] Define the current scale contract for currency, rates, percentages, and unit costs.
- [ ] Make exact fields first-class Prisma Client fields while omitting them from unreviewed default response payloads.
- [ ] Read authoritative prices and totals from exact fields in supported order, payment, cash, inventory-cost, wage, gift-card, and reporting workflows.
- [ ] Write exact fields directly while maintaining compatibility during the transition.
- [ ] Preserve numeric public API contracts through explicit safe serializers.
- [ ] Remove business calculations that depend on persisted binary floating-point values.
- [ ] Add exact-field API round-trip, overflow, currency-scale, and serialization tests.

### Phase 3: contract

- [ ] Confirm no runtime reads or writes depend on legacy financial `Float` columns.
- [ ] Rehearse the contract migration against a protected production-like copy.
- [ ] Remove synchronization triggers.
- [ ] Remove or rename legacy columns without data loss.
- [ ] Make exact fields the only authoritative first-class Prisma fields.
- [ ] Update baseline and deployment documentation.

## P1-A03 — Domain constraints and enums

- [x] Add fail-fast migration preflight for unknown legacy controlled values.
- [x] Convert order type/status and order-item status.
- [x] Convert payment method/status/event type.
- [x] Convert employee roles.
- [x] Convert table, reservation, waitlist, cash, KDS, and dynamic-pricing states.
- [x] Add catalog tests proving the exact reviewed enum labels.
- [x] Add database tests proving unknown enum values are rejected.
- [ ] Add remaining non-enum cross-field and partial-index invariants.

## P1-A04 — Timestamp semantics

- [x] Replace mutable operational `@default(now())` timestamps with `@updatedAt` semantics.
- [x] Preserve immutable event timestamps.
- [x] Add database-backed tests proving `createdAt` stays fixed while `updatedAt` advances.
- [ ] Add restaurant timezone and operational-day decisions before changing reporting behavior.

## Current validation gate

- [x] Prisma schema validation and generation pass.
- [x] Strict TypeScript and ESLint pass.
- [x] Focused money, schema-inventory, enum, and role tests pass.
- [x] Production build passes.
- [x] Clean-database migrations, seeding, and exact-value verification pass.
- [x] Existing-data adoption, record preservation, and exact-value verification pass.
- [x] P0 security and restaurant integration suites remain green.
- [ ] Exact-field application cutover and numeric JSON compatibility pass.
- [ ] Protected deployment-copy rehearsal and contract-migration rollback pass.

## Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-31 | Created the stacked P1 data-integrity branch and staged migration plan. | Branch confirmed identical to the validated P0 head before P1 changes. |
| 2026-07-31 | Added PostgreSQL enums, migration preflight, timestamp corrections, exact-value expansion columns, synchronization triggers, financial constraints, verification tooling, and database tests. | Validation #433 and Integration #263 passed on `6389f94`. |
