# P0 Implementation Status

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p0-hardening`  
> **Draft PR:** `#1`  
> **Last validated:** 2026-07-31  
> **Release decision:** **Blocked — do not merge or deploy as production-complete yet.**

This document is the implementation companion to [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md). The plan remains the full backlog; this file records what is already implemented and validated, plus the remaining P0 blockers.

## Validation baseline

GitHub Actions run **P0 Validation #91** passed on the branch after temporary migration scripts were removed and CI was reduced to committed source only.

Validated steps:

- `bun install --frozen-lockfile`
- `prisma validate`
- `prisma generate`
- `bun run typecheck`
- `bun run test:unit`
- `bun run lint`
- `bun run build`

The workflow has read-only repository permissions and cannot rewrite source or the lockfile.

## Completed and validated

### Emergency containment

- Removed visible quick-login PINs and client-side employee enumeration.
- Removed the public production seed HTTP endpoint.
- Disabled production Prisma query logging except errors.
- Removed TypeScript error suppression and restored strict production builds.
- Added safe request IDs and normalized public error responses across the hardened routes.

### Staff authentication

- Staff PIN verification happens only on the server.
- PIN values are converted to memory-hard, peppered verifiers.
- Existing plaintext values have a controlled migration and verification command.
- Staff sessions use signed HTTP-only cookies with `Secure` in production and `SameSite=Lax`.
- Sensitive staff state is no longer persisted in Zustand/localStorage.
- Login responses do not enumerate users or reveal why authentication failed.
- Login attempts have temporary per-source throttling and lockout.

### Browser-request protection

- State-changing API requests are filtered centrally through the Next.js proxy.
- Cross-site Fetch Metadata is rejected.
- `Origin` is restricted to the application origin plus explicitly configured trusted origins.
- JSON APIs reject unsafe body content types.
- SameSite cookies remain defense in depth rather than the only CSRF control.

### Authorization and validation

- Shared server guards enforce authenticated role checks.
- Sensitive settings, menu, employee, cash, inventory, KDS, table, order, reservation, waitlist, analytics, report, and notification operations fail closed.
- Write endpoints use strict allowlisted schemas instead of arbitrary request-body assignment.
- Employee responses use safe field selections and never return the PIN verifier.

### Server-authoritative orders

- Customer and POS order clients send selections rather than financial totals.
- The server loads item and modifier prices, validates ownership/selection limits, applies dynamic pricing and promos, and calculates tax, fees, tips, discounts, and totals.
- Pricing calculations use integer cents internally.
- Order creation requires an idempotency key and maps it to a deterministic internal order identity.
- Order, items, customer linkage, table status, and audit event are created in one transaction.
- Public orders always begin unpaid.
- Order references are random, date-prefixed, unique, and independent from the primary key.
- Invalid order and item status transitions are rejected.
- Hard deletion of orders and financially relevant order items is disabled.

### Payment containment

- POS cash checkout is staff-only and uses the stored server total.
- Tendered cash and change are validated server-side.
- Order payment state, cash drawer sale, table state, and audit event are committed atomically.
- Replayed cash checkout cannot create a duplicate cash drawer sale.
- Card and split-payment flows fail closed until a payment processor and payment ledger are implemented.
- Direct public loyalty-point subtraction is disabled.

### Customer privacy

- Order tracking requires an exact reference plus an opaque signed credential.
- Tracking requests are rate-limited and return an allowlisted customer-safe DTO.
- Phone-number order enumeration is removed.
- Reservation and waitlist ownership use resource-specific signed credentials.
- Public reservation and waitlist endpoints cannot enumerate other customers.
- Loyalty lookup requires proof from a signed order credential linked to the customer.

### Cash and inventory containment

- Cash reads/writes require explicit roles.
- Cash actors come from the authenticated session.
- Cash balance is calculated from the full authoritative ledger rather than the newest 100 rows.
- Inventory mutations require inventory roles and strict schemas.
- Waste reduction and waste-log creation are atomic and cannot exceed available inventory.

### Append-only audit foundation

- Added an `AuditEvent` Prisma model and committed migration.
- Audit metadata is recursively bounded and redacts credential-like fields.
- Audit records include actor, action, entity, request ID, hashed source identifier, user agent, safe metadata, and timestamp.
- Audit writes are part of the same transaction for:
  - employee creation/update/deletion
  - settings changes
  - order creation and status changes
  - POS cash capture
  - manual cash movements
  - ingredient creation/update/deletion
  - waste adjustments
- Successful staff logins require an audit event before a session cookie is issued.
- Only owner/admin roles can read audit events; no API can update or delete them.

### Focused security tests

Current unit coverage includes:

- browser mutation/origin policy
- employee PIN format, verifier derivation, and verification
- order-access token scoping and tamper detection
- deterministic idempotency identity
- reservation/waitlist token resource isolation
- audit metadata redaction and bounding

## Remaining P0 blockers

### 1. Existing-database deployment has not been exercised

Required against both a clean database and a protected copy of existing data:

```bash
bun install --frozen-lockfile
bun run db:deploy
bun run auth:migrate-pins
bun run auth:check-pins
bun run build
```

A backup and rollback rehearsal must precede production deployment.

### 2. Integration and end-to-end authorization tests are incomplete

Still required:

- login/session/logout behavior against a real database
- `401` and `403` coverage for every protected resource
- tampered-order and modifier-ownership integration tests
- concurrent order-reference and idempotency tests
- transaction rollback tests
- cross-customer privacy tests
- staff-to-KDS-to-customer order lifecycle smoke test
- cash checkout smoke test

### 3. Sessions are signed but not centrally revocable

Logout clears the browser cookie, but a copied stateless token remains valid until expiry. P0 still needs a persisted session record or revocation/version strategy, rotation identifier, and idle timeout.

### 4. Rate limiting is process-local

Login, public-order, tracking, feedback, and newsletter limits currently protect one application instance. Multi-instance production requires a shared store such as Redis or a managed rate-limit service.

### 5. KDS delivery is not durable

Realtime delivery occurs after the order transaction and polling is the fallback, but there is no transactional outbox, retry worker, or dead-letter visibility yet.

### 6. Payment and refund ledger is not implemented

Cash capture is contained and audited, but the application still lacks immutable payment, refund, void, and split-payment records. Card and split flows intentionally remain disabled.

### 7. Audit coverage is not complete for every future privileged flow

Menu price changes, permission changes, discounts approved outside order creation, voids, refunds, and future payment-provider callbacks must emit audit events when those workflows are implemented.

### 8. Money remains stored in floating-point columns

Server calculations use cents, but existing Prisma fields still use `Float`. Converting persisted money to `Decimal` or smallest-unit integers remains P1 and must be completed before broad financial deployment.

## Current release gate

| Gate | Status |
| --- | --- |
| Locked dependency install | Passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| TypeScript | Passed |
| Focused unit tests | Passed |
| ESLint | Passed |
| Production build | Passed |
| Clean-database migration deployment | Open |
| Existing-data migration rehearsal | Open |
| PIN migration verification on deployment data | Open |
| Integration authorization suite | Open |
| End-to-end restaurant workflow suite | Open |
| Persisted/revocable sessions | Open |
| Durable KDS outbox | Open |
| Production security review | Open |

P0 remains open until every production gate above is resolved or explicitly reclassified in the master remediation plan with documented rationale.