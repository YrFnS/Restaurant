from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
changed: list[str] = []


def keep_single(path: str, fragment: str) -> None:
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    count = text.count(fragment)
    if count <= 1:
        return
    parts = text.split(fragment)
    updated = parts[0] + fragment + "".join(parts[1:])
    file_path.write_text(updated, encoding="utf-8")
    changed.append(path)


idempotency_helpers = {
    "src/app/menu/qr/[tableNumber]/page.tsx": """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `qr-order-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

""",
    "src/components/layout/CartSheet.tsx": """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `sheet-order-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

""",
    "src/components/pos/PaymentDialog.tsx": """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `pos-payment-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

""",
    "src/components/pos/PosTerminal.tsx": """function createIdempotencyKey(): string {
  if (typeof crypto !== \"undefined\" && typeof crypto.randomUUID === \"function\") {
    return crypto.randomUUID();
  }
  return `pos-kitchen-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

""",
}

for source_path, helper in idempotency_helpers.items():
    keep_single(source_path, helper)
    keep_single(source_path, "  const idempotencyKeyRef = useRef<string | null>(null);\n")
    keep_single(source_path, "  const kitchenIdempotencyKeyRef = useRef<string | null>(null);\n")

keep_single("tsconfig.json", '    "types": ["bun-types"],\n')

print("Removed duplicated generated blocks from:")
for path in sorted(set(changed)):
    print(f"- {path}")
