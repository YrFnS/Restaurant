# P0 Deployment Runbook

> **Scope:** deploying the P0 hardening branch to a controlled environment.  
> **Production status:** blocked until this runbook succeeds against a clean database and a protected copy of existing data.

## Required secrets

Generate independent cryptographically random values. Never reuse one secret for another purpose.

```env
AUTH_SECRET="minimum-32-character-random-session-secret"
AUTH_PIN_PEPPER="different-minimum-32-character-random-pin-pepper"
AUTH_ORDER_ACCESS_SECRET="different-minimum-32-character-order-secret"
AUTH_CUSTOMER_ACCESS_SECRET="different-minimum-32-character-customer-secret"
AUTH_SESSION_TTL_SECONDS="28800"
APP_ALLOWED_ORIGINS=""
```

`APP_ALLOWED_ORIGINS` should remain empty for same-origin deployments. Use a comma-separated list only when a trusted administration origin genuinely differs from the application origin.

The following existing values are also required where applicable:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://restaurant.example.com"
KDS_REALTIME_URL="http://kds-realtime:3003/broadcast"
NEXT_PUBLIC_KDS_PORT="3003"
```

## Pre-deployment safety gate

1. Put the application into a maintenance or write-drain state.
2. Confirm no older application instance can continue writing during schema or PIN migration.
3. Create a database backup and verify that it can be restored.
4. Record the current application commit and database migration state.
5. Confirm the P0 Validation workflow is green for the exact deployment commit.

## Clean-database rehearsal

Run against an empty disposable PostgreSQL database:

```bash
bun install --frozen-lockfile
bun run db:deploy
bun run db:seed
bun run auth:check-pins
bun run typecheck
bun run test:unit
bun run lint
bun run build
```

Expected results:

- all committed migrations apply successfully
- seeding completes only in the disposable environment
- `auth:check-pins` reports no plaintext employee PINs
- TypeScript, tests, lint, and build pass
- staff login works using a seeded development account
- no API response returns a PIN verifier

## Existing-data rehearsal

Restore a recent production-like backup into an isolated database, then run:

```bash
bun install --frozen-lockfile
bun run db:deploy
bun run auth:migrate-pins
bun run auth:check-pins
bun run build
```

Do not run `db:seed` against existing or production data.

Validate:

- employee count is unchanged
- all active employees can authenticate using their existing PIN
- no employee `pin` column contains plaintext digits
- orders, order items, customers, reservations, waitlist entries, tables, settings, menu data, inventory, and cash entries retain their expected counts
- the `AuditEvent` table exists and accepts login and test mutation events
- the public seed HTTP route returns `404`
- anonymous requests receive `401` from protected APIs
- unauthorized roles receive `403`
- public order tracking fails without the matching signed token

## Controlled production deployment

```bash
git checkout <validated-commit>
bun install --frozen-lockfile
bun run db:deploy
bun run auth:migrate-pins
bun run auth:check-pins
bun run build
```

Only start the new application after all commands succeed.

Immediately verify:

- owner/admin login and logout
- session endpoint
- menu read and authorized menu update
- public order quote and placement
- KDS visibility and valid ticket progression
- signed customer tracking
- POS cash checkout and one matching cash drawer entry
- reservation and waitlist signed access
- audit records for login, order creation, payment, and an administrative change

## Rollback

Application rollback alone is not enough after a database migration.

1. Stop writes.
2. Capture logs, request IDs, and the failed migration/application commit.
3. Restore the verified pre-deployment database backup when backward compatibility is not guaranteed.
4. Deploy the prior known-good application commit.
5. Rotate any secret suspected of exposure.
6. Preserve the failed environment for diagnosis when possible.

Do not attempt ad-hoc destructive SQL rollback on the production database without a reviewed migration-specific plan.

## Post-deployment verification

Run:

```bash
bun run auth:check-pins
```

Monitor:

- authentication failures and lockouts
- `AUTH_NOT_CONFIGURED` and audit-write failures
- order creation conflicts or retries
- KDS broadcast warnings and polling fallback
- cash checkout replay responses
- database transaction failures
- unexpected `401`, `403`, `409`, or `429` rates

Keep the draft PR blocked until the clean-database and existing-data rehearsals, integration tests, and production security review are documented in [`P0_IMPLEMENTATION_STATUS.md`](./P0_IMPLEMENTATION_STATUS.md).