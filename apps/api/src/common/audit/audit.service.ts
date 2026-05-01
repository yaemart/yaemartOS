import { Injectable } from '@nestjs/common';
import { PrismaClientManager } from '../../database/prisma.service';

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
