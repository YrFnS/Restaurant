from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected roadmap marker was not found in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


roadmap = Path("docs/REMEDIATION_PLAN.md")
reservation = Path("docs/P1_RESERVATION_AVAILABILITY.md")

replace_once(
    roadmap,
    "> **Tracking branch:** `agent/p1-employee-timekeeping`  ",
    "> **Tracking branch:** `agent/p1-reservation-availability`  ",
)
replace_once(
    roadmap,
    "> **Current milestone:** P1 restaurant workflow correctness — reservation availability, waitlist, and loyalty  ",
    "> **Current milestone:** P1 restaurant workflow correctness — waitlist, loyalty, and remaining operational workflows  ",
)
replace_once(
    roadmap,
    "- [`P1_EMPLOYEE_TIMEKEEPING.md`](./P1_EMPLOYEE_TIMEKEEPING.md)\n",
    "- [`P1_EMPLOYEE_TIMEKEEPING.md`](./P1_EMPLOYEE_TIMEKEEPING.md)\n"
    "- [`P1_RESERVATION_AVAILABILITY.md`](./P1_RESERVATION_AVAILABILITY.md)\n",
)
replace_once(
    roadmap,
    "| P1-B04 | Suppliers, purchase orders, and partial receiving | Completed and validated |\n"
    "| P1-C | KDS, analytics, jobs, backup/recovery | KDS outbox complete; remaining work open |",
    "| P1-B04 | Suppliers, purchase orders, and partial receiving | Completed and validated |\n"
    "| P1-B06 | Restaurant-local reservation availability and safe table allocation | Completed and validated |\n"
    "| P1-C | KDS, analytics, jobs, backup/recovery | KDS outbox complete; remaining work open |",
)

old_stack = """# Validated branch stack

The work is intentionally stacked and must be reviewed or merged in order:

```text
main
└── agent/p0-hardening
    └── agent/p1-data-integrity
        └── agent/p1-cash-register-sessions
            └── agent/p1-payment-reversals
                └── agent/p1-stock-ledger-recipes
                    └── agent/p1-purchase-orders-receiving
                        └── agent/p1-employee-timekeeping
```

Validated completed checkpoints:

| Slice | Validated head | Evidence |
| --- | --- | --- |
| P0 security and financial integrity | `5c8c2d93fe95f76aaeff7c433b175d8357ebd978` | P0 Validation #393, P0 Integration #228, Vercel check |
| P1 exact money and domain integrity | `55ac63f8ffbc94b0f4daec3936dab78c55bc7685` | Validation #511, Integration #341 |
| P1 cash-register sessions | `c44030bcb222fa78f8c50152dbab81187877e59d` | Validation #558, Integration #388 |
| P1 payment reversals | `87d787b1b39b6ed93caf5493b7fec2911a2c211c` | P1 Stacked Validation #6 |
| P1 recipes and immutable stock ledger | `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d` | P1 Stacked Validation #32 |
| P1 suppliers, purchase orders, and partial receiving | `0e0eab253ed43a42e2d0beb88da97ba8e9a3b633` | P1 Stacked Validation #53 |
| P1 immutable employee timekeeping | `054b096a600782897ef1b6eaf6591326b50fbe58` | P1 Stacked Validation #83 |
"""
new_stack = """# Consolidated branch history and current slice

PRs #1–#7 were merged into `main` in dependency order with ancestry-preserving merge commits. New work now branches directly from the consolidated foundation:

```text
main (P0 and completed P1 foundations)
└── agent/p1-reservation-availability
```

Validated completed checkpoints:

| Slice | Validated head | Evidence |
| --- | --- | --- |
| P0 security and financial integrity | `5c8c2d93fe95f76aaeff7c433b175d8357ebd978` | P0 Validation #393, P0 Integration #228, Vercel check |
| P1 exact money and domain integrity | `55ac63f8ffbc94b0f4daec3936dab78c55bc7685` | Validation #511, Integration #341 |
| P1 cash-register sessions | `c44030bcb222fa78f8c50152dbab81187877e59d` | Validation #558, Integration #388 |
| P1 payment reversals | `87d787b1b39b6ed93caf5493b7fec2911a2c211c` | P1 Stacked Validation #6 |
| P1 recipes and immutable stock ledger | `8e66dfd9e12c9f2eb95798c9bd10ada9332c533d` | P1 Stacked Validation #32 |
| P1 suppliers, purchase orders, and partial receiving | `0e0eab253ed43a42e2d0beb88da97ba8e9a3b633` | P1 Stacked Validation #53 |
| P1 immutable employee timekeeping | `054b096a600782897ef1b6eaf6591326b50fbe58` | P1 Stacked Validation #83 |
| Consolidated P0/P1 foundation | `578e9bea13b4958e6b6f7ceac53719ce55f49013` | PRs #1–#7 merged into `main` in order |
| P1 reservation availability and allocation | `45aff45f63bf18113338f7426fda92100760973f` | P0 Validation #793 and P0 Integration #623 |
"""
replace_once(roadmap, old_stack, new_stack)

