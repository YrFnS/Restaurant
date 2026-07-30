# Restaurant Production Remediation Plan

> **Repository:** `YrFnS/Restaurant`  
> **Tracking branch:** `agent/p0-hardening`  
> **Created:** 2026-07-30  
> **Current milestone:** P0 — Critical security and financial integrity  
> **Goal:** turn the current restaurant-management prototype into a secure, testable, production-ready system without discarding the useful UI and domain work already present.

---

## How this document is used

This file is the source of truth for remediation work. Every implementation commit should update the relevant checkbox and add a short note to the change log.

### Status notation

- `[ ]` Not started
- `[x]` Completed and validated
- `Blocked` Waiting on an external decision or dependency
- `Deferred` Intentionally moved to a later milestone

A task is not complete merely because code was written. It is complete only after its acceptance criteria and relevant tests pass.

### Priority definitions

| Priority | Meaning |
| --- | --- |
| **P0** | Critical exposure or data/financial-integrity risk. Production use must remain blocked until complete. |
| **P1** | Major correctness, reliability, workflow, or architecture problem. |
| **P2** | UX, accessibility, SEO, maintainability, observability, and polish. |

---

## Milestone summary

| Milestone | Scope | Status |
| --- | --- | --- |
| P0-A | Emergency containment and removal of known unsafe behavior | In progress |
| P0-B | Real staff authentication, sessions, and role-based authorization | Not started |
| P0-C | Server-authoritative pricing and transactional order creation | Not started |
| P0-D | Privacy-safe customer access, cash controls, and secure initialization | Not started |
| P0-E | Security/integrity test suite and production gate | Not started |
| P1-A | Database correctness and migration discipline | Not started |
| P1-B | Restaurant workflow correctness | Not started |
| P1-C | KDS, analytics, and operational reliability | Not started |
| P2-A | Public routing, branding, locale, SEO, and accessibility | Not started |
| P2-B | Engineering quality, CI, observability, and deployment documentation | Not started |

---

# P0 — Critical security and financial integrity

## P0 exit criteria

Production use remains blocked until all of the following are true:

- [ ] No administrative page or mutation is protected only by browser state.
- [ ] Employee PINs are never returned by an API or stored in plaintext.
- [ ] All protected API handlers validate an authenticated server-side session and permission.
- [ ] Public endpoints return only the minimum customer-safe fields.
- [ ] Order prices, modifiers, discounts, tax, fees, loyalty, and totals are calculated on the server.
- [ ] Order creation is atomic and idempotent.
- [ ] Order references cannot collide under concurrent requests.
- [ ] The production seed HTTP endpoint is removed.
- [ ] Cash and inventory mutations require explicit permissions.
- [ ] P0 unit, integration, and authorization tests pass.
- [ ] TypeScript errors are no longer ignored for production builds.

---

## P0-A — Emergency containment

### P0-A01 Remove exposed quick-login credentials

- [ ] Remove the quick-login PIN buttons from `AdminLogin`.
- [ ] Remove all hardcoded demo PINs from production source.
- [ ] Keep optional demo credentials only in explicit development seed data.
- [ ] Ensure production UI never displays credentials.

**Acceptance criteria**

- No working PIN is visible in rendered HTML or client JavaScript.
- Repository search finds no production quick-login credential list.

### P0-A02 Stop exposing employee credentials and sensitive records

- [ ] Replace the public employee-list response with safe DTOs.
- [ ] Never return `pin`, future `pinHash`, salary/wage, email, or phone unless the requester has the required permission.
- [ ] Separate public staff-display data from administrative employee data.
- [ ] Add tests proving unauthenticated users cannot enumerate employees.

**Acceptance criteria**

- An unauthenticated request cannot retrieve employee credentials or private HR fields.
- The login flow never downloads all employee records.

### P0-A03 Disable unrestricted administrative mutations

Until the full authorization layer exists, protected mutations must fail closed.

