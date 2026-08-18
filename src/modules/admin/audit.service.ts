import type { Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { buildMeta, toSkipTake } from "../../lib/pagination";

export type AuditAction =
  | "SELLER_STATUS_CHANGED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED"
  | "PRODUCT_ACTIVATED"
  | "PRODUCT_DEACTIVATED"
  | "REVIEW_HIDDEN"
  | "REVIEW_UNHIDDEN"
  | "COUPON_CREATED"
  | "COUPON_UPDATED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_REJECTED"
  | "REPORT_UPDATED";

export type AuditEntry = {
  actorUserId: string;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};
  
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata ?? undefined,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, "gagal menulis audit log");
  }
}

export async function listAuditLogs(query: {
  action?: string;
  targetType?: string;
  actorUserId?: string;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}
