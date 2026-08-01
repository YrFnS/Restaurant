# P1 Loyalty and Gift-Card Ledgers

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-loyalty-gift-cards`  
> **Base:** merged waitlist foundation on `main`  
> **Status:** completed and validated  
> **Scope:** trusted earning, checkout redemption, refund reconciliation, immutable loyalty history, exact gift-card balances, private redemption credentials, and bilingual operations  
> **Validated implementation head:** `ec659035f51598c36d1aebb041096e9c1328c05b`  
> **Evidence:** P0 Validation #1084 and P0 Integration #930

## Purpose

The legacy loyalty and gift-card models are mutable summaries:

- `Customer.loyaltyPoints`, `totalSpent`, and `visits` can be changed without an immutable source;
- the public rewards screen displays points but redemption is deliberately disabled;
- `GiftCard.balance` and `isRedeemed` can be rewritten without a transaction trail;
- gift cards do not participate in checkout or payment reversals;
- refunds and voids do not reconcile points or stored value.

This slice makes successful payment events the trusted trigger for loyalty and makes every gift-card balance change append-only, exact, idempotent, and auditable.

## Loyalty policy

- Points are earned only after a successful payment capture.
- The eligible earning base is the order subtotal after all discounts, excluding tax, delivery fees, and tips.
- The default earning rate is one point per whole currency unit of eligible spend. Fractional currency units do not earn partial points.
- Points do not expire in this slice. A future expiration policy requires explicit FIFO earning-bucket allocation and is not simulated by rewriting balances.
- Checkout redemption uses a configurable number of points per currency unit and a configurable redemption increment.
- Redemption cannot exceed the customer's available points or the remaining merchandise subtotal after existing discounts.
- A successful checkout may append a redemption event and an earning event in one transaction.
- Refunds and voids append cumulative, proportionally calculated earning reversals. A full reversal removes all points earned by that capture.
- Redeemed points are restored proportionally when the corresponding payment is refunded or voided. A full reversal restores every redeemed point.
- Earn-reversal events may make a loyalty balance negative when a customer has already spent points earned by the refunded purchase. Financial history is not blocked or rewritten to hide that liability.
- Manual manager adjustments require an idempotency key, reason code, explanation, actor, and audit event.
- `Customer.loyaltyPoints`, `totalSpentMinor`, `totalSpent`, and `visits` remain compatibility caches maintained transactionally from trusted ledgers.

## Gift-card policy

- New cards have a public reference plus a separate high-entropy redemption code.
- Only a SHA-256 hash and the final four characters of the redemption code are stored. The complete redemption code is returned only once at issuance.
- Existing card codes are adopted as legacy redemption credentials by hashing the current code during migration. APIs never return the legacy full code.
- All balances use exact minor-unit integers.
- Every balance change is an immutable `GiftCardTransaction`:
  - `opening_balance` for adopted legacy cards;
  - `issue` for a newly created card;
  - `redeem` for checkout tender;
  - `refund` for a payment reversal returning value;
  - `adjustment` for reviewed manager corrections or top-ups;
  - `void` for reviewed closure of the remaining balance;
  - `expiration` for optional future expiry processing.
- A positive adjustment increases both cumulative loaded value and current balance. A negative adjustment reduces current balance only.
- Redemption cannot overdraw a card and serializes on the card row.
- Refund transactions must reference an earlier redemption and cannot restore more than the amount previously redeemed.
- A void or expiration transaction must remove the complete remaining balance.
- Transaction rows cannot be updated or deleted. Corrections require another transaction.
- Public balance lookup is rate-limited, non-cacheable, and returns only masked card details, status, balance, currency, and expiry.
- Online card purchase is deferred until a real payment processor or cash-sale workflow can fund issuance. In this slice, issuance is a privileged manager action with immutable audit evidence.

## Checkout allocation

Checkout applies value in this order:

1. validate and append an optional loyalty redemption, reducing the order discount and total;
2. redeem an optional gift card up to the remaining amount due;
3. collect the remaining amount in cash.

The payment event records:

- `cash` when no stored value is used;
- `gift_card` when the card covers the complete amount due;
- `split` when gift card and cash are both used.

The immutable capture metadata stores the cash portion, gift-card transaction, loyalty redemption, loyalty earning result, and normalized request fingerprint. Cash-drawer revenue records only the cash portion.

## Payment reversal allocation

Without item-level refund allocation, this slice uses a deterministic tender policy:

- refund gift-card-funded value first, up to the unreversed gift-card contribution;
- refund any remainder in cash;
- a void reverses every original tender component in full;
- returned gift-card value is appended to the same card through a parent-linked refund transaction;
- the cash drawer records only the cash portion returned;
- loyalty earning reversals and redemption restores use cumulative proportional calculations so multiple partial refunds do not accumulate rounding errors.

Item-level tax, discount, and tender allocation remains deferred.

## Data model

### `LoyaltyPointEvent`

Stores:

- unique idempotency key;
- customer and optional order/payment-event references;
- event type and signed point delta;
- resulting balance;
- optional parent event;
- actor, reason, metadata, occurrence time, and creation time.

### `GiftCardTransaction`

Stores:

- unique idempotency key;
- gift card and optional order/payment-event references;
- transaction type and signed exact amount;
- resulting exact balance;
- optional parent transaction;
- actor, reason, metadata, occurrence time, and creation time.

### `GiftCard`

Adds:

- hashed redemption credential and last four characters;
- explicit status and currency;
- issue, optional expiry, void, and actor snapshots;
- relations to immutable transactions.

## API surface

### Loyalty

- `GET /api/loyalty`
  - staff search/detail and immutable history.
- `POST /api/loyalty`
  - manager adjustment with idempotency and reason.
- existing customer ownership lookup returns an allowlisted loyalty summary and recent events.

### Gift cards

- `GET /api/gift-cards`
  - staff list/detail with masked credentials and history.
- `POST /api/gift-cards`
  - privileged issue; returns the full redemption code once.
- `PATCH /api/gift-cards/:id`
  - reviewed adjustment or void.
- `POST /api/gift-cards/lookup`
  - public rate-limited masked balance lookup.

### Checkout and reversals

- `POST /api/pos/checkout`
  - optional loyalty points and gift-card redemption code/amount;
  - exact server-side credit and tender allocation.
- `POST /api/orders/:id/payments`
  - returns gift-card value and loyalty changes transactionally with the financial reversal.

## Concurrency and database boundaries

- Customer and gift-card rows are locked before ledger inserts.
- Idempotency keys are globally unique within each ledger.
- PostgreSQL triggers calculate and persist resulting balances.
- Direct ledger updates/deletes are rejected.
- Checkout locks the order, customer, gift card, and register session in a stable order.
- Gift-card overdraw, duplicate earning, duplicate redemption, duplicate restoration, and excessive refund restoration are rejected by database constraints or transaction locks.
- Transient deadlock/serialization failures return an explicit retryable conflict.

## Operator and customer experience

The bilingual administration workflow provides:

- customer search and point balance/history;
- reviewed point adjustments;
- gift-card issue with one-time code display;
- masked card search, current balance, status, expiry, and transaction history;
- reviewed card adjustments and voids.

The customer rewards workflow provides:

- trusted balance and point history from owned orders;
- clear earning/redemption policy;
- masked gift-card balance lookup;
- no exposure of customer phone, gift-card secret, actor-only notes, or internal identifiers.

The POS payment dialog provides:

- customer point lookup when an order has a phone number;
- selectable valid redemption increments;
- gift-card code validation and applied value;
- recalculated amount due, cash tender, and change;
- receipt summary for loyalty and gift-card effects.

## Validation result

The implementation checkpoint `ec659035f51598c36d1aebb041096e9c1328c05b` passed P0 Validation #1084 and P0 Integration #930. The permanent gates covered locked installation, Prisma validation and generation, strict TypeScript, source/security inventories, ESLint, production build, clean PostgreSQL deployment, complete P0/P1 regression, the dedicated loyalty/gift-card suite, and representative existing-data adoption.

Completed evidence:

- clean migration deployment and representative existing-data adoption;
- Prisma mappings and BigInt omission policy;
- strict TypeScript, source-policy tests, ESLint, and production build;
- earning from successful capture only;
- exact redemption and order-total reconciliation;
- gift-card-only and gift-card-plus-cash checkout;
- one-time secret return and masked public lookup;
- replay-safe checkout with changed-payload rejection;
- concurrent gift-card redemption with no overdraw;
- partial/full refund and void tender reconciliation;
- proportional loyalty earning reversal and redemption restoration;
- manager adjustment and void authorization;
- customer cache reconciliation;
- database immutability and audit evidence;
- complete P0 and earlier P1 regression coverage.

## Explicitly deferred

- loyalty-point expiration buckets;
- online gift-card purchase and processor settlement;
- gift-card transfer between customers;
- physical card inventory and activation at external terminals;
- item-level refund, tax, discount, and tender allocation;
- general multi-tender and card-processor settlement;
- promotional point multipliers and campaign rules;
- multi-branch card liability and loyalty scoping;
- SMS/email delivery of gift-card credentials;
- destructive removal of legacy loyalty, spend, and gift-card compatibility fields.