- [ ] Add a temporary shared server guard for administrative API routes.
- [ ] Protect settings writes.
- [ ] Protect menu/category/modifier writes.
- [ ] Protect employee creation/update/delete and clock-management endpoints.
- [ ] Protect kitchen-screen and station writes.
- [ ] Protect KDS status mutations.
- [ ] Protect order administrative update/delete endpoints.
- [ ] Protect table/floor mutations.
- [ ] Protect inventory, waste, and purchase-order mutations.
- [ ] Protect cash drawer mutations.
- [ ] Protect offers, promos, dynamic pricing, testimonials, feedback moderation, and newsletter administration.
- [ ] Protect reports and analytics where they expose business data.

**Acceptance criteria**

- Every administrative mutation returns `401` without a session and `403` without permission.
- Public ordering, reservation creation, waitlist creation, newsletter signup, and feedback submission remain available only through validated public schemas.

### P0-A04 Stop accepting arbitrary database fields

- [ ] Remove direct `update: body` and similar mass-assignment patterns.
- [ ] Define allowlisted Zod schemas for every write endpoint.
- [ ] Reject unknown keys on protected mutations.
- [ ] Normalize validation errors into a consistent API response.

**Acceptance criteria**

- Sending an internal-only field from the browser cannot change that field.
- Unknown or invalid fields return `400` with a safe validation message.

### P0-A05 Restore build safety

- [ ] Remove `typescript.ignoreBuildErrors` from `next.config.ts`.
- [ ] Add a dedicated `typecheck` script.
- [ ] Fix all TypeScript errors revealed by the change.
- [ ] Re-enable React Strict Mode unless a documented blocker remains.
- [ ] Stop disabling high-value ESLint rules merely to obtain a passing build.

**Acceptance criteria**

- `bun run typecheck` passes.
- `bun run build` fails on future TypeScript regressions.

---

## P0-B — Authentication, sessions, and authorization

### P0-B01 Replace client-side PIN authentication

- [ ] Add a server-side login endpoint accepting a staff PIN.
- [ ] Look up eligible active employees server-side.
- [ ] Verify a hashed PIN using a password-hashing algorithm suitable for short secrets.
- [ ] Never compare credentials in the browser.
- [ ] Return only a generic invalid-credentials response.
- [ ] Add constant-time verification behavior where practical.

### P0-B02 Migrate plaintext PINs to hashes

- [ ] Add a `pinHash` field and remove operational dependence on plaintext `pin`.
- [ ] Write a controlled migration strategy for existing seeded employees.
- [ ] Hash seeded demo PINs during seed execution rather than storing hashes copied from source.
- [ ] Remove plaintext PINs after migration.
- [ ] Ensure logs and errors never contain a PIN.

**Acceptance criteria**

- The database contains no recoverable employee PIN.
- API responses and logs contain neither PIN nor hash.

### P0-B03 Add secure server-side sessions

- [ ] Use an HTTP-only, Secure, SameSite session cookie.
- [ ] Sign or persist sessions server-side.
- [ ] Add session expiry and idle timeout.
- [ ] Rotate the session identifier after successful login.
- [ ] Revoke sessions on logout.
- [ ] Add a `GET /api/auth/session`-style endpoint returning a safe staff profile.
- [ ] Remove `staffPin` from Zustand/localStorage.
- [ ] Persist only non-sensitive UI preferences in browser storage.

**Acceptance criteria**

- Editing localStorage cannot create an authenticated admin session.
- Protected APIs validate the cookie independently of the frontend.

### P0-B04 Login abuse protection

- [ ] Add per-IP and per-identity rate limiting.
- [ ] Add short temporary lockout after repeated failures.
- [ ] Record security-relevant login events without storing credentials.
- [ ] Prevent user enumeration through error messages or response timing.
- [ ] Define a safe recovery/reset process for owner/admin users.

### P0-B05 Role-based access control

Implement a central permission model rather than checking page visibility.

