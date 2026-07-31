import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { exactMinorToNumber } from "@/lib/money/exact-store";
import {
  CURRENCY_MINOR_DIGITS,
  parseNonNegativeDecimalToScaledInteger,
} from "@/lib/money/scaled-integer";

export const REGISTER_ID_HEADER = "x-register-id";
export const REGISTER_DEVICE_HEADER = "x-register-device-id";
export const REGISTER_APPROVAL_ROLES = ["owner", "admin", "manager"] as const;

const LEGACY_REGISTER_ID = "register_legacy_web_pos";
const LEGACY_REGISTER_CODE = "LEGACY-WEB-POS";
const LEGACY_DEVICE_ID = "legacy-web-pos";
const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export type CashSqlClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "$executeRaw"
>;

export type CashActor = {
  id: string;
  name: string;
  role: string;
};

export type RegisterIdentity = {
  registerId: string | null;
  deviceId: string | null;
};

export type CashRegisterRow = {
  id: string;
  code: string;
  name: string;
  deviceId: string;
  location: string;
  discrepancyApprovalThresholdMinor: bigint;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CashRegisterSessionRow = {
  id: string;
  registerId: string;
  openKey: string;
  status: "open" | "closed";
  openingFloatMinor: bigint;
  openedById: string;
  openedByName: string;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CashRegisterCloseRow = {
  id: string;
  sessionId: string;
  closeKey: string;
  expectedCashMinor: bigint;
  countedCashMinor: bigint;
  discrepancyMinor: bigint;
  thresholdMinor: bigint;
  approvalRequired: boolean;
  approvedById: string | null;
  approvedByName: string | null;
  approvalReason: string | null;
  closedById: string;
  closedByName: string;
  note: string | null;
  createdAt: Date;
};

export type RegisterSessionContext = {
  register: CashRegisterRow;
  session: CashRegisterSessionRow;
  autoOpened: boolean;
};

export type SessionCashEntryRow = {
  id: string;
  type: string;
  amount: number;
  amountMinor: bigint;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  registerSessionId: string;
};

export class CashRegisterError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status = 409, details?: unknown) {
    super(message);
    this.name = "CashRegisterError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function cleanHeader(value: string | null): string | null {
  const normalized = value?.trim() || "";
  return normalized ? normalized.slice(0, 191) : null;
}

export function registerIdentityFromRequest(req: Request): RegisterIdentity {
  return {
    registerId: cleanHeader(req.headers.get(REGISTER_ID_HEADER)),
    deviceId: cleanHeader(req.headers.get(REGISTER_DEVICE_HEADER)),
  };
}

export function registerDeviceIdFromRequest(req: Request): string {
  const deviceId = cleanHeader(req.headers.get(REGISTER_DEVICE_HEADER));
  if (!deviceId) {
    throw new CashRegisterError(
      "Register device identity is required",
      "REGISTER_DEVICE_REQUIRED",
      400
    );
  }
  return deviceId;
}

export function idempotencyKeyFromRequest(req: Request): string {
  const key = cleanHeader(req.headers.get("idempotency-key"));
  if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key)) {
    throw new CashRegisterError(
      "A valid Idempotency-Key header is required",
      "IDEMPOTENCY_KEY_REQUIRED",
      400
    );
  }
  return key;
}

export function parseCurrencyInputToMinor(value: number): bigint {
  try {
    return parseNonNegativeDecimalToScaledInteger(
      String(value),
      CURRENCY_MINOR_DIGITS,
      MAX_SAFE_MINOR
    );
  } catch {
    throw new CashRegisterError(
      "Cash amount is outside the supported range",
      "INVALID_CASH_AMOUNT",
      400
    );
  }
}

export function signedMinorToNumber(value: bigint): number {
  if (value < -MAX_SAFE_MINOR || value > MAX_SAFE_MINOR) {
    throw new CashRegisterError(
      "Stored cash value cannot be represented safely",
      "UNSAFE_CASH_VALUE",
      500
    );
  }
  return Number(value) / 100;
}

export function serializeRegister(register: CashRegisterRow) {
  return {
    id: register.id,
    code: register.code,
    name: register.name,
    deviceId: register.deviceId,
    location: register.location,
    discrepancyApprovalThreshold: exactMinorToNumber(
      register.discrepancyApprovalThresholdMinor
    ),
    isActive: register.isActive,
    createdAt: register.createdAt,
    updatedAt: register.updatedAt,
  };
}

