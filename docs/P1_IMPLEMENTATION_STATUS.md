# P1 Data-Integrity Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-data-integrity`  
> **Base:** validated P0 head `5c8c2d93fe95f76aaeff7c433b175d8357ebd978`  
> **Milestone:** P1-A — database and financial-model correctness  
> **Release status:** work in progress; this branch is stacked on P0 and must merge after P0.

This document tracks the staged migration from floating-point financial storage to exact persisted values. The migration follows an expand-and-contract sequence so existing application versions and existing databases can be upgraded safely.

## Architecture decision

Currency values use integer **minor units** (for example, cents for USD) at authoritative storage and calculation boundaries. Rates and unit-cost values that require more precision use scaled integers:

- currency amount: scale `100`
- tax rate and dynamic multiplier: scale `1_000_000`
- percentage discounts: basis points, scale `100`
- inventory cost per unit: scale `1_000_000`

The current `Float` columns remain temporarily during the expand phase. Exact shadow columns are added, backfilled, constrained, and synchronized. Application reads and writes will then move to the exact columns before the legacy columns are removed in a later contract migration.

## P1-A01 — Exact financial storage

### Phase 1: expand and verify

- [ ] Add exact shadow columns for every persisted currency amount.
- [ ] Add scaled integer shadow columns for tax, discount, multiplier, and unit-cost values.
- [ ] Backfill existing rows deterministically.
- [ ] Add database bounds that reject negative, non-finite, or implausibly large financial values.
- [ ] Keep exact columns synchronized while legacy application versions remain deployable.
- [ ] Add a database verification command that detects any mismatch.
- [ ] Run verification on clean-database and representative existing-data CI paths.

### Phase 2: application cutover

- [ ] Add shared money/rate conversion utilities.
- [ ] Read authoritative prices and totals from exact columns.
- [ ] Write exact columns directly in every supported transaction.
- [ ] Preserve numeric public API contracts through explicit serializers.
- [ ] Remove business calculations that depend on binary floating-point values.
- [ ] Add boundary, overflow, currency-scale, and serialization tests.

### Phase 3: contract

- [ ] Confirm no runtime reads or writes depend on legacy financial `Float` columns.
- [ ] Rehearse the contract migration against a protected production-like copy.
- [ ] Remove synchronization triggers.
- [ ] Remove or rename legacy columns without data loss.
- [ ] Make exact fields first-class Prisma Client fields.
- [ ] Update the baseline/deployment documentation.

## P1-A03 — Domain constraints and enums

- [ ] Add safe database constraints before replacing string fields with enums.
- [ ] Convert order type/status and order-item status.
- [ ] Convert payment method/status/event type.
- [ ] Convert employee roles.
- [ ] Convert table, reservation, waitlist, cash, KDS, and promotion states.
- [ ] Add migration tests for invalid legacy values.

## P1-A04 — Timestamp semantics

- [ ] Replace mutable `@default(now())` timestamps with `@updatedAt` where appropriate.
- [ ] Preserve immutable event timestamps.
- [ ] Add restaurant timezone and operational-day decisions before changing reporting behavior.

## Validation gate for this branch

- [ ] Prisma schema validation and generation pass.
- [ ] Strict TypeScript and ESLint pass.
- [ ] Focused money/storage tests pass.
- [ ] Production build passes.
- [ ] Clean-database migrations and exact-value verification pass.
- [ ] Existing-data adoption and exact-value verification pass.
- [ ] P0 security/integration suites remain green.

## Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-31 | Created the stacked P1 data-integrity branch and staged exact-money migration plan. | Branch confirmed identical to the validated P0 head before P1 changes. |
