# P1 Payment Reversals

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-payment-reversals`  
> **Stacked base:** `agent/p1-cash-register-sessions`  
> **Scope:** immutable refunds, payment voids, cash-session effects, and order payment-state reconciliation

## Purpose

A paid order previously had no supported reversal workflow. Changing `paymentStatus` directly would not return cash, create an immutable financial event, identify the original capture, record a reason, or prevent duplicate and excessive reversals.

This slice makes every refund and void an append-only event linked to the original successful capture.

## Financial event model

`PaymentEvent` remains the authoritative ledger. Reversal events add:

- `parentEventId`, referencing the original successful capture;
- a reviewed reason code;
- a required human-readable reason;
- the register session that supplied returned cash;
- the manager who authorized the action;
- a unique idempotency key.

A refund may reverse part or all of the remaining capture. A void must reverse an untouched capture in full.

## Database guarantees

The migration enforces the following independently of the application:

1. Refunds and voids must reference a successful capture.
2. Parent and reversal must belong to the same order.
3. Payment method and currency must match the original capture.
4. Reversal amount must be positive.
5. Total successful reversals cannot exceed the captured amount.
6. A void must be the first and full reversal.
7. Only one successful void may reference a capture.
8. Reversal reason code and reason are required.
9. Payment events cannot be updated or deleted; corrections require another event.
10. The original capture row is locked while a reversal is inserted, serializing concurrent requests.

## Cash behavior

Cash reversals require an explicitly identified open register session:

```text
X-Register-Id
X-Register-Device-Id
```

The reversal transaction:

1. locks the order and original capture;
2. locks the current open register session;
3. creates a negative-effect `CashDrawerEntry` of type `refund`;
4. creates the parent-linked `PaymentEvent`;
5. links both records to the same register session;
6. reconciles the order payment status;
7. appends an immutable audit event.

A reversal cannot use the legacy headerless checkout fallback. Returned cash must always be attributed to a real open register.

## Order payment states

- Partial refund: `partially_refunded`
- Full refund: `refunded`
- Full void: `voided`

Operational order status is intentionally separate. A completed order remains completed after a refund. A completed order cannot be voided and must use the refund flow.

## Authorization

- Payment ledger read: owner, administrator, manager, or cashier.
- Refund or void: owner, administrator, or manager.
- Staff authorization runs before request-body parsing.

## API

### `GET /api/orders/:id/payments`

Returns a redacted ledger summary containing the capture, reversal events, captured amount, reversed amount, remaining refundable amount, and allowed next actions.

### `POST /api/orders/:id/payments`

Requires `Idempotency-Key`, register headers, and a manager session.

Refund example:

```json
{
  "action": "refund",
  "amount": 12.5,
  "reasonCode": "customer_request",
  "reason": "Customer returned the unopened item"
}
```

Void example:

```json
{
  "action": "void",
  "reasonCode": "duplicate_charge",
  "reason": "Duplicate order was charged before kitchen preparation"
}
```

## Operator workflow

`/admin/payment-reversals` provides a bilingual manager console that:

- lists paid and reversed orders;
- displays the immutable capture and reversal history;
- shows captured, reversed, and remaining amounts;
- requires an open register;
- supports partial and full refunds;
- permits a void only when the capture is untouched and the order is not completed;
- sends a unique idempotency key;
- refreshes order and register data after success.

## Validation gate

This branch is complete only when all of the following pass:

- Prisma schema validation and generation;
- migration deployment on an empty PostgreSQL database;
- representative existing-data migration rehearsal;
- strict TypeScript, source inventories, ESLint, and production build;
- complete P0 and earlier P1 regression suites;
- manager-only reversal authorization;
- cashier read access but reversal denial;
- exact partial and full refunds;
- void eligibility rules;
- idempotent replay;
- concurrent over-refund prevention;
- cross-order parent rejection;
- register-session and cash-ledger linkage;
- order payment-state reconciliation;
- immutable event and audit assertions.

## Deferred

- card-processor refunds and authorization reversals;
- split-tender allocation and per-tender reversal;
- item-level refund allocation and tax adjustment detail;
- customer notification and receipt printing;
- loyalty and gift-card reversal ledgers;
- refund approval thresholds below manager level;
- offline reversal synchronization.
