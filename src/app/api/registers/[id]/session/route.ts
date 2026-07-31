import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  CASH_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  CashRegisterError,
  type CashRegisterCloseRow,
  type CashRegisterSessionRow,
  REGISTER_APPROVAL_ROLES,
  idempotencyKeyFromRequest,
  lockRegister,
  newRegisterCloseId,
  newRegisterSessionId,
  parseCurrencyInputToMinor,
  readCurrentRegisterSession,
  readSessionExpectedCashMinor,
  registerDeviceIdFromRequest,
  serializeClose,
  serializeRegister,
  serializeSession,
  signedMinorToNumber,
} from "@/lib/cash/register-session";
import { exactMinorToNumber } from "@/lib/money/exact-store";

const openSessionSchema = z
  .object({
    openingFloat: z.number().finite().min(0).max(1_000_000),
  })
  .strict();

const closeSessionSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(191),
    countedCash: z.number().finite().min(0).max(1_000_000_000),
    note: z.string().trim().max(1_000).nullable().optional(),
    approvalReason: z.string().trim().max(1_000).nullable().optional(),
  })
  .strict();

function errorResponse(error: CashRegisterError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const deviceId = registerDeviceIdFromRequest(req);
    const result = await readCurrentRegisterSession(db, id, deviceId);
    return NextResponse.json(
      {
        register: serializeRegister(result.register),
        session: result.session ? serializeSession(result.session) : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) return errorResponse(error);
    console.error("[register-session] Failed to load current session", error);
    return NextResponse.json(
      { error: "Unable to load register session", code: "REGISTER_SESSION_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const deviceId = registerDeviceIdFromRequest(req);
    const openKey = idempotencyKeyFromRequest(req);
    const parsed = openSessionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid register opening",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const openingFloatMinor = parseCurrencyInputToMinor(parsed.data.openingFloat);
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const register = await lockRegister(tx, id, deviceId);
      const replayRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
        SELECT
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName", "openedAt", "closedAt",
          "createdAt", "updatedAt"
        FROM "CashRegisterSession"
        WHERE "registerId" = ${register.id} AND "openKey" = ${openKey}
        LIMIT 1
      `);
      if (replayRows[0]) {
        return { register, session: replayRows[0], replayed: true };
      }

      const openRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
        SELECT
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName", "openedAt", "closedAt",
          "createdAt", "updatedAt"
        FROM "CashRegisterSession"
        WHERE "registerId" = ${register.id} AND "status" = 'open'
        LIMIT 1
        FOR UPDATE
      `);
      if (openRows[0]) {
        throw new CashRegisterError(
          "This register already has an open session",
          "REGISTER_ALREADY_OPEN",
          409,
          { session: serializeSession(openRows[0]) }
        );
      }

      const sessionId = newRegisterSessionId();
      const createdRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
        INSERT INTO "CashRegisterSession" (
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName"
        ) VALUES (
          ${sessionId}, ${register.id}, ${openKey}, 'open', ${openingFloatMinor},
          ${auth.session.id}, ${auth.session.name}
        )
        RETURNING
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName", "openedAt", "closedAt",
          "createdAt", "updatedAt"
      `);
      const session = createdRows[0];

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "cash.session.open",
        entityType: "CashRegisterSession",
        entityId: session.id,
        context,
        metadata: {
          registerId: register.id,
          registerCode: register.code,
          deviceId: register.deviceId,
          openingFloatMinor: openingFloatMinor.toString(),
        },
      });

      return { register, session, replayed: false };
    });

    return NextResponse.json(
      {
        register: serializeRegister(result.register),
        session: serializeSession(result.session),
        replayed: result.replayed,
      },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) return errorResponse(error);
    console.error("[register-session] Failed to open register", error);
    return NextResponse.json(
      { error: "Unable to open register", code: "REGISTER_OPEN_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const deviceId = registerDeviceIdFromRequest(req);
    const closeKey = idempotencyKeyFromRequest(req);
    const parsed = closeSessionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid register closing",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const countedCashMinor = parseCurrencyInputToMinor(parsed.data.countedCash);
    const context = auditContextFromRequest(req);
    const result = await db.$transaction(async (tx) => {
      const register = await lockRegister(tx, id, deviceId);
      const replayRows = await tx.$queryRaw<
        Array<CashRegisterCloseRow & { registerId: string }>
      >(Prisma.sql`
        SELECT close.*, session."registerId"
        FROM "CashRegisterClose" AS close
        JOIN "CashRegisterSession" AS session ON session."id" = close."sessionId"
        WHERE close."closeKey" = ${closeKey}
        LIMIT 1
      `);
      if (replayRows[0]) {
        if (replayRows[0].registerId !== register.id) {
          throw new CashRegisterError(
            "Idempotency key is already assigned to another register",
            "IDEMPOTENCY_KEY_CONFLICT",
            409
          );
        }
        const sessionRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
          SELECT
            "id", "registerId", "openKey", "status", "openingFloatMinor",
            "openedById", "openedByName", "openedAt", "closedAt",
            "createdAt", "updatedAt"
          FROM "CashRegisterSession"
          WHERE "id" = ${replayRows[0].sessionId}
          LIMIT 1
        `);
        return {
          register,
          session: sessionRows[0],
          close: replayRows[0],
          replayed: true,
        };
      }

      const sessionRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
        SELECT
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName", "openedAt", "closedAt",
          "createdAt", "updatedAt"
        FROM "CashRegisterSession"
        WHERE "id" = ${parsed.data.sessionId} AND "registerId" = ${register.id}
        LIMIT 1
        FOR UPDATE
      `);
      const session = sessionRows[0];
      if (!session) {
        throw new CashRegisterError(
          "Register session not found",
          "REGISTER_SESSION_NOT_FOUND",
          404
        );
      }
      if (session.status !== "open") {
        throw new CashRegisterError(
          "Register session is already closed",
          "REGISTER_SESSION_CLOSED",
          409
        );
      }

      const expectedCashMinor = await readSessionExpectedCashMinor(tx, session);
      const discrepancyMinor = countedCashMinor - expectedCashMinor;
      const absoluteDiscrepancy =
        discrepancyMinor < BigInt(0) ? -discrepancyMinor : discrepancyMinor;
      const approvalRequired =
        absoluteDiscrepancy > register.discrepancyApprovalThresholdMinor;
      const canApprove = REGISTER_APPROVAL_ROLES.includes(
        auth.session.role as (typeof REGISTER_APPROVAL_ROLES)[number]
      );
      const approvalReason = parsed.data.approvalReason?.trim() || null;

      if (approvalRequired && !canApprove) {
        throw new CashRegisterError(
          "A manager must approve this cash discrepancy",
          "MANAGER_APPROVAL_REQUIRED",
          409,
          {
            expectedCash: exactMinorToNumber(expectedCashMinor),
            countedCash: exactMinorToNumber(countedCashMinor),
            discrepancy: signedMinorToNumber(discrepancyMinor),
            discrepancyApprovalThreshold: exactMinorToNumber(
              register.discrepancyApprovalThresholdMinor
            ),
          }
        );
      }
      if (approvalRequired && !approvalReason) {
        throw new CashRegisterError(
          "An approval reason is required for this discrepancy",
          "APPROVAL_REASON_REQUIRED",
          400
        );
      }

      const closedAt = new Date();
      const updatedRows = await tx.$queryRaw<CashRegisterSessionRow[]>(Prisma.sql`
        UPDATE "CashRegisterSession"
        SET "status" = 'closed', "closedAt" = ${closedAt}, "updatedAt" = ${closedAt}
        WHERE "id" = ${session.id} AND "status" = 'open'
        RETURNING
          "id", "registerId", "openKey", "status", "openingFloatMinor",
          "openedById", "openedByName", "openedAt", "closedAt",
          "createdAt", "updatedAt"
      `);
      if (!updatedRows[0]) {
        throw new CashRegisterError(
          "Register session changed before it could be closed",
          "REGISTER_CLOSE_CONFLICT",
          409
        );
      }

      const closeId = newRegisterCloseId();
      const closeRows = await tx.$queryRaw<CashRegisterCloseRow[]>(Prisma.sql`
        INSERT INTO "CashRegisterClose" (
          "id", "sessionId", "closeKey", "expectedCashMinor",
          "countedCashMinor", "discrepancyMinor", "thresholdMinor",
          "approvalRequired", "approvedById", "approvedByName",
          "approvalReason", "closedById", "closedByName", "note"
        ) VALUES (
          ${closeId}, ${session.id}, ${closeKey}, ${expectedCashMinor},
          ${countedCashMinor}, ${discrepancyMinor},
          ${register.discrepancyApprovalThresholdMinor}, ${approvalRequired},
          ${approvalRequired ? auth.session.id : null},
          ${approvalRequired ? auth.session.name : null},
          ${approvalRequired ? approvalReason : null},
          ${auth.session.id}, ${auth.session.name},
          ${parsed.data.note?.trim() || null}
        )
        RETURNING *
      `);
      const close = closeRows[0];

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "cash.session.close",
        entityType: "CashRegisterClose",
        entityId: close.id,
        context,
        metadata: {
          registerId: register.id,
          registerCode: register.code,
          sessionId: session.id,
          expectedCashMinor: expectedCashMinor.toString(),
          countedCashMinor: countedCashMinor.toString(),
          discrepancyMinor: discrepancyMinor.toString(),
          thresholdMinor: register.discrepancyApprovalThresholdMinor.toString(),
          approvalRequired,
          approvedById: close.approvedById,
          approvalReason: close.approvalReason,
        },
      });

      return {
        register,
        session: updatedRows[0],
        close,
        replayed: false,
      };
    });

    return NextResponse.json(
      {
        register: serializeRegister(result.register),
        session: serializeSession(result.session),
        close: serializeClose(result.close),
        replayed: result.replayed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) return errorResponse(error);
    console.error("[register-session] Failed to close register", error);
    return NextResponse.json(
      { error: "Unable to close register", code: "REGISTER_CLOSE_FAILED" },
      { status: 500 }
    );
  }
}
