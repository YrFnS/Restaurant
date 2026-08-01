-- Reconcile the legacy non-negative quantity constraint with the reviewed
-- per-ingredient negative-stock policy introduced by the stock ledger.

ALTER TABLE "Ingredient"
  DROP CONSTRAINT "Ingredient_stock_bounds";

ALTER TABLE "Ingredient"
  ADD CONSTRAINT "Ingredient_stock_bounds" CHECK (
    ("allowNegativeStock" OR "quantity" >= 0) AND
    "quantity" BETWEEN -1000000000000000 AND 1000000000000000 AND
    "lowThreshold" BETWEEN 0 AND 1000000000000000
  ) NOT VALID;

ALTER TABLE "Ingredient"
  VALIDATE CONSTRAINT "Ingredient_stock_bounds";