- [ ] Define roles: owner, admin, manager, cashier, server, host, kitchen, inventory manager, analyst, and read-only where needed.
- [ ] Define granular permissions for orders, payments, refunds, cash, menu, settings, staff, inventory, reports, KDS, reservations, and tables.
- [ ] Add `requireSession()`.
- [ ] Add `requirePermission()`.
- [ ] Apply permissions inside API handlers, not only UI components.
- [ ] Hide or disable UI actions the current user cannot perform.
- [ ] Add authorization tests for each protected resource.

### P0-B06 CSRF and browser-request protection

- [ ] Ensure state-changing cookie-authenticated requests are protected from cross-site request forgery.
- [ ] Validate allowed origins for sensitive requests.
- [ ] Use SameSite cookies as defense in depth, not as the only control.
- [ ] Reject unsafe content types where appropriate.

### P0-B07 Security audit log

- [ ] Add an immutable audit-event model.
- [ ] Record actor, action, entity type, entity ID, timestamp, request/session identifier, and safe before/after metadata.
- [ ] Audit settings changes, menu price changes, employee changes, discounts, voids, refunds, cash movements, inventory adjustments, and permission changes.
- [ ] Prevent normal users from altering audit records.

---

## P0-C — Server-authoritative order and pricing engine

### P0-C01 Define a minimal public order request

The browser may send only customer input and selections, not authoritative financial values.

- [ ] Accept order type, customer contact fields, table reference or delivery address, notes, item IDs, quantities, modifier IDs, course, and optional promo code.
- [ ] Stop accepting trusted `subtotal`, `taxAmount`, `deliveryFee`, `discountAmount`, `tipAmount`, `total`, `paymentStatus`, and arbitrary `unitPrice`/`totalPrice` values.
- [ ] Reject invalid quantities, duplicate malformed lines, unavailable items, and unknown IDs.
- [ ] Enforce practical payload-size and line-count limits.

### P0-C02 Server-side price calculation service

- [ ] Load current item prices from the database.
- [ ] Validate modifier groups, required selections, minimums, maximums, and option ownership.
- [ ] Calculate modifier prices on the server.
- [ ] Validate active dynamic-pricing rules.
- [ ] Validate promo code status, date range, eligibility, and usage rules.
- [ ] Calculate discounts, taxes, delivery fees, tips, and final totals server-side.
- [ ] Round monetary values through one shared money utility.
- [ ] Return the authoritative calculation to the client.

**Acceptance criteria**

- A tampered request cannot obtain a lower total than the server calculation.
- An option belonging to another menu item cannot be submitted.
- Unavailable menu items cannot be ordered.

### P0-C03 Payment-state integrity

- [ ] Public order creation always starts in the permitted unpaid/payment-pending state.
- [ ] Prevent clients from marking their own order as paid.
- [ ] Restrict payment confirmation to authorized cashier/payment flows.
- [ ] Record payment events separately from order fields.
- [ ] Do not grant loyalty from an untrusted client total.

### P0-C04 Collision-safe order references

- [ ] Replace `count + 1001` order-number generation.
- [ ] Use a database-backed sequence/counter or another transaction-safe strategy.
- [ ] Keep the internal primary key separate from the human-readable order reference.
- [ ] Add a unique constraint and a concurrency test.
- [ ] Define whether references reset per branch/day/year or never reset.

### P0-C05 Idempotent order submission

- [ ] Require or generate an idempotency key for order creation.
- [ ] Store request identity and the resulting order.
- [ ] Return the original result on safe retries.
- [ ] Prevent double orders from double-clicks, mobile reconnects, or gateway retries.

### P0-C06 Atomic order transaction

Run related database changes in one transaction.

- [ ] Create order and order items atomically.
- [ ] Link or create the customer atomically where applicable.
- [ ] Update loyalty only from the authoritative amount and correct business event.
- [ ] Update the resolved table, not only a client-provided `tableId`.
- [ ] Validate table status before assignment.
- [ ] Ensure a failed operation rolls back every related change.
- [ ] Publish KDS updates only after transaction success.

### P0-C07 Reliable KDS event delivery

