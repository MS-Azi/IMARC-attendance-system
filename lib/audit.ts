import { prisma } from "./db";

/** Records a change for the worklog module's read-only change log (admin section 4.5). */
export async function writeAuditLog(entry: {
  actorType: "ADMIN" | "STAFF";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === undefined ? undefined : (entry.before as any),
      after: entry.after === undefined ? undefined : (entry.after as any),
      reason: entry.reason,
    },
  });
}
