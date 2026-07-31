# P1 Purchase Orders and Partial Receiving

> **Repository:** `YrFnS/Restaurant`  
> **Branch:** `agent/p1-purchase-orders-receiving`  
> **Stacked base:** `agent/p1-stock-ledger-recipes`  
> **Scope:** suppliers, exact purchase-order lines, submission, partial receiving, immutable receipt history, and reviewed receipt correction

## Purpose

The legacy purchase-order record is only a supplier name, free-text status, notes, and one mutable total. It has no lines, no exact quantity snapshots, no relationship to ingredients, and no safe way to receive a delivery into the stock ledger.

This slice makes purchasing a controlled inventory workflow. Draft commercial terms remain editable, submitted orders become immutable, every receipt is idempotent and append-preserving, and each received line creates an exact stock-ledger movement in the same transaction.

## Supplier records

Suppliers are first-class records with:

- stable uppercase code;
- name and contact details;
- address, payment terms, and notes;
- active/inactive status;
- immutable supplier code/name snapshots on every purchase order.

Changing a supplier later does not rewrite historical purchase orders.

## Exact line snapshots

Each purchase-order line preserves:

- ingredient ID and ingredient-name snapshot;
- ingredient base unit;
- purchasing unit;
- conversion factor used when the order was created;
- ordered quantity in purchase-unit micros;
- ordered quantity in base-unit micros;
- received quantity in base-unit micros;
- purchase-unit cost in currency micros;
- derived base-unit cost in currency micros;
- exact line total in currency minor units.

The saved conversion and cost snapshots remain authoritative even if the ingredient conversion or current cost changes later.

## Workflow

```text
draft → submitted → partially_received → received
  └──────────────→ cancelled
```

- Draft orders may be edited or cancelled.
- Submission requires at least one line and freezes commercial terms.
- Submitted orders may receive one or more partial deliveries.
- The order becomes `received` only when every line is fully received.
- A submitted order may be cancelled only before any posted receipt exists.
- Partially received and received orders cannot be cancelled.
- Legacy imported headers remain visible and read-only even when they predate line-level history.

## Receiving

A receipt:

1. locks the purchase order and selected lines;
2. validates that each quantity is positive and does not exceed the remaining order quantity;
3. converts the submitted purchasing quantity using the line's saved conversion snapshot;
4. creates one immutable `receipt` stock movement per line;
5. stores the movement ID on the immutable receipt line;
6. advances received quantities and recalculates the purchase-order status;
7. commits the receipt, stock movements, ingredient balances, status, and audit event atomically.

Receipt idempotency keys make retries safe. Concurrent attempts to receive the same remaining quantity serialize through purchase-order and line locks.

## Receipt corrections

Generic stock reversal is deliberately rejected for purchase-receipt movements. A manager or inventory manager must use the purchasing correction workflow so the system can atomically:

- append exact reversal stock movements;
- link each reversal to its receipt line;
- mark the receipt reversed;
- reduce received quantities;
- recalculate the purchase-order status;
- preserve the original receipt and reason.

A correction fails if returning the received quantity would make physical stock invalid under the ingredient's negative-stock policy. Vendor returns remain a later workflow.

## Cost policy

This slice snapshots the purchase price and writes the derived base-unit cost onto each receipt movement. Historical receipt and stock-movement costs never change.

It does **not** choose weighted-average, FIFO, or lot valuation, and it does not automatically replace the ingredient's current production-cost reference. Formal valuation remains a separate reviewed decision.

## APIs

### `/api/suppliers`

- list active and inactive suppliers;
- create suppliers;
- update contact details or activate/deactivate a supplier.

### `/api/purchase-orders`

- list purchase orders and exact line progress;
- create idempotent draft purchase orders.

### `/api/purchase-orders/:id`

- load one order with lines and receipts;
- replace draft commercial terms and lines;
- submit or cancel through controlled transitions.

### `/api/purchase-orders/:id/receipts`

- list receipts for the order;
- post an idempotent partial/full receipt;
- reverse one posted receipt through the reviewed correction workflow.

## Validation gate

The slice is complete only when all of the following pass:

- clean migration deployment;
- representative legacy purchase-order adoption;
- strict Prisma validation and generation;
- source inventory, TypeScript, ESLint, and production build;
- supplier and role authorization;
- exact conversion, cost, and total snapshots;
- create/update/submit/cancel workflow;
- partial and full receiving;
- idempotent receipt replay;
- concurrent over-receipt prevention;
- atomic stock-movement and status rollback;
- receipt correction and correction replay;
- generic reversal rejection for purchase receipts;
- header, line, receipt, and receipt-line immutability;
- audit-event coverage;
- complete P0 and earlier P1 regression chain.

## Explicitly deferred

- supplier invoices, accounts payable, taxes, and payment scheduling;
- approval thresholds and multi-step procurement authorization;
- vendor returns and debit notes;
- lots, batches, expiry dates, and serial numbers;
- multi-location receiving and transfers;
- weighted-average, FIFO, or another formal valuation method;
- purchase suggestions and automatic reorder generation;
- file attachments and scanned supplier documents;
- email or EDI transmission to suppliers.