old_reservation_scope = """## P1-B06 Reservation availability

- [ ] Add restaurant timezone, weekday hours, holidays, and closures.
- [ ] Enforce duration, overlap, capacity, and table compatibility.
- [ ] Support unassigned capacity planning and table allocation.
- [ ] Complete cancellation, no-show, seated, completed, and notification behavior.
"""
new_reservation_scope = """## P1-B06 Reservation availability

Completed and validated scope:

- [x] Add restaurant-local timezone conversion and independent weekly reservation service periods.
- [x] Support multiple periods per weekday, prior-day overnight continuation, and full/partial closures.
- [x] Enforce notice, horizon, party-size, duration, turnover, slot-interval, closure, capacity, and compatibility policy.
- [x] Return rate-limited, aggregate-only public availability without exposing tables, customers, or other bookings.
- [x] Snapshot exact reservation start, dining end, release time, duration, turnover, and source.
- [x] Add transactional automatic allocation and staff reassignment with PostgreSQL exclusion protection against active table overlap.
- [x] Add ownership-token customer cancellation with a configurable cutoff.
- [x] Complete audited confirmed, seated, completed, cancelled, and no-show lifecycle behavior with table-state effects.
- [x] Add bilingual public availability, staff calendar, reservation-policy, weekly-period, and closure workflows.
- [x] Add clean-database migration, representative existing-data adoption, privacy/source inventories, and complete P0/P1 regression coverage.

Policy decisions for this slice:

- Customer input is a restaurant-local date and time; the server performs authoritative timezone conversion.
- Occupancy uses the half-open range `[startsAt, releaseAt)` and snapshots duration plus turnover at booking time.
- Active `confirmed` and `seated` reservations block their assigned table.
- PostgreSQL is the final concurrency boundary for table overlap.
- Public availability exposes aggregate capacity only.
- One physical table is assigned per reservation; table combinations require an explicit adjacency model and remain deferred.

Explicitly deferred:

- [ ] Physical table combinations and adjacency rules.
- [ ] Customer rescheduling and self-service detail editing.
- [ ] Deposits, card authorization, cancellation fees, and overbooking policy.
- [ ] Email, SMS, messaging-provider delivery, and notification retries.
- [ ] Waitlist estimates and automatic waitlist-to-reservation promotion.
"""
replace_once(roadmap, old_reservation_scope, new_reservation_scope)

replace_once(
    roadmap,
    "- [x] Restaurant timezone and operational-day boundary govern overnight timekeeping and business-date assignment.\n"
    "- [ ] Revenue recognition policy.",
    "- [x] Restaurant timezone and operational-day boundary govern overnight timekeeping and business-date assignment.\n"
    "- [x] Reservation availability uses restaurant-local date/time, snapshotted duration/turnover, and PostgreSQL exclusion constraints for active table occupancy.\n"
    "- [x] Public reservation availability is aggregate-only; customer cancellation is ownership-token scoped and cutoff-controlled.\n"
    "- [ ] Revenue recognition policy.",
)
replace_once(
    roadmap,
    "| 2026-08-01 | Added immutable employee shifts, breaks, event history, exact labor snapshots, append-only manager adjustments, operational-day policy, kiosk/manager workflows, and full regression coverage. | P1 Stacked Validation #83 green at `054b096`. |\n",
    "| 2026-08-01 | Added immutable employee shifts, breaks, event history, exact labor snapshots, append-only manager adjustments, operational-day policy, kiosk/manager workflows, and full regression coverage. | P1 Stacked Validation #83 green at `054b096`. |\n"
    "| 2026-08-01 | Consolidated PRs #1–#7 into `main`, then added restaurant-local reservation policy, weekly/overnight service periods, closures, safe public availability, transactional table allocation, lifecycle controls, bilingual workflows, and full regression coverage. | P0 Validation #793 and P0 Integration #623 green at `45aff45`. |\n",
)

replace_once(
    reservation,
    "> **Base:** consolidated `main` after PRs #1–#7  \n> **Scope:**",
    "> **Base:** consolidated `main` after PRs #1–#7  \n"
    "> **Status:** Completed and validated at implementation checkpoint `45aff45f63bf18113338f7426fda92100760973f`  \n"
    "> **Validation:** P0 Validation #793 and P0 Integration #623 passed  \n"
    "> **Scope:**",
)
replace_once(
    reservation,
    "The current reservation endpoint assigns the smallest table that appears free inside a fixed plus-or-minus 90-minute window. It evaluates opening hours in the application server timezone, has no holiday or closure model, does not store a reservation end or turnover buffer, and can double-book a table when concurrent requests race.",
    "The previous reservation endpoint assigned the smallest table that appeared free inside a fixed plus-or-minus 90-minute window. It evaluated opening hours in the application server timezone, had no closure model, did not store a reservation end or turnover buffer, and could double-book a table when concurrent requests raced.",
)
replace_once(
    reservation,
    "The customer reservation screen will:",
    "The customer reservation screen now:",
)
replace_once(
    reservation,
    "The staff workflow will:",
    "The staff workflow now:",
)
replace_once(
    reservation,
    "This slice is complete only when all of the following pass:",
    "This slice passed all of the following gates at implementation checkpoint `45aff45f63bf18113338f7426fda92100760973f`:",
)

print("Reservation roadmap and validation record reconciled.")