- [ ] Add an outbox/event record in the order transaction.
- [ ] Deliver KDS events after commit.
- [ ] Retry failed event delivery.
- [ ] Keep polling as a fallback.
- [ ] Do not silently lose all visibility into repeated broadcast failures.

### P0-C08 Order-state transition rules

- [ ] Define valid order transitions.
- [ ] Define valid order-item transitions.
- [ ] Reject invalid jumps and unknown states.
- [ ] Record completion/cancellation timestamps consistently.
- [ ] Require appropriate permissions for cancellation, void, recall, and completion.

---

## P0-D — Privacy, initialization, cash, and sensitive operations

### P0-D01 Remove the production seed HTTP endpoint

- [ ] Delete `/api/seed`.
- [ ] Remove the predictable fallback seed secret.
- [ ] Add a deployment-safe CLI seed/bootstrap process.
- [ ] Make production bootstrap explicit and idempotent.
- [ ] Document development seed versus production initialization.
- [ ] Ensure secrets are never passed in query strings.

### P0-D02 Privacy-safe order tracking

- [ ] Replace predictable access based only on sequential order number.
- [ ] Generate a separate opaque tracking token.
- [ ] Require exact lookup, never `startsWith`.
- [ ] Return a customer-safe tracking DTO instead of the full database order.
- [ ] Exclude private customer, employee, internal note, pricing-rule, and database fields.
- [ ] Rate-limit tracking requests.

### P0-D03 Protect reservation data

- [ ] Public callers may create a reservation through a strict schema.
- [ ] Public callers cannot list all reservations.
- [ ] Customer lookup requires a secure ownership mechanism or opaque confirmation token.
- [ ] Staff listing and management require reservation permissions.
- [ ] Return separate public and staff DTOs.

### P0-D04 Protect waitlist data

- [ ] Public callers may join through a strict schema.
- [ ] Public callers cannot enumerate the active queue or customer phone numbers.
- [ ] Customer status lookup requires an opaque token.
- [ ] Staff queue management requires host/manager permission.

### P0-D05 Protect business analytics and reports

- [ ] Require an analyst/manager permission for revenue, sales, employee, cash, and inventory reports.
- [ ] Ensure public responses expose no business-sensitive aggregates.
- [ ] Bound all date ranges and pagination inputs.

### P0-D06 Cash endpoint containment

- [ ] Require cashier/manager permission for all cash reads and writes.
- [ ] Validate cash movement type and positive amount.
- [ ] Derive actor from the session rather than `createdBy` supplied by the client.
- [ ] Remove the misleading balance calculation based only on the last 100 entries.
- [ ] Calculate the current balance from an explicit open register session or full authoritative ledger.
- [ ] Audit every manual pay-in, payout, drop, refund, and adjustment.

### P0-D07 Inventory mutation containment

- [ ] Require inventory permission for stock mutations.
- [ ] Reject negative/zero waste quantities where invalid.
- [ ] Prevent arbitrary generic PATCH updates.
- [ ] Make waste creation and stock reduction atomic.
- [ ] Prevent inventory from becoming invalid without an authorized adjustment flow.

### P0-D08 Error and log safety

- [ ] Stop returning raw database exception messages to public callers.
- [ ] Use stable error codes and safe messages.
- [ ] Add request IDs for support/debugging.
- [ ] Ensure logs do not contain PINs, session tokens, full customer payloads, or secrets.
- [ ] Disable production Prisma query logging by default.

---

## P0-E — Validation and release gate

### P0-E01 Unit tests

- [ ] Pricing calculations.
- [ ] Modifier validation.
- [ ] Promo eligibility.
- [ ] Tax/delivery/tip rounding.
- [ ] Order transition rules.
- [ ] Permission checks.
- [ ] Tracking DTO redaction.
- [ ] Login rate-limit/lockout behavior.

### P0-E02 Integration tests

