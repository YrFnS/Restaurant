from pathlib import Path

SOURCE_WORKFLOW = Path(".github/workflows/apply-loyalty-schema-wiring.yml")


def main() -> None:
    source = SOURCE_WORKFLOW.read_text()
    old = '''          schema = replace_once(
              schema,
              \'\'\'  reversals         PaymentEvent[]       @relation("PaymentEventReversals")
  reasonCode       String               @default("")\'\'\',
              \'\'\'  reversals         PaymentEvent[]       @relation("PaymentEventReversals")
  loyaltyEvents    LoyaltyPointEvent[]
  giftCardTransactions GiftCardTransaction[]
  reasonCode       String               @default("")\'\'\',
              'payment event relations',
          )'''
    new = '''          schema = replace_once(
              schema,
              \'\'\'  reversals         PaymentEvent[]       @relation("PaymentEventReversals")\'\'\',
              \'\'\'  reversals         PaymentEvent[]       @relation("PaymentEventReversals")
  loyaltyEvents    LoyaltyPointEvent[]
  giftCardTransactions GiftCardTransaction[]\'\'\',
              'payment event relations',
          )'''
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"Expected one exact payment relation block, found {count}"
        )
    source = source.replace(old, new, 1)

    lines = source.splitlines()
    start = next(
        index for index, line in enumerate(lines) if "python3 - <<'PY'" in line
    ) + 1
    end = next(
        index for index in range(start, len(lines)) if lines[index].strip() == "PY"
    )
    script = "\n".join(
        line[10:] if line.startswith("          ") else line
        for line in lines[start:end]
    ) + "\n"
    exec(compile(script, str(SOURCE_WORKFLOW), "exec"), {"__name__": "__main__"})


if __name__ == "__main__":
    main()
