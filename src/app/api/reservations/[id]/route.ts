import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESERVATION_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import type { StaffSession } from "@/lib/auth/session";
import {
  CustomerAccessConfigurationError,
  verifyCustomerAccessToken,
} from "@/lib/customer-access";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  assertReservationTableAvailable,
  customerCancellationAllowed,
  lockReservation,
  readReservationPolicy,
  reservationErrorFromDatabase,
  ReservationAvailabilityError,
  serializeReservationForCustomer,
  serializeReservationForStaff,
} from "@/lib/reservations/availability";

const reservationUpdateSchema = z
  .object({
    status: z
      .enum(["confirmed", "seated", "completed", "cancelled", "no_show"])
      .optional(),
    tableId: z.string().trim().min(1).max(191).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required",
  });

type ReservationUpdate = z.infer<typeof reservationUpdateSchema>;

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

function accessToken(req: NextRequest): string | null {
  const queryToken = new URL(req.url).searchParams.get("token");
  if (queryToken) return queryToken;
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function errorResponse(error: ReservationAvailabilityError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

async function applyReservationUpdate(input: {
  req: NextRequest;
  id: string;
  update: ReservationUpdate;
  customerAuthorized: boolean;
  staffSession: StaffSession | null;
}) {
  const context = auditContextFromRequest(input.req);
  const result = await db.$transaction(
    async (tx) => {
      const existing = await lockReservation(tx, input.id);
      if (!existing) {
        throw new ReservationAvailabilityError(
          "Reservation not found",
          "RESERVATION_NOT_FOUND",
          404
        );
      }
      const policy = await readReservationPolicy(tx);

      if (input.customerAuthorized) {
        if (
          input.update.status !== "cancelled" ||
          input.update.tableId !== undefined ||
          input.update.notes !== undefined
        ) {
          throw new ReservationAvailabilityError(
            "Customers may only cancel an eligible confirmed reservation",
            "CUSTOMER_RESERVATION_CHANGE_DENIED",
            409
          );
        }
        if (!customerCancellationAllowed(existing, policy)) {
          throw new ReservationAvailabilityError(
            "This reservation is inside the cancellation cutoff",
            "CUSTOMER_CANCELLATION_CUTOFF",
            409,
            { cutoffMinutes: policy.customerCancelCutoffMinutes }
          );
        }
      }

      const nextStatus = input.update.status || existing.status;
      if (
        nextStatus !== existing.status &&
        !(ALLOWED_TRANSITIONS[existing.status] || []).includes(nextStatus)
      ) {
        throw new ReservationAvailabilityError(
          `Reservation cannot move from ${existing.status} to ${nextStatus}`,
          "INVALID_STATUS_TRANSITION",
          409
        );
      }

      if (
        input.update.tableId !== undefined &&
        existing.status !== "confirmed"
      ) {
        throw new ReservationAvailabilityError(
          "Table assignment can only change while a reservation is confirmed",
          "RESERVATION_REASSIGNMENT_CLOSED",
          409
        );
      }
      if (
        input.update.tableId === null &&
        ["confirmed", "seated"].includes(nextStatus)
      ) {
        throw new ReservationAvailabilityError(
          "Active reservations must retain an assigned table",
          "RESERVATION_TABLE_REQUIRED",
          409
        );
      }

      const targetTableId =
        input.update.tableId === undefined
          ? existing.tableId
          : input.update.tableId;
      let targetTable: Awaited<
        ReturnType<typeof assertReservationTableAvailable>
      > | null = null;
      if (targetTableId) {
        targetTable = await assertReservationTableAvailable(tx, {
          tableId: targetTableId,
          reservationId: existing.id,
          partySize: existing.partySize,
          startsAt: existing.dateTime,
          releaseAt: existing.releaseAt,
        });
      }
      if (nextStatus === "seated" && !targetTableId) {
        throw new ReservationAvailabilityError(
          "A table must be assigned before seating this reservation",
          "RESERVATION_TABLE_REQUIRED",
          409
        );
      }
      if (
        nextStatus === "seated" &&
        targetTable &&
        !["open", "reserved", "seated"].includes(targetTable.status)
      ) {
        throw new ReservationAvailabilityError(
          "The assigned table is not ready to seat",
          "RESERVATION_TABLE_NOT_READY",
          409,
          { tableStatus: targetTable.status }
        );
      }

      const now = new Date();
      const updateData: Prisma.ReservationUpdateInput = {
        ...(input.update.notes !== undefined
          ? { notes: input.update.notes || null }
          : {}),
        ...(input.update.tableId !== undefined
          ? {
              table: input.update.tableId
                ? { connect: { id: input.update.tableId } }
                : { disconnect: true },
            }
          : {}),
      };
      if (nextStatus !== existing.status) {
        updateData.status = nextStatus;
        if (nextStatus === "seated") updateData.seatedAt = now;
        if (nextStatus === "completed") updateData.completedAt = now;
        if (nextStatus === "cancelled") updateData.cancelledAt = now;
        if (nextStatus === "no_show") updateData.noShowAt = now;
      }

      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: updateData,
        include: { table: true },
      });

      if (nextStatus === "seated" && targetTableId) {
        await tx.restaurantTable.update({
          where: { id: targetTableId },
          data: { status: "seated", seatedAt: now },
        });
      }
      if (
        existing.status === "seated" &&
        ["completed", "cancelled"].includes(nextStatus) &&
        existing.tableId
      ) {
        await tx.restaurantTable.updateMany({
          where: { id: existing.tableId, status: "seated" },
          data: { status: "cleaning", seatedAt: null },
        });
      }

      await writeAuditEvent(tx, {
        actor: input.staffSession,
        action: input.customerAuthorized
          ? "reservation.customer.cancel"
          : nextStatus !== existing.status
            ? "reservation.status.update"
            : input.update.tableId !== undefined
              ? "reservation.table.reassign"
              : "reservation.notes.update",
        entityType: "Reservation",
        entityId: reservation.id,
        context,
        metadata: {
          before: {
            status: existing.status,
            tableId: existing.tableId,
            notes: existing.notes,
          },
          after: {
            status: reservation.status,
            tableId: reservation.tableId,
            notes: reservation.notes,
          },
          customerAuthorized: input.customerAuthorized,
        },
      });
      return { reservation, timezone: policy.timezone };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const reservation = input.customerAuthorized
    ? serializeReservationForCustomer(result.reservation, result.timezone)
    : serializeReservationForStaff(result.reservation, result.timezone);
  return NextResponse.json(
    { reservation },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerAuthorized = verifyCustomerAccessToken(
      "reservation",
      id,
      accessToken(req)
    );
    let staffSession: StaffSession | null = null;
    if (!customerAuthorized) {
      const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
      if ("response" in auth) return auth.response;
      staffSession = auth.session;
    }

    const parsed = reservationUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid reservation update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    return await applyReservationUpdate({
      req,
      id,
      update: parsed.data,
      customerAuthorized,
      staffSession,
    });
  } catch (error) {
    if (error instanceof CustomerAccessConfigurationError) {
      return NextResponse.json(
        {
          error: "Reservation access is not configured",
          code: "CUSTOMER_ACCESS_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }
    if (error instanceof ReservationAvailabilityError) {
      return errorResponse(error);
    }
    const mapped = reservationErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[reservations] Failed to update reservation", error);
    return NextResponse.json(
      { error: "Unable to update reservation", code: "RESERVATION_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffSession(RESERVATION_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    return await applyReservationUpdate({
      req,
      id,
      update: { status: "cancelled" },
      customerAuthorized: false,
      staffSession: auth.session,
    });
  } catch (error) {
    if (error instanceof ReservationAvailabilityError) {
      return errorResponse(error);
    }
    const mapped = reservationErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[reservations] Failed to cancel reservation", error);
    return NextResponse.json(
      { error: "Unable to cancel reservation", code: "RESERVATION_CANCEL_FAILED" },
      { status: 500 }
    );
  }
}