- [ ] Login creates a secure session.
- [ ] Logout revokes the session.
- [ ] Unauthenticated protected mutations return `401`.
- [ ] Authenticated but unauthorized mutations return `403`.
- [ ] Employee PIN/private fields cannot be enumerated.
- [ ] Tampered order totals are ignored or rejected.
- [ ] Concurrent order creation produces unique references.
- [ ] Duplicate idempotency keys do not create duplicate orders.
- [ ] A failed order side effect rolls back the transaction.
- [ ] Public reservation/waitlist/order APIs cannot enumerate other customers.

### P0-E03 End-to-end smoke tests

- [ ] Staff login and logout.
- [ ] Authorized menu update.
- [ ] Customer adds configured modifiers and places an order.
- [ ] KDS receives or polls the new order.
- [ ] Kitchen progresses the ticket through valid states.
- [ ] Customer tracks the order with an opaque token.
- [ ] Cashier records payment through an authorized flow.

### P0-E04 Production readiness gate

- [ ] `bun run lint` passes with meaningful rules.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes.
- [ ] `bun run build` passes without ignored errors.
- [ ] Database migration deploy succeeds against a clean database.
- [ ] Database migration deploy succeeds against a copy of existing data.
- [ ] No P0 checkbox remains open.
- [ ] A security-focused review is completed before merge/deployment.

---

# P1 — Correctness, workflows, and architecture

## P1-A — Database and financial model correctness

### P1-A01 Replace floating-point money

- [ ] Convert menu prices, modifier prices, order amounts, tax, tips, discounts, wages, inventory costs, gift-card balances, customer spending, cash values, and pricing multipliers where appropriate to `Decimal` or smallest-unit integers.
- [ ] Define precision and rounding rules per supported currency.
- [ ] Migrate existing values safely.
- [ ] Add money serialization helpers.

### P1-A02 Commit and enforce Prisma migrations

- [ ] Stop ignoring `prisma/migrations/`.
- [ ] Commit a baseline migration.
- [ ] Use `prisma migrate deploy` in production.
- [ ] Reserve `db push` for controlled development use.
- [ ] Add migration checks to CI.
- [ ] Document backup and rollback procedures.

### P1-A03 Add domain enums and constraints

- [ ] Order type/status.
- [ ] Order-item status.
- [ ] Payment status/method/type.
- [ ] Employee role.
- [ ] Table status/shape/section where appropriate.
- [ ] Reservation and waitlist status.
- [ ] Cash movement type.
- [ ] Kitchen screen type/layout.
- [ ] Inventory movement type.
- [ ] Promotion type.

### P1-A04 Fix timestamp semantics

- [ ] Change mutable model timestamps to `@updatedAt` where appropriate.
- [ ] Add explicit event timestamps for business events.
- [ ] Standardize UTC storage and restaurant-timezone presentation.

### P1-A05 Add payment, refund, and void records

- [ ] Add immutable payment transactions.
- [ ] Support split payments.
- [ ] Support refunds tied to original payments and order lines.
- [ ] Support void reasons and manager approval.
- [ ] Prevent destructive deletion of financially relevant orders.
- [ ] Reconcile order payment state from transactions.

### P1-A06 Add branch/tenant boundaries if multi-location is required

- [ ] Decide single restaurant versus multi-branch architecture.
- [ ] Add `restaurantId`/`branchId` ownership where required.
- [ ] Scope sessions, order references, tables, settings, staff, inventory, reports, and KDS to the branch.
- [ ] Add tenant-isolation tests.

### P1-A07 Add indexes and retention rules

- [ ] Index common order, customer, reservation, KDS, inventory, audit, and report filters.
- [ ] Add pagination to list endpoints.
- [ ] Define retention/anonymization policy for customer and audit data.

---

## P1-B — Restaurant workflow correctness

### P1-B01 Cash register sessions

- [ ] Add register/device identity.
- [ ] Add opening float.
- [ ] Assign cashier and opening time.
- [ ] Link sales, refunds, pay-ins, payouts, and drops.
- [ ] Calculate expected closing balance.
- [ ] Record actual count and discrepancy.
- [ ] Require manager approval for configured differences.
- [ ] Prevent edits to closed sessions.

### P1-B02 Employee timekeeping

