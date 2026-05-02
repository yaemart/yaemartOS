import { Injectable } from '@nestjs/common';
import { PrismaClientManager } from '../../database/prisma.service';

/**
 * Input for a write-operation audit entry.
 *
 * `metadata` is a free-form JSON field. Convention for mutation events:
 *   `{ before: <snapshot|null>, after: <snapshot|null>, changedFields?: string[], ...extra }`
 * The `before` snapshot captures state immediately before the mutation;
 * `after` captures the result. Both may be null (null for create.before, delete.after).
 * Snapshot shape is defined by the caller to avoid large text fields.
 */
type AuditInput = {
  userId?: string;
  tenant?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  async logWrite(input: AuditInput) {
    const prisma = this.prismaManager.getPublicClient();
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        tenant: input.tenant,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
