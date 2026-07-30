import "server-only";

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { StaffSession } from "@/lib/auth/session";
import { sanitizeAuditMetadata } from "./sanitize";

export interface AuditRequestContext {
  requestId: string | null;
  sourceHash: string;
  userAgent: string;
}

type AuditActor = Pick<StaffSession, "id" | "name" | "role"> &
  Partial<Pick<StaffSession, "sessionId">>;

export interface AuditEventInput {
  actor?: AuditActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  context?: AuditRequestContext;
  metadata?: unknown;
}

type AuditClient =
  | Pick<PrismaClient, "auditEvent">
  | Pick<Prisma.TransactionClient, "auditEvent">;

function boundedHeader(value: string | null, maxLength: number): string {
  return (value || "").trim().slice(0, maxLength);
}

export function auditContextFromRequest(request: Request): AuditRequestContext {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const source = forwarded || request.headers.get("x-real-ip") || "";

  return {
    requestId: boundedHeader(request.headers.get("x-request-id"), 128) || null,
    sourceHash: source
      ? createHash("sha256").update(source).digest("hex").slice(0, 32)
      : "",
    userAgent: boundedHeader(request.headers.get("user-agent"), 512),
  };
}

export async function writeAuditEvent(
  client: AuditClient,
  input: AuditEventInput
): Promise<void> {
  const context = input.context;
  const metadata =
    input.metadata === undefined
      ? undefined
      : (sanitizeAuditMetadata(input.metadata) as Prisma.InputJsonValue);

  await client.auditEvent.create({
    data: {
      actorId: input.actor?.id || null,
      actorName: input.actor?.name || "",
      actorRole: input.actor?.role || "",
      sessionId: input.actor?.sessionId || null,
      action: input.action.slice(0, 160),
      entityType: input.entityType.slice(0, 120),
      entityId: input.entityId?.slice(0, 191) || null,
      requestId: context?.requestId || null,
      sourceHash: context?.sourceHash || "",
      userAgent: context?.userAgent || "",
      metadata,
    },
  });
}