- [ ] Add immutable clock/time-entry records.
- [ ] Record breaks.
- [ ] Support manager corrections with audit history.
- [ ] Calculate hours from entries rather than only current employee fields.
- [ ] Define overnight-shift and timezone behavior.

### P1-B03 Recipe and stock ledger

- [ ] Add recipe/BOM relationships between menu items and ingredients.
- [ ] Add units and conversions.
- [ ] Add immutable stock movements.
- [ ] Consume stock from completed/confirmed production according to the selected policy.
- [ ] Reverse stock correctly for voids/refunds where appropriate.
- [ ] Add receiving and adjustment workflows.
- [ ] Prevent negative stock unless explicitly allowed.

### P1-B04 Purchase orders

- [ ] Add purchase-order lines.
- [ ] Add supplier identity and terms.
- [ ] Add draft/submitted/received/cancelled workflow.
- [ ] Support partial receiving.
- [ ] Create stock receipts from received quantities.
- [ ] Preserve price and quantity history.

### P1-B05 Waste workflow

- [ ] Validate quantity/unit/reason.
- [ ] Require employee identity from session.
- [ ] Support approval thresholds.
- [ ] Produce a stock movement and cost impact.
- [ ] Report waste by ingredient, reason, branch, and employee.

### P1-B06 Reservation availability engine

- [ ] Reject past dates and times.
- [ ] Respect opening hours, holidays, and closure periods.
- [ ] Validate party size and table capacity.
- [ ] Prevent overlapping table assignments.
- [ ] Model reservation duration/turn time.
- [ ] Support unassigned reservation capacity planning.
- [ ] Handle cancellation/no-show/seated/completed transitions.
- [ ] Send safe confirmation and management tokens.

### P1-B07 Waitlist engine

- [ ] Prevent accidental duplicate active entries.
- [ ] Estimate using table capacity, party size, queue position, reservations, and turnover history.
- [ ] Support notify, confirm, seat, cancel, and no-show transitions.
- [ ] Record notification timestamps and expiry.
- [ ] Assign compatible tables.

### P1-B08 Loyalty and gift cards

- [ ] Grant points only on configured paid/completed events.
- [ ] Reverse points on refunds/voids.
- [ ] Add immutable point transactions.
- [ ] Secure gift-card codes and balances.
- [ ] Add gift-card redemption transactions and concurrency protection.

---

## P1-C — KDS, analytics, and operational reliability

### P1-C01 Production-ready KDS transport

- [ ] Choose a deployable realtime architecture: persistent Socket.IO service with shared broker, authenticated SSE, or managed realtime provider.
- [ ] Add service authentication.
- [ ] Support multiple app instances.
- [ ] Add reconnect/resubscribe behavior.
- [ ] Add health checks and metrics.
- [ ] Document deployment of every required process.
- [ ] Keep bounded polling fallback.

### P1-C02 Correct KDS totals and state

- [ ] Replace client-side “latest 200” daily counting with an aggregate endpoint.
- [ ] Use restaurant timezone for operational-day boundaries.
- [ ] Support station/course/hold/fire workflows consistently.
- [ ] Prevent unauthorized ticket mutation.
- [ ] Add recall and bump audit events.

### P1-C03 Correct revenue analytics

- [ ] Base recognized revenue on paid/completed transactions according to accounting policy.
- [ ] Deduct refunds and voids correctly.
- [ ] Exclude unpaid and cancelled orders.
- [ ] Rename “Items Sold” or calculate actual quantity sold.
- [ ] Use database aggregation instead of loading all rows into application memory.
- [ ] Bound date ranges and paginate details.
- [ ] Use restaurant timezone consistently.
- [ ] Read business hours from settings rather than hardcoding 10:00–23:00.

### P1-C04 Background jobs and outbox processing

- [ ] Add a durable worker strategy for KDS events, notifications, email/SMS, analytics rollups, and retries.
- [ ] Add dead-letter handling.
- [ ] Make jobs idempotent.
- [ ] Add operational visibility for failed jobs.

### P1-C05 Backup and recovery

