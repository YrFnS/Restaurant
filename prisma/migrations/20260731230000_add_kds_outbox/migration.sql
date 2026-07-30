CREATE TABLE "KdsOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "screenSlugs" JSONB NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KdsOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KdsOutboxEvent_deliveredAt_nextAttemptAt_idx"
ON "KdsOutboxEvent"("deliveredAt", "nextAttemptAt");

CREATE INDEX "KdsOutboxEvent_lockedAt_idx"
ON "KdsOutboxEvent"("lockedAt");

CREATE INDEX "KdsOutboxEvent_createdAt_idx"
ON "KdsOutboxEvent"("createdAt");
