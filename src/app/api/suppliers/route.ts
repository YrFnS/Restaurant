import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INVENTORY_MANAGEMENT_ROLES,
  requireStaffSession,
} from "@/lib/auth/guard";
import { auditContextFromRequest, writeAuditEvent } from "@/lib/audit";
import {
  createSupplier,
  listSuppliers,
  PurchasingError,
  purchasingErrorFromDatabase,
  updateSupplier,
} from "@/lib/inventory/purchasing";

const supplierFields = {
  code: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(240),
  contactName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  address: z.string().trim().max(1_000).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
};

const createSupplierSchema = z.object(supplierFields).strict();
const updateSupplierSchema = z
  .object({
    id: z.string().trim().min(1).max(191),
    code: supplierFields.code,
    name: supplierFields.name.optional(),
    contactName: supplierFields.contactName,
    phone: supplierFields.phone,
    email: supplierFields.email,
    address: supplierFields.address,
    paymentTerms: supplierFields.paymentTerms,
    notes: supplierFields.notes,
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one editable field is required",
  });

function errorResponse(error: PurchasingError) {
  return NextResponse.json(
    { error: error.message, code: error.code, details: error.details },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const suppliers = await listSuppliers(db);
    return NextResponse.json(
      { suppliers },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mapped = purchasingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[suppliers] Failed to load suppliers", error);
    return NextResponse.json(
      { error: "Unable to load suppliers", code: "SUPPLIERS_LOAD_FAILED" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = createSupplierSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid supplier",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const supplier = await db.$transaction(async (tx) => {
      const created = await createSupplier(tx, parsed.data);
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "purchasing.supplier.create",
        entityType: "Supplier",
        entityId: created.id,
        context,
        metadata: {
          code: created.code,
          name: created.name,
          status: created.status,
        },
      });
      return created;
    });

    return NextResponse.json(
      { supplier },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PurchasingError) return errorResponse(error);
    const mapped = purchasingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[suppliers] Failed to create supplier", error);
    return NextResponse.json(
      { error: "Unable to create supplier", code: "SUPPLIER_CREATE_FAILED" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession(INVENTORY_MANAGEMENT_ROLES);
  if ("response" in auth) return auth.response;

  try {
    const parsed = updateSupplierSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid supplier update",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const context = auditContextFromRequest(req);
    const supplier = await db.$transaction(async (tx) => {
      const updated = await updateSupplier(tx, parsed.data);
      await writeAuditEvent(tx, {
        actor: auth.session,
        action: "purchasing.supplier.update",
        entityType: "Supplier",
        entityId: updated.id,
        context,
        metadata: {
          code: updated.code,
          name: updated.name,
          status: updated.status,
          fields: Object.keys(parsed.data).filter((field) => field !== "id"),
        },
      });
      return updated;
    });

    return NextResponse.json(
      { supplier },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof PurchasingError) return errorResponse(error);
    const mapped = purchasingErrorFromDatabase(error);
    if (mapped) return errorResponse(mapped);
    console.error("[suppliers] Failed to update supplier", error);
    return NextResponse.json(
      { error: "Unable to update supplier", code: "SUPPLIER_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
