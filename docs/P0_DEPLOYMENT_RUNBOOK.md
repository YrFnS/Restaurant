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
RATE_LIMIT_SECRET="different-minimum-32-character-rate-limit-secret"
KDS_OUTBOX_SECRET="different-minimum-32-character-kds-worker-secret"
AUTH_SESSION_TTL_SECONDS="28800"
AUTH_SESSION_IDLE_SECONDS="1800"
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
5. Confirm both `P0 Validation` and `P0 Integration` are green for the exact deployment commit.
6. Confirm the migrations directory contains, in order:
   - `20260730000000_baseline`
   - `20260731220000_add_audit_event`
   - `20260731223000_add_persisted_staff_sessions`
   - `20260731224500_add_shared_rate_limits`
   - `20260731230000_add_kds_outbox`
   - `20260731231500_add_payment_event`

## Clean-database rehearsal

Run against an empty disposable PostgreSQL database:

```bash
bun install --frozen-lockfile
bun run db:generate
bun run db:deploy
bunx prisma migrate status
bun run db:seed
bun run auth:check-pins
bun run typecheck
bun run test:unit
bun run lint
bun run build
```

Expected results:

- every committed migration applies successfully in lexicographic order
- `prisma migrate status` reports the database is up to date
- seeding completes only in the disposable environment
- `auth:check-pins` reports no plaintext employee PINs
- TypeScript, tests, lint, and build pass
- staff login works using a seeded development account
- no API response returns a PIN verifier
- the database-backed P0 integration workflow passes on the same commit

## Existing-data rehearsal

Restore a recent production-like backup into an isolated database. Do not run `db:seed` against existing or production data.

### First adoption of Prisma Migrate

The original application used schema synchronization without a committed migration history. The restored database therefore already contains the objects represented by the baseline migration. Mark **only** the baseline as applied before deploying the additive P0 migrations:

```bash
bun install --frozen-lockfile
bun run db:generate
bunx prisma migrate resolve --applied 20260730000000_baseline
bun run db:deploy
bunx prisma migrate status
bun run auth:migrate-pins
bun run auth:check-pins
bun run build
```

Do not mark the five P0 additive migrations as applied unless their SQL has independently and verifiably already been executed. `migrate deploy` must apply those migrations normally.

If `_prisma_migrations` already exists, stop and inspect `bunx prisma migrate status` before using `migrate resolve`. Never blindly mark a migration applied.

Validate:

- employee count is unchanged
- all active employees can authenticate using their existing PIN
- no employee `pin` column contains plaintext digits
- orders, order items, customers, reservations, waitlist entries, tables, settings, menu data, inventory, and cash entries retain their expected counts
- `AuditEvent`, `StaffSession`, `RateLimitCounter`, `KdsOutboxEvent`, and `PaymentEvent` exist
- the public seed HTTP route returns `404`
- anonymous requests receive `401` from protected APIs
- unauthorized roles receive `403`
- public order tracking fails without the matching signed token
- `prisma migrate status` reports no failed or pending migrations

## Privileged PIN recovery

Owner/admin recovery is deliberately a local server operation, not a public HTTP endpoint. Run it from an interactive terminal with production secrets and database access already configured:

```bash
bun run auth:reset-privileged-pin -- <employee-id-or-exact-email>
```

The command:

- accepts the replacement PIN only through a hidden terminal prompt
- permits only active owner/admin targets
- stores only the peppered memory-hard verifier
- revokes every existing session for the target account
- writes an immutable `auth.privileged_pin_recovery` audit event
- never prints or logs the PIN

Without an argument, the command lists eligible privileged account IDs so an operator can select an exact target. Run recovery only from a trusted host and record the related incident/change ticket outside the application.

## KDS durable outbox worker

Every order/KDS transaction writes an outbox event before commit. Immediate delivery is attempted after commit, while the worker retries pending or failed events.

Schedule this authenticated request at least once per minute from a trusted scheduler:

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${KDS_OUTBOX_SECRET}" \
  "https://restaurant.example.com/api/internal/kds-outbox?limit=25"
```

The endpoint must return `401` without the bearer secret. A successful response reports `processed`, `delivered`, and `failed` counts. Treat repeated failures or a growing pending queue as an operational incident; polling remains a display fallback, not a substitute for maintaining the worker.

## Controlled production deployment

```bash
git checkout <validated-commit>
bun install --frozen-lockfile
bun run db:generate
bun run db:deploy
bunx prisma migrate status
bun run auth:migrate-pins
bun run auth:check-pins
bun run build
```

Only start the new application after all commands succeed.

Immediately verify:

- owner/admin login and logout
- session endpoint, idle timeout, and revocation
- menu read and authorized menu update
- public order quote and placement
- KDS visibility and valid ticket progression
- signed customer tracking
- POS cash checkout, one immutable payment event, and one matching cash drawer entry
- reservation and waitlist signed access
- audit records for login, order creation, payment, menu price change, and another administrative change
- authenticated KDS outbox worker execution

## Rollback

Application rollback alone is not enough after a database migration.

1. Stop writes.
2. Capture logs, request IDs, outbox state, and the failed migration/application commit.
3. Restore the verified pre-deployment database backup when backward compatibility is not guaranteed.
4. Deploy the prior known-good application commit.
5. Rotate any secret suspected of exposure.
6. Preserve the failed environment for diagnosis when possible.

Do not attempt ad-hoc destructive SQL rollback on the production database without a reviewed migration-specific plan.

## Post-deployment verification

Run:

```bash
bunx prisma migrate status
bun run auth:check-pins
```

Monitor:

- authentication failures, lockouts, idle expiry, and revoked-session use
- `AUTH_NOT_CONFIGURED`, audit-write failures, and shared-rate-limit failures
- order creation conflicts or idempotent retries
- pending/failed `KdsOutboxEvent` rows and worker responses
- KDS broadcast warnings and polling fallback
- payment-event/cash-drawer mismatches and checkout replay responses
- database transaction failures
- unexpected `401`, `403`, `409`, or `429` rates

Keep the draft PR blocked until the clean-database rehearsal, existing-data rehearsal, and production security review are documented in [`P0_IMPLEMENTATION_STATUS.md`](./P0_IMPLEMENTATION_STATUS.md).
