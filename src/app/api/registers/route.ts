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
  type CashRegisterRow,
  type CashRegisterSessionRow,
  newRegisterId,
  parseCurrencyInputToMinor,
  serializeRegister,
  serializeSession,
} from "@/lib/cash/register-session";

const REGISTER_MANAGEMENT_ROLES = ["owner", "admin", "manager"] as const;
const LEGACY_COMPATIBILITY_REGISTER_CODE = "LEGACY-WEB-POS";

const registerSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
      .transform((value) => value.toUpperCase()),
    name: z.string().trim().min(1).max(160),
    deviceId: z.string().trim().min(1).max(191),
    location: z.string().trim().max(240).default(""),
    discrepancyApprovalThreshold: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000)
      .default(0),
  })
  .strict();

type RegisterListRow = CashRegisterRow & {
  sessionId: string | null;
  sessionOpenKey: string | null;
  sessionStatus: "open" | "closed" | null;
  sessionOpeningFloatMinor: bigint | null;
  sessionOpenedById: string | null;
  sessionOpenedByName: string | null;
  sessionOpenedAt: Date | null;
  sessionClosedAt: Date | null;
  sessionCreatedAt: Date | null;
  sessionUpdatedAt: Date | null;
};

function sessionFromListRow(row: RegisterListRow): CashRegisterSessionRow | null {
  if (
    !row.sessionId ||
    !row.sessionOpenKey ||
    !row.sessionStatus ||
    row.sessionOpeningFloatMinor === null ||
    !row.sessionOpenedById ||
    row.sessionOpenedByName === null ||
    !row.sessionOpenedAt ||
    !row.sessionCreatedAt ||
    !row.sessionUpdatedAt
  ) {
    return null;
  }
  return {
    id: row.sessionId,
    registerId: row.id,
    openKey: row.sessionOpenKey,
    status: row.sessionStatus,
    openingFloatMinor: row.sessionOpeningFloatMinor,
    openedById: row.sessionOpenedById,
    openedByName: row.sessionOpenedByName,
    openedAt: row.sessionOpenedAt,
    closedAt: row.sessionClosedAt,
    createdAt: row.sessionCreatedAt,
    updatedAt: row.sessionUpdatedAt,
  };
}

export async function GET() {
  const auth = await requireStaffSession(CASH_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const rows = await db.$queryRaw<RegisterListRow[]>(Prisma.sql`
      SELECT
        register."id",
        register."code",
        register."name",
        register."deviceId",
        register."location",
        register."discrepancyApprovalThresholdMinor",
        register."isActive",
        register."createdAt",
        register."updatedAt",
        session."id" AS "sessionId",
        session."openKey" AS "sessionOpenKey",
        session."status" AS "sessionStatus",
        session."openingFloatMinor" AS "sessionOpeningFloatMinor",
        session."openedById" AS "sessionOpenedById",
        session."openedByName" AS "sessionOpenedByName",
        session."openedAt" AS "sessionOpenedAt",
        session."closedAt" AS "sessionClosedAt",
        session."createdAt" AS "sessionCreatedAt",
        session."updatedAt" AS "sessionUpdatedAt"
      FROM "CashRegister" AS register
      LEFT JOIN LATERAL (
        SELECT *
        FROM "CashRegisterSession"
        WHERE "registerId" = register."id" AND "status" = 'open'
        ORDER BY "openedAt" DESC
        LIMIT 1
      ) AS session ON true
      WHERE register."code" <> ${LEGACY_COMPATIBILITY_REGISTER_CODE}
      ORDER BY register."name" ASC, register."code" ASC
    `);

    return NextResponse.json(
      {
        registers: rows.map((row) => {
          const session = sessionFromListRow(row);
          return {
            ...serializeRegister(row),
            currentSession: session ? serializeSession(session) : null,
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[registers] Failed to load cash registers", error);
    return NextResponse.json(
      { error: "Unable to load cash registers", code: "REGISTERS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(REGISTER_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid cash register",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    if (parsed.data.code === LEGACY_COMPATIBILITY_REGISTER_CODE) {
      throw new CashRegisterError(
        "That register code is reserved for legacy checkout compatibility",
        "REGISTER_CODE_RESERVED",
        400
      );
    }

    const thresholdMinor = parseCurrencyInputToMinor(
      parsed.data.discrepancyApprovalThreshold
    );
    const registerId = newRegisterId();
    const context = auditContextFromRequest(req);
    const register = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CashRegisterRow[]>(Prisma.sql`
        INSERT INTO "CashRegister" (
          "id", "code", "name", "deviceId", "location",
          "discrepancyApprovalThresholdMinor", "isActive"
        ) VALUES (
          ${registerId}, ${parsed.data.code}, ${parsed.data.name},
          ${parsed.data.deviceId}, ${parsed.data.location}, ${thresholdMinor}, true
        )
        ON CONFLICT DO NOTHING
        RETURNING
          "id", "code", "name", "deviceId", "location",
          "discrepancyApprovalThresholdMinor", "isActive",
          "createdAt", "updatedAt"
      `);
      const created = rows[0];
      if (!created) {
        throw new CashRegisterError(
          "Register code or device identity is already in use",
          "REGISTER_IDENTITY_CONFLICT",
          409
        );
      }

      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "cash.register.create",
        entityType: "CashRegister",
        entityId: created.id,
        context,
        metadata: {
          code: created.code,
          name: created.name,
          deviceId: created.deviceId,
          location: created.location,
          discrepancyApprovalThresholdMinor: thresholdMinor.toString(),
        },
      });
      return created;
    });

    return NextResponse.json(
      { register: serializeRegister(register) },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CashRegisterError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("[registers] Failed to create cash register", error);
    return NextResponse.json(
      { error: "Unable to create cash register", code: "REGISTER_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
