ALTER TABLE "AuditEvent"
ADD COLUMN "sessionId" TEXT;

CREATE INDEX "AuditEvent_sessionId_createdAt_idx"
ON "AuditEvent"("sessionId", "createdAt");

CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffSession_tokenHash_key"
ON "StaffSession"("tokenHash");

CREATE INDEX "StaffSession_employeeId_revokedAt_expiresAt_idx"
ON "StaffSession"("employeeId", "revokedAt", "expiresAt");

CREATE INDEX "StaffSession_expiresAt_idx"
ON "StaffSession"("expiresAt");

CREATE INDEX "StaffSession_revokedAt_idx"
ON "StaffSession"("revokedAt");