export function serializeSession(session: CashRegisterSessionRow) {
  return {
    id: session.id,
    registerId: session.registerId,
    status: session.status,
    openingFloat: exactMinorToNumber(session.openingFloatMinor),
    openedById: session.openedById,
    openedByName: session.openedByName,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function serializeClose(close: CashRegisterCloseRow) {
  return {
    id: close.id,
    sessionId: close.sessionId,
    expectedCash: exactMinorToNumber(close.expectedCashMinor),
    countedCash: exactMinorToNumber(close.countedCashMinor),
    discrepancy: signedMinorToNumber(close.discrepancyMinor),
    discrepancyApprovalThreshold: exactMinorToNumber(close.thresholdMinor),
    approvalRequired: close.approvalRequired,
    approvedById: close.approvedById,
    approvedByName: close.approvedByName,
    approvalReason: close.approvalReason,
    closedById: close.closedById,
    closedByName: close.closedByName,
    note: close.note,
    createdAt: close.createdAt,
  };
}

export function newRegisterId(): string {
  return `register_${randomUUID().replaceAll("-", "")}`;
}

export function newRegisterSessionId(): string {
  return `register_session_${randomUUID().replaceAll("-", "")}`;
}

export function newRegisterCloseId(): string {
  return `register_close_${randomUUID().replaceAll("-", "")}`;
}

export async function lockRegister(
  client: CashSqlClient,
  registerId: string,
  deviceId: string
): Promise<CashRegisterRow> {
  const rows = await client.$queryRaw<CashRegisterRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "deviceId", "location",
      "discrepancyApprovalThresholdMinor", "isActive",
      "createdAt", "updatedAt"
    FROM "CashRegister"
    WHERE "id" = ${registerId}
    FOR UPDATE
  `);
  const register = rows[0];
  if (!register) {
    throw new CashRegisterError("Cash register not found", "REGISTER_NOT_FOUND", 404);
  }
  if (register.deviceId !== deviceId) {
    throw new CashRegisterError(
      "This device is not assigned to the selected register",
      "REGISTER_DEVICE_MISMATCH",
      409
    );
  }
  if (!register.isActive) {
    throw new CashRegisterError(
      "The selected register is inactive",
      "REGISTER_INACTIVE",
      409
    );
  }
  return register;
}

export async function readCurrentRegisterSession(
  client: CashSqlClient,
  registerId: string,
  deviceId: string
): Promise<{ register: CashRegisterRow; session: CashRegisterSessionRow | null }> {
  const registers = await client.$queryRaw<CashRegisterRow[]>(Prisma.sql`
    SELECT
      "id", "code", "name", "deviceId", "location",
      "discrepancyApprovalThresholdMinor", "isActive",
      "createdAt", "updatedAt"
    FROM "CashRegister"
    WHERE "id" = ${registerId}
    LIMIT 1
  `);
  const register = registers[0];
  if (!register) {
    throw new CashRegisterError("Cash register not found", "REGISTER_NOT_FOUND", 404);
  }
  if (register.deviceId !== deviceId) {
    throw new CashRegisterError(
      "This device is not assigned to the selected register",
      "REGISTER_DEVICE_MISMATCH",
      409
    );
  }

  const sessions = await client.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
    SELECT
      "id", "registerId", "openKey", "status", "openingFloatMinor",
      "openedById", "openedByName", "openedAt", "closedAt",
      "createdAt", "updatedAt"
    FROM "CashRegisterSession"
    WHERE "registerId" = ${registerId} AND "status" = 'open'
    ORDER BY "openedAt" DESC
    LIMIT 1
  `);
  return { register, session: sessions[0] ?? null };
}

async function ensureLegacyRegisterSession(
  client: CashSqlClient,
  actor: CashActor
): Promise<RegisterSessionContext> {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "CashRegister" (
      "id", "code", "name", "deviceId", "location",
      "discrepancyApprovalThresholdMinor", "isActive"
    ) VALUES (
      ${LEGACY_REGISTER_ID}, ${LEGACY_REGISTER_CODE},
      'Legacy Web POS', ${LEGACY_DEVICE_ID}, 'Compatibility fallback',
      0, true
    )
    ON CONFLICT DO NOTHING
  `);

  const register = await lockRegister(client, LEGACY_REGISTER_ID, LEGACY_DEVICE_ID);
  const existing = await client.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
    SELECT
      "id", "registerId", "openKey", "status", "openingFloatMinor",
      "openedById", "openedByName", "openedAt", "closedAt",
      "createdAt", "updatedAt"
    FROM "CashRegisterSession"
    WHERE "registerId" = ${LEGACY_REGISTER_ID} AND "status" = 'open'
    LIMIT 1
    FOR UPDATE
  `);
  if (existing[0]) {
    return { register, session: existing[0], autoOpened: false };
  }

  const sessionId = newRegisterSessionId();
  const openKey = `legacy-auto:${randomUUID()}`;
  const created = await client.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
    INSERT INTO "CashRegisterSession" (
      "id", "registerId", "openKey", "status", "openingFloatMinor",
      "openedById", "openedByName"
    ) VALUES (
      ${sessionId}, ${register.id}, ${openKey}, 'open', 0,
      ${actor.id}, ${actor.name}
    )
    RETURNING
      "id", "registerId", "openKey", "status", "openingFloatMinor",
      "openedById", "openedByName", "openedAt", "closedAt",
      "createdAt", "updatedAt"
  `);
  return { register, session: created[0], autoOpened: true };
}

export async function lockOpenRegisterSession(
  client: CashSqlClient,
  options: {
    identity: RegisterIdentity;
    actor: CashActor;
    allowLegacyFallback?: boolean;
  }
): Promise<RegisterSessionContext> {
  const { registerId, deviceId } = options.identity;
  if (!registerId && !deviceId && options.allowLegacyFallback) {
    return ensureLegacyRegisterSession(client, options.actor);
  }
  if (!registerId || !deviceId) {
    throw new CashRegisterError(
      "Register and device headers are required",
      "REGISTER_IDENTITY_REQUIRED",
      400
    );
  }

  const register = await lockRegister(client, registerId, deviceId);
  const rows = await client.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
    SELECT
      "id", "registerId", "openKey", "status", "openingFloatMinor",
      "openedById", "openedByName", "openedAt", "closedAt",
      "createdAt", "updatedAt"
    FROM "CashRegisterSession"
    WHERE "registerId" = ${register.id} AND "status" = 'open'
    LIMIT 1
    FOR UPDATE
  `);
  const session = rows[0];
  if (!session) {
    throw new CashRegisterError(
      "Open the cash register before recording cash activity",
      "REGISTER_SESSION_REQUIRED",
      409,
      { registerId: register.id }
    );
  }
  return { register, session, autoOpened: false };
}

