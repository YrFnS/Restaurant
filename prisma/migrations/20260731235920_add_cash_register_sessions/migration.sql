-- P1 cash-register sessions: register identity, serialized cash movements,
-- immutable closing records, and safe links from cash/payment ledgers.

CREATE TYPE "CashRegisterSessionStatus" AS ENUM ('open', 'closed');

CREATE TABLE "CashRegister" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "location" TEXT NOT NULL DEFAULT '',
  "discrepancyApprovalThresholdMinor" BIGINT NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashRegister_identity_bounds" CHECK (
    char_length(btrim("code")) BETWEEN 1 AND 80 AND
    char_length(btrim("name")) BETWEEN 1 AND 160 AND
    char_length(btrim("deviceId")) BETWEEN 1 AND 191
  ),
  CONSTRAINT "CashRegister_threshold_bounds" CHECK (
    "discrepancyApprovalThresholdMinor" BETWEEN 0 AND 9007199254740991
  )
);

CREATE UNIQUE INDEX "CashRegister_code_key" ON "CashRegister"("code");
CREATE UNIQUE INDEX "CashRegister_deviceId_key" ON "CashRegister"("deviceId");
CREATE INDEX "CashRegister_active_name_idx" ON "CashRegister"("isActive", "name");

CREATE TABLE "CashRegisterSession" (
  "id" TEXT NOT NULL,
  "registerId" TEXT NOT NULL,
  "openKey" TEXT NOT NULL,
  "status" "CashRegisterSessionStatus" NOT NULL DEFAULT 'open',
  "openingFloatMinor" BIGINT NOT NULL,
  "openedById" TEXT NOT NULL,
  "openedByName" TEXT NOT NULL DEFAULT '',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashRegisterSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashRegisterSession_registerId_fkey"
    FOREIGN KEY ("registerId") REFERENCES "CashRegister"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CashRegisterSession_opening_bounds" CHECK (
    "openingFloatMinor" BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT "CashRegisterSession_state_shape" CHECK (
    ("status" = 'open' AND "closedAt" IS NULL) OR
    ("status" = 'closed' AND "closedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "CashRegisterSession_register_openKey_key"
  ON "CashRegisterSession"("registerId", "openKey");
CREATE UNIQUE INDEX "CashRegisterSession_one_open_per_register_idx"
  ON "CashRegisterSession"("registerId")
  WHERE "status" = 'open';
CREATE INDEX "CashRegisterSession_register_openedAt_idx"
  ON "CashRegisterSession"("registerId", "openedAt" DESC);
CREATE INDEX "CashRegisterSession_openedBy_status_idx"
  ON "CashRegisterSession"("openedById", "status");

CREATE TABLE "CashRegisterClose" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "closeKey" TEXT NOT NULL,
  "expectedCashMinor" BIGINT NOT NULL,
  "countedCashMinor" BIGINT NOT NULL,
  "discrepancyMinor" BIGINT NOT NULL,
  "thresholdMinor" BIGINT NOT NULL,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvedById" TEXT,
  "approvedByName" TEXT,
  "approvalReason" TEXT,
  "closedById" TEXT NOT NULL,
  "closedByName" TEXT NOT NULL DEFAULT '',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashRegisterClose_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashRegisterClose_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "CashRegisterSession"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CashRegisterClose_financial_bounds" CHECK (
    "expectedCashMinor" BETWEEN 0 AND 9007199254740991 AND
    "countedCashMinor" BETWEEN 0 AND 9007199254740991 AND
    "thresholdMinor" BETWEEN 0 AND 9007199254740991 AND
    "discrepancyMinor" BETWEEN -9007199254740991 AND 9007199254740991 AND
    "discrepancyMinor" = "countedCashMinor" - "expectedCashMinor"
  ),
  CONSTRAINT "CashRegisterClose_approval_shape" CHECK (
    (
      NOT "approvalRequired" AND
      "approvedById" IS NULL AND
      "approvedByName" IS NULL AND
      "approvalReason" IS NULL
    ) OR
    (
      "approvalRequired" AND
      "approvedById" IS NOT NULL AND
      "approvedByName" IS NOT NULL AND
      char_length(btrim(COALESCE("approvalReason", ''))) BETWEEN 1 AND 1000
    )
  )
);

CREATE UNIQUE INDEX "CashRegisterClose_sessionId_key"
  ON "CashRegisterClose"("sessionId");
CREATE UNIQUE INDEX "CashRegisterClose_closeKey_key"
  ON "CashRegisterClose"("closeKey");
CREATE INDEX "CashRegisterClose_createdAt_idx"
  ON "CashRegisterClose"("createdAt" DESC);
CREATE INDEX "CashRegisterClose_approvedBy_createdAt_idx"
  ON "CashRegisterClose"("approvedById", "createdAt" DESC);

ALTER TABLE "CashDrawerEntry"
  ADD COLUMN "registerSessionId" TEXT;
ALTER TABLE "PaymentEvent"
  ADD COLUMN "registerSessionId" TEXT;

ALTER TABLE "CashDrawerEntry"
  ADD CONSTRAINT "CashDrawerEntry_registerSessionId_fkey"
  FOREIGN KEY ("registerSessionId") REFERENCES "CashRegisterSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_registerSessionId_fkey"
  FOREIGN KEY ("registerSessionId") REFERENCES "CashRegisterSession"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CashDrawerEntry_registerSession_createdAt_idx"
  ON "CashDrawerEntry"("registerSessionId", "createdAt" DESC);
CREATE INDEX "PaymentEvent_registerSession_createdAt_idx"
  ON "PaymentEvent"("registerSessionId", "createdAt" DESC);

CREATE FUNCTION "protect_cash_register_session"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'closed' THEN
      RAISE EXCEPTION 'Closed cash-register sessions are immutable'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'closed' THEN
    RAISE EXCEPTION 'Closed cash-register sessions are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."registerId" IS DISTINCT FROM OLD."registerId" OR
     NEW."openKey" IS DISTINCT FROM OLD."openKey" OR
     NEW."openingFloatMinor" IS DISTINCT FROM OLD."openingFloatMinor" OR
     NEW."openedById" IS DISTINCT FROM OLD."openedById" OR
     NEW."openedByName" IS DISTINCT FROM OLD."openedByName" OR
     NEW."openedAt" IS DISTINCT FROM OLD."openedAt" OR
     NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Cash-register session opening data is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW."status" = 'open' AND NEW."closedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Open cash-register sessions cannot have a closing time'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'closed' AND NEW."closedAt" IS NULL THEN
    RAISE EXCEPTION 'Closed cash-register sessions require a closing time'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "CashRegisterSession_protect_closed"
BEFORE UPDATE OR DELETE ON "CashRegisterSession"
FOR EACH ROW EXECUTE FUNCTION "protect_cash_register_session"();

CREATE FUNCTION "protect_cash_register_close"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Cash-register closing records are immutable'
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER "CashRegisterClose_immutable"
BEFORE UPDATE OR DELETE ON "CashRegisterClose"
FOR EACH ROW EXECUTE FUNCTION "protect_cash_register_close"();

CREATE FUNCTION "validate_cash_register_close_insert"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_status "CashRegisterSessionStatus";
  session_closed_at TIMESTAMP(3);
BEGIN
  SELECT "status", "closedAt"
    INTO session_status, session_closed_at
  FROM "CashRegisterSession"
  WHERE "id" = NEW."sessionId";

  IF session_status IS DISTINCT FROM 'closed' OR session_closed_at IS NULL THEN
    RAISE EXCEPTION 'A closing record requires an already-closed register session'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "CashRegisterClose_validate_session"
BEFORE INSERT ON "CashRegisterClose"
FOR EACH ROW EXECUTE FUNCTION "validate_cash_register_close_insert"();

CREATE FUNCTION "enforce_open_register_session_link"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  session_status "CashRegisterSessionStatus";
BEGIN
  IF NEW."registerSessionId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND
     OLD."registerSessionId" IS NOT NULL AND
     OLD."registerSessionId" IS DISTINCT FROM NEW."registerSessionId" THEN
    RAISE EXCEPTION 'Cash ledger session links are immutable once assigned'
      USING ERRCODE = '55000';
  END IF;

  SELECT "status"
    INTO session_status
  FROM "CashRegisterSession"
  WHERE "id" = NEW."registerSessionId";

  IF session_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Cash ledger records can only be linked to an open register session'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "CashDrawerEntry_open_session_link"
BEFORE INSERT OR UPDATE OF "registerSessionId" ON "CashDrawerEntry"
FOR EACH ROW EXECUTE FUNCTION "enforce_open_register_session_link"();

CREATE TRIGGER "PaymentEvent_open_session_link"
BEFORE INSERT OR UPDATE OF "registerSessionId" ON "PaymentEvent"
FOR EACH ROW EXECUTE FUNCTION "enforce_open_register_session_link"();
