from pathlib import Path

SOURCE_WORKFLOW = Path(".github/workflows/apply-loyalty-schema-wiring.yml")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one exact block, found {count}")
    return text.replace(old, new, 1)


def main() -> None:
    source = SOURCE_WORKFLOW.read_text()

    source = replace_once(
        source,
        """          schema = replace_once(
              schema,
              '''  reversals         PaymentEvent[]       @relation(\"PaymentEventReversals\")
  reasonCode       String               @default(\"\")''',
              '''  reversals         PaymentEvent[]       @relation(\"PaymentEventReversals\")
  loyaltyEvents    LoyaltyPointEvent[]
  giftCardTransactions GiftCardTransaction[]
  reasonCode       String               @default(\"\")''',
              'payment event relations',
          )""",
        """          schema = replace_once(
              schema,
              '''  reversals         PaymentEvent[]       @relation(\"PaymentEventReversals\")''',
              '''  reversals         PaymentEvent[]       @relation(\"PaymentEventReversals\")
  loyaltyEvents    LoyaltyPointEvent[]
  giftCardTransactions GiftCardTransaction[]''',
              'payment event relations',
          )""",
        "payment relation wrapper",
    )

    source = replace_once(
        source,
        """          settings = replace_once(
              settings,
              '''          operationalDayStartMinutes: saved.operationalDayStartMinutes,
          kdsThresholds:''',
              '''          operationalDayStartMinutes: saved.operationalDayStartMinutes,
          loyaltyPolicy: {
            enabled: saved.loyaltyEnabled,
            pointsPerCurrencyUnit: saved.loyaltyPointsPerCurrencyUnit,
            redemptionPointsPerCurrencyUnit: saved.loyaltyRedemptionPointsPerCurrencyUnit,
            redemptionIncrementPoints: saved.loyaltyRedemptionIncrementPoints,
            maxRedemptionPercent: saved.loyaltyMaxRedemptionPercent,
          },
          giftCardPolicy: {
            enabled: saved.giftCardEnabled,
            defaultExpiryDays: saved.giftCardDefaultExpiryDays,
          },
          kdsThresholds:''',
              'settings audit',
          )""",
        """          settings = replace_once(
              settings,
              '''          kdsThresholds:''',
              '''          loyaltyPolicy: {
            enabled: saved.loyaltyEnabled,
            pointsPerCurrencyUnit: saved.loyaltyPointsPerCurrencyUnit,
            redemptionPointsPerCurrencyUnit: saved.loyaltyRedemptionPointsPerCurrencyUnit,
            redemptionIncrementPoints: saved.loyaltyRedemptionIncrementPoints,
            maxRedemptionPercent: saved.loyaltyMaxRedemptionPercent,
          },
          giftCardPolicy: {
            enabled: saved.giftCardEnabled,
            defaultExpiryDays: saved.giftCardDefaultExpiryDays,
          },
          kdsThresholds:''',
              'settings audit',
          )""",
        "settings audit wrapper",
    )

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