- [ ] Define automated database backups.
- [ ] Test restore procedure.
- [ ] Define point-in-time recovery expectations.
- [ ] Protect and back up uploaded assets/configuration.
- [ ] Document disaster-recovery steps.

---

# P2 — UX, accessibility, SEO, maintainability, and polish

## P2-A — Public and admin experience

### P2-A01 Convert public sections into real routes

- [ ] Add routes for home, menu, cart/checkout, reservations, waitlist, rewards, contact, and order tracking.
- [ ] Preserve deep links and browser Back/Forward behavior.
- [ ] Add route-level loading and error states.
- [ ] Code-split major sections.
- [ ] Keep cart state durable without treating navigation state as the router.

### P2-A02 Dynamic branding everywhere

- [ ] Remove remaining hardcoded “Saffron & Spice” text and chili branding from production UI.
- [ ] Use configured name, logo, favicon, description, colors, contact details, and social links.
- [ ] Generate dynamic metadata and social previews.
- [ ] Apply branding to admin, KDS, tracking, receipts, and customer pages.

### P2-A03 Server-aware English/Arabic locale

- [ ] Move locale selection to a URL segment or server-readable cookie.
- [ ] Render correct `lang` and `dir` on the server.
- [ ] Persist locale without hydration flicker.
- [ ] Localize metadata, validation, empty states, emails, receipts, and tracking.
- [ ] Verify RTL layout throughout the app.

### P2-A04 Accessibility pass

- [ ] Add associated labels to all form fields.
- [ ] Add accessible names to icon-only buttons.
- [ ] Use semantic navigation and `aria-current`.
- [ ] Add keyboard-visible focus states.
- [ ] Validate dialog focus trapping and return focus.
- [ ] Support reduced motion.
- [ ] Check color contrast.
- [ ] Test with keyboard and screen reader.

### P2-A05 Error, loading, and offline behavior

- [ ] Show useful server validation errors during checkout.
- [ ] Prevent duplicate submits while pending.
- [ ] Add retry states for menu/settings/network failures.
- [ ] Add clear empty states.
- [ ] Add safe degraded behavior when KDS realtime is unavailable.
- [ ] Decide whether POS/KDS require offline support and document the strategy.

### P2-A06 Opening-hours correctness

- [ ] Support minutes, weekdays, holidays, exceptions, and overnight schedules.
- [ ] Store the restaurant timezone.
- [ ] Calculate open/closed state server-side or with a shared timezone-aware utility.
- [ ] Apply the same rules to ordering and reservations.

### P2-A07 Admin information architecture

- [ ] Unify standalone admin pages with authenticated admin layout and authorization.
- [ ] Improve mobile/tablet workflows for servers, hosts, cashiers, and kitchen staff.
- [ ] Reduce duplicated navigation and settings fetches.
- [ ] Add actionable empty states and confirmation dialogs.

### P2-A08 Receipts and printing

- [ ] Add configurable receipt templates.
- [ ] Support browser/A4 and receipt-printer layouts as required.
- [ ] Include tax, discounts, payment, order reference, and restaurant details.
- [ ] Support Arabic/English and RTL printing.
- [ ] Restrict reprints and record them where required.

---

## P2-B — Engineering quality and operations

### P2-B01 Restore meaningful lint rules

- [ ] Re-enable unused-variable, unreachable-code, hooks-dependency, purity, debugger, and related high-value rules.
- [ ] Document narrow exceptions inline.
- [ ] Remove blanket rule suppression.

### P2-B02 Test and CI pipeline

- [ ] Add unit-test command.
- [ ] Add integration-test command.
- [ ] Add end-to-end-test command.
- [ ] Run lint, typecheck, tests, build, and migration validation in GitHub Actions.
- [ ] Block merge on failing required checks.
- [ ] Add dependency and secret scanning.

### P2-B03 Observability

- [ ] Add structured application logging.
- [ ] Add request IDs and actor/session correlation.
- [ ] Add error monitoring.
- [ ] Add metrics for orders, payment failures, login failures, KDS delivery, job retries, API latency, and database health.
- [ ] Add health/readiness endpoints that reveal no sensitive data.
- [ ] Configure alerting for critical failures.