export async function readSessionExpectedCashMinor(
  client: CashSqlClient,
  session: Pick<CashRegisterSessionRow, "id" | "openingFloatMinor">
): Promise<bigint> {
  const rows = await client.$queryRaw<Array<{ movementMinor: bigint }>>(Prisma.sql`
    SELECT COALESCE(
      SUM(
        CASE
          WHEN "type"::text IN ('refund', 'payout', 'drop')
            THEN -"amountMinor"
          ELSE "amountMinor"
        END
      ),
      0
    )::bigint AS "movementMinor"
    FROM "CashDrawerEntry"
    WHERE "registerSessionId" = ${session.id}
  `);
  const expected = session.openingFloatMinor + (rows[0]?.movementMinor ?? BigInt(0));
  if (expected < BigInt(0)) {
    throw new CashRegisterError(
      "Register movements produce a negative expected cash balance",
      "REGISTER_EXPECTED_CASH_NEGATIVE",
      409
    );
  }
  return expected;
}

export async function readSessionCashEntries(
  client: CashSqlClient,
  sessionId: string,
  limit = 100
): Promise<SessionCashEntryRow[]> {
  return client.$queryRaw<SessionCashEntryRow[]>(Prisma.sql`
    SELECT
      "id", "type"::text AS "type", "amount", "amountMinor", "note",
      "createdBy", "createdAt", "updatedAt", "registerSessionId"
    FROM "CashDrawerEntry"
    WHERE "registerSessionId" = ${sessionId}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `);
}

export async function linkCashEntryToSession(
  client: CashSqlClient,
  entryId: string,
  sessionId: string
): Promise<void> {
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "CashDrawerEntry"
    SET "registerSessionId" = ${sessionId}
    WHERE "id" = ${entryId} AND "registerSessionId" IS NULL
  `);
  if (changed !== 1) {
    throw new CashRegisterError(
      "Unable to attach the cash movement to the register session",
      "CASH_SESSION_LINK_FAILED",
      500
    );
  }
}

export async function linkPaymentEventToSession(
  client: CashSqlClient,
  paymentEventId: string,
  sessionId: string
): Promise<void> {
  const changed = await client.$executeRaw(Prisma.sql`
    UPDATE "PaymentEvent"
    SET "registerSessionId" = ${sessionId}
    WHERE "id" = ${paymentEventId} AND "registerSessionId" IS NULL
  `);
  if (changed !== 1) {
    throw new CashRegisterError(
      "Unable to attach the payment event to the register session",
      "PAYMENT_SESSION_LINK_FAILED",
      500
    );
  }
}

export async function readPaymentRegisterLink(
  client: CashSqlClient,
  paymentEventId: string
): Promise<{ registerSessionId: string; registerId: string } | null> {
  const rows = await client.$queryRaw<
    Array<{ registerSessionId: string; registerId: string }>
  >(Prisma.sql`
    SELECT
      payment."registerSessionId",
      session."registerId"
    FROM "PaymentEvent" AS payment
    JOIN "CashRegisterSession" AS session
      ON session."id" = payment."registerSessionId"
    WHERE payment."id" = ${paymentEventId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}
