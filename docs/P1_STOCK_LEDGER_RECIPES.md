# P1 Recipes and Immutable Stock Ledger

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-stock-ledger-recipes`  
> **Stacked base:** `agent/p1-payment-reversals`  
> **Validated head:** `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d`  
> **Scope:** exact ingredient balances, unit conversions, versioned recipes, immutable stock movements, production consumption, waste, receiving, and corrections  
> **Release status:** source-level implementation is green; the PR remains a draft stacked branch until the preceding P1 pull requests are merged.

## Purpose

The legacy inventory implementation stores one mutable floating-point quantity on each ingredient. Waste directly decrements that field, order production does not consume recipes, purchase receipts do not create stock history, and a manager can replace the current quantity without an auditable explanation.

This slice makes the stock ledger authoritative. Ingredient balances remain cached for fast reads, but every supported balance change is produced by an immutable movement with an actor, source, reason, exact quantity, cost snapshot, and resulting balance.

## Quantity representation

Inventory quantities use base-unit micros:

```text
1 base unit = 1,000,000 quantity micros
```

Examples:

```text
1 kg      = 1,000,000 micros when the ingredient base unit is kg
0.250 kg  =   250,000 micros
200 g     =   200,000 micros after a 0.001 kg-per-g conversion
```

The existing `Ingredient.quantity` float remains as a compatibility/read field during this slice. `Ingredient.quantityMicros` is authoritative and the database keeps the two values synchronized after each ledger movement.

## Data model

### Ingredient extensions

- exact `quantityMicros` balance;
- `allowNegativeStock` policy, disabled by default;
- existing `unit` remains the ingredient base unit;
- existing exact `costPerUnitMicros` remains the current cost reference.

Direct quantity updates are rejected after migration. New balances must be created through a stock movement.

### IngredientUnitConversion

A conversion defines how one submitted unit maps into an ingredient's base unit:

```text
toBaseMicros = base units represented by one submitted unit × 1,000,000
```

Conversions are ingredient-specific because names such as piece, bottle, tray, and case do not have universal sizes.

### Recipe and RecipeComponent

Recipes are versioned and append-preserving:

- exactly one active recipe per menu item;
- previous recipe versions are superseded rather than overwritten;
- recipe yield is stored in serving micros;
- component quantities are stored in ingredient base-unit micros;
- a component may be unconditional or tied to one modifier option;
- modifier-specific components are applied only when that option appears in the order-item snapshot;
- the database rejects a modifier option belonging to another menu item.

### StockMovement

Every movement records:

- unique idempotency key;
- ingredient;
- movement type;
- signed exact quantity delta;
- exact unit-cost snapshot;
- exact total-cost snapshot;
- resulting exact balance;
- source type, source ID, and source-line ID;
- optional reversal parent;
- actor, reason, metadata, occurrence time, and creation time.

Movement rows cannot be updated or deleted. Corrections are new reversal movements.

### Order-item consumption snapshot

Every order item now makes a permanent, one-way inventory decision when it first enters production:

- `pending` means inventory has not yet been evaluated;
- `consumed` stores the exact recipe ID and version used, plus the consumption timestamp;
- `untracked` records that no recipe existed at production time.

Once the item is consumed or marked untracked, that snapshot cannot be edited. Publishing a new recipe later therefore cannot consume the same item again or retroactively deduct a previously untracked item.

## Movement types

| Type | Direction | Typical source |
| --- | --- | --- |
| `opening_balance` | positive | migrated or newly created ingredient |
| `receipt` | positive | purchase receipt or manual receipt |
| `waste` | negative | approved waste log |
| `adjustment_in` | positive | counted surplus/correction |
| `adjustment_out` | negative | counted shortage/correction |
| `production_consumption` | negative | order item entering production |
| `reversal` | opposite of parent | reviewed correction of one movement |

## Database guarantees

1. Movement idempotency keys are unique.
2. Movement rows are immutable.
3. Ingredient rows are locked while applying a movement.
4. Concurrent movements serialize on the ingredient balance.
5. Negative resulting stock is rejected unless the ingredient explicitly permits it.
6. Direction must match the movement type.
7. A reversal must exactly negate one existing non-reversal movement.
8. Only one reversal may reference a movement.
9. Balance and cost snapshots are calculated by PostgreSQL, not trusted from the browser.
10. Direct ingredient quantity updates are rejected outside the ledger trigger.
11. One active recipe is permitted per menu item.
12. Recipe versions and components are immutable after creation.
13. Recipe modifier components must belong to the same menu item.
14. Each order item moves one way from pending inventory evaluation to either consumed or untracked.
15. Consumed recipe ID/version snapshots cannot be edited after production begins.
16. Legacy items already in or beyond production are migrated as untracked rather than retroactively consuming current stock.

## Production-consumption policy

Inventory is consumed when an order item first enters production:

- `pending → preparing` consumes the active recipe;
- a direct KDS jump from `pending → ready` also consumes the active recipe;
- order completion consumes any still-unconsumed active items before marking them served;
- the first production transition stores an immutable recipe ID/version snapshot on the order item;
- deterministic movement keys make retries and repeated status calls safe;
- publishing a newer recipe cannot consume the same order item again;
- an item without an active recipe is permanently marked untracked for that production lifecycle, so publishing a recipe later cannot retroactively deduct it;
- insufficient configured stock blocks the status transition and leaves the order/item unchanged.

Cancelling after production does not silently return ingredients. The ingredients may already have been prepared or discarded, so a manager or inventory manager must create a reviewed reversal when physical stock was actually recovered.

Payment refunds and voids do not automatically return inventory.

## APIs

### `GET/POST /api/inventory/conversions`

List or upsert ingredient-specific unit conversions.

### `GET/POST /api/inventory/recipes`

List active/versioned recipes or publish a new immutable recipe version. Publishing requires an idempotency key.

### `GET/POST /api/inventory/movements`

List redacted stock history or create receipts, waste, adjustments, and reviewed reversals. Mutations require an idempotency key.

### Existing `/api/inventory`

- ingredient creation produces an opening-balance movement;
- waste uses the stock ledger;
- ordinary metadata and cost edits remain supported;
- direct quantity replacement is disabled;
- deletion is blocked once an ingredient has ledger or recipe history.

## Operator workflow

The bilingual inventory administration interface now includes:

- exact current balances and low-stock state;
- opening balance through ingredient creation;
- receipts, waste, positive adjustments, and negative adjustments;
- movement history with quantity, balance, and cost snapshots;
- reviewed movement reversal;
- ingredient-specific unit conversions;
- active recipe visibility;
- immutable recipe-version publishing with modifier-specific components;
- visibility into menu items that remain without an active recipe.

## Cost policy

Each movement snapshots the ingredient's exact unit cost. Total cost is calculated in PostgreSQL with deterministic rounding.

This slice provides movement-level and order-item-level cost of goods. Weighted-average receiving and advanced valuation methods remain a separate decision; a receipt may update the current ingredient cost through the reviewed ingredient-cost workflow, while historical movement snapshots remain unchanged.

## Validated checkpoint

**Head:** `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d`

**P1 Stacked Validation #32** passed all three jobs:

- **Typecheck, tests, lint, and build:** locked installation, Prisma schema validation/generation, strict TypeScript, all security and stock source inventories, ESLint, and production build.
- **Database-backed restaurant suite:** clean PostgreSQL migration deployment, seeding, exact-money verification, every P0 and earlier P1 regression, and the full stock-ledger/recipe lifecycle.
- **Existing-data adoption rehearsal:** legacy-schema reconstruction, baseline adoption, additive migration deployment, opening-balance backfill, credential migration, record preservation, enum/timestamp verification, and exact-money verification.

The stock suite covers authorization, migration opening balances, exact quantities, conversions, immutable recipe versions, modifier ownership, direct and order-level production consumption, recipe-change replay safety, permanent no-recipe decisions, insufficient-stock rollback, receipts, waste, adjustments, movement replay, reviewed reversal, concurrent stock writes, explicit negative-stock policy, cost snapshots, balance reconciliation, database immutability, and audit events.

## Explicitly deferred

- purchase-order lines and partial receiving UI;
- weighted-average, FIFO, or lot valuation selection;
- lots, batches, expiry dates, and serial tracking;
- multi-location bins and transfers;
- vendor returns;
- automatic inventory return on refund;
- offline stock synchronization;
- denomination-specific or packaging-label UX;
- destructive removal of the legacy `Ingredient.quantity` field.
