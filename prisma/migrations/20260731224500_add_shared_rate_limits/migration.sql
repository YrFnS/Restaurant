CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitCounter_scope_expiresAt_idx"
ON "RateLimitCounter"("scope", "expiresAt");

CREATE INDEX "RateLimitCounter_expiresAt_idx"
ON "RateLimitCounter"("expiresAt");