### P2-B04 Performance

- [ ] Add pagination to large lists.
- [ ] Replace unnecessary client fetches with server rendering where useful.
- [ ] Cache public settings/menu safely with invalidation.
- [ ] Optimize images and remove oversized assets.
- [ ] Review client bundle size.
- [ ] Add database query profiling in controlled non-production environments.

### P2-B05 Deployment documentation

- [ ] Document required environment variables without real secrets.
- [ ] Document web, worker, realtime, and migration processes.
- [ ] Document first production bootstrap.
- [ ] Document backup, restore, rollback, and incident procedures.
- [ ] Document supported Bun/Node/PostgreSQL versions.
- [ ] Document local development and test setup.

### P2-B06 Dependency and configuration cleanup

- [ ] Remove unused dependencies, including authentication packages not used by the chosen implementation.
- [ ] Ensure one lockfile/package-manager strategy.
- [ ] Review experimental or unnecessary SDK dependencies.
- [ ] Validate security headers and content-security policy.
- [ ] Validate production cache and image-host configuration.

---

# Planned implementation sequence

The following sequence keeps individual changes reviewable and reduces the risk of mixing security work with broad redesigns.

## Change set 1 — Tracking and containment

- [x] Create this remediation plan.
- [x] Create `agent/p0-hardening` from `main`.
- [ ] Remove quick PIN UI.
- [ ] Remove employee credential exposure.
- [ ] Remove `/api/seed`.
- [ ] Disable production query logging.
- [ ] Add temporary fail-closed protection to admin mutations.

## Change set 2 — Authentication foundation

- [ ] Add PIN hashing and migration/bootstrap support.
- [ ] Add login/session/logout endpoints.
- [ ] Remove sensitive auth state from Zustand/localStorage.
- [ ] Add login rate limiting.
- [ ] Protect admin routes.

## Change set 3 — Authorization and validation

- [ ] Add role/permission definitions.
- [ ] Add shared authorization helpers.
- [ ] Add strict schemas and safe DTOs.
- [ ] Apply guards to every protected API.
- [ ] Add audit logging foundation.

## Change set 4 — Order integrity

- [ ] Add server pricing service.
- [ ] Replace client-authoritative order payload.
- [ ] Add safe order reference generation.
- [ ] Add idempotency.
- [ ] Add atomic transaction and table/customer/loyalty fixes.
- [ ] Add reliable KDS outbox delivery.

## Change set 5 — Privacy and sensitive operations

- [ ] Add opaque order-tracking tokens and redacted DTOs.
- [ ] Secure reservation and waitlist lookups.
- [ ] Protect reports.
- [ ] Correct and protect cash/inventory operations.
- [ ] Normalize errors and logging.

## Change set 6 — P0 validation

- [ ] Add unit tests.
- [ ] Add integration tests.
- [ ] Add end-to-end smoke tests.
- [ ] Restore strict build/type checks.
- [ ] Complete security review and close P0 gate.

---

# Decisions to record during implementation

These decisions should be documented here when finalized:

- [ ] Authentication/session library and storage strategy.
- [ ] Password/PIN hashing algorithm and parameters.
- [ ] Session lifetime and idle timeout.
- [ ] Permission matrix.
- [ ] CSRF strategy.
- [ ] Money representation and rounding policy.
- [ ] Human-readable order reference format.
- [ ] Idempotency retention period.
- [ ] Revenue recognition policy.
- [ ] Loyalty earning/reversal policy.
- [ ] Single-location versus multi-branch scope.
- [ ] Restaurant timezone and operational-day boundary.
- [ ] KDS realtime deployment architecture.
- [ ] Notification providers.
- [ ] Backup and recovery targets.

---

# Change log

| Date | Change | Validation |
| --- | --- | --- |
| 2026-07-30 | Created remediation roadmap and P0 tracking branch. | Plan reviewed against the initial repository audit. |
