# P1 Data-Integrity Implementation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-data-integrity`  
> **Base:** validated P0 head `5c8c2d93fe95f76aaeff7c433b175d8357ebd978`  
> **PR strategy:** stacked on `agent/p0-hardening` until P0 is merged  
> **Scope:** P1-A database and financial-model correctness

This document is the implementation tracker for the first P1 branch. It intentionally keeps restaurant workflow redesigns, UI work, and production topology changes out of the data-integrity migration.

## Completion rule

A checkbox is complete only after the migration works on both an empty database and a representative pre-P1 database, TypeScript and production build pass, and integration tests prove the relevant values and records are preserved.

## Phase 1 — Domain constraints and timestamp semantics

- [ ] Add Prisma enums for controlled operational values.
- [ ] Convert order type, order status, order-item status, payment method/status, employee role, table status/shape, reservation status, waitlist status, cash movement type, KDS screen type/layout, dynamic-pricing type, and payment-event type/status.
- [ ] Add an additive PostgreSQL migration that safely casts existing string values.
- [ ] Reject migration when unknown legacy values exist instead of silently coercing them.
- [ ] Change mutable records that currently use `@default(now())` to `@updatedAt`.
- [ ] Add database-backed tests proving enum constraints and automatic timestamp updates.

## Phase 2 — Exact persisted money

### Representation decision

Use PostgreSQL `NUMERIC` through Prisma `Decimal` while preserving public API values in major currency units as JSON numbers. Authoritative calculations continue using integer minor units.

Planned precision:

- Currency amounts and wages: `Decimal(18, 2)`.
- Tax rates and percentage values: `Decimal(9, 6)` where stored as ratios, `Decimal(7, 4)` where stored as percentages.
- Dynamic pricing multipliers: `Decimal(9, 6)`.
- Ingredient unit costs and purchase totals: `Decimal(18, 4)` where fractional unit costs are useful.

- [ ] Add shared Decimal/money conversion and JSON serialization helpers.
- [ ] Convert restaurant delivery values, menu/modifier prices, customer lifetime spend, order totals, order-item prices, gift cards, wages, inventory costs, purchase totals, cash entries, combo prices, percentages, and multipliers.
- [ ] Preserve coordinates, layout measurements, and non-money quantities as non-currency numeric types.
- [ ] Add a migration with explicit rounding and preflight range checks.
- [ ] Keep every customer/staff API response backward-compatible as numeric JSON.
- [ ] Add clean-database and existing-data precision tests.
- [ ] Add round-trip tests for values that binary floating point cannot represent exactly.

## Phase 3 — Database invariants

- [ ] Add check constraints for non-negative prices, balances, wages, totals, quantities, capacities, and percentages.
- [ ] Add cross-field constraints such as modifier minimum not exceeding maximum and tender/change consistency where representable.
- [ ] Add unique or partial indexes for active-session, active-waitlist, payment, and operational lookup patterns where justified.
- [ ] Add a constraint inventory test so future schema changes cannot silently remove critical invariants.

## Phase 4 — Financial event model completion

- [ ] Extend `PaymentEvent` to support capture, refund, and void relationships.
- [ ] Reconcile order payment state from immutable events.
- [ ] Add refund and void reasons plus manager approval.
- [ ] Keep card and split payment disabled until their provider and reconciliation contracts are implemented.

## Phase 5 — Release and migration rehearsal

- [ ] Deploy all P1 migrations to an empty PostgreSQL database in CI.
- [ ] Recreate the P0 schema and representative data, then deploy P1 migrations and compare counts/sentinels.
- [ ] Verify no monetary API field changes from number to string.
- [ ] Verify rollback/restore procedure against a protected deployment copy.
- [ ] Update `docs/REMEDIATION_PLAN.md` and the stacked PR with the exact green commit and remaining P1 work.

## Explicitly outside this branch

- Cash-register sessions and closing reconciliation.
- Employee immutable time entries.
- Recipe/BOM and stock movement ledger.
- Reservation and waitlist workflow redesign.
- Multi-branch tenancy.
- Public routing, locale, accessibility, branding, observability, and performance work.

Those remain in the master P1/P2 roadmap and should be implemented in separate branches after this data foundation is merged.
