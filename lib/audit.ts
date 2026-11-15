import type { Prisma } from "@prisma/client";
import { clientIp, userAgentOf } from "@/lib/request";

type AuditInput = {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousData?: Prisma.InputJsonObject;
  newData?: Prisma.InputJsonObject;
  reason?: string;
  request?: Request;
};

/** Adds one row to the audit log, including where the request came from. Call it inside the same transaction as the change. */
export async function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousData: input.previousData,
      newData: input.newData,
      reason: input.reason,
      ipAddress: input.request ? clientIp(input.request) : null,
      userAgent: input.request ? userAgentOf(input.request) : null,
    },
  });
}
