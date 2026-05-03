import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SenderType = 'customer' | 'ai' | 'agent';

const TICKET_STATUSES: ReadonlySet<TicketStatus> = new Set([
  'open',
  'in_progress',
  'resolved',
  'closed',
]);

function assertTicketStatus(value: unknown): TicketStatus {
  if (typeof value === 'string' && TICKET_STATUSES.has(value as TicketStatus)) {
    return value as TicketStatus;
  }
  throw new BadRequestException(`Invalid ticket status: ${String(value)}`);
}

interface CreateTicketInput {
  customerId: string;
  subject: string;
  initialMessage: string;
  priority?: TicketPriority;
  tags?: string[];
  sessionId?: string;
}

interface EscalateFromChatInput {
  customerId: string;
  sessionId: string;
  subject: string;
  lastMessages: Array<{ role: string; content: string }>;
}

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'open'],
  closed: [],
};

@Injectable()
export class TicketService {
  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(input: CreateTicketInput) {
    const brand = this.tenantContext.getTenant();
    const ticketNo = await this.generateTicketNo(brand);

    const ticket = await this.tenantDb.ticket.create({
      data: {
        customerId: input.customerId,
        sessionId: input.sessionId ?? null,
        ticketNo,
        subject: input.subject,
        status: 'open',
        priority: input.priority ?? 'normal',
        tags: input.tags ?? [],
        slaHours: 24,
        slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        messages: {
          create: {
            senderType: 'customer',
            content: input.initialMessage,
          },
        },
      },
      include: { messages: true },
    });

    return ticket;
  }

  async escalateFromChat(input: EscalateFromChatInput) {
    const aiSummary = input.lastMessages
      .slice(-4)
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n');

    const ticket = await this.tenantDb.ticket.create({
      data: {
        customerId: input.customerId,
        sessionId: input.sessionId,
        ticketNo: await this.generateTicketNo(this.tenantContext.getTenant()),
        subject: input.subject,
        status: 'open',
        priority: 'normal',
        tags: ['ai-escalated'],
        slaHours: 24,
        slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        messages: {
          create: {
            senderType: 'ai',
            content: `Escalated from AI chat. Recent conversation:\n\n${aiSummary}`,
          },
        },
      },
    });

    return ticket;
  }

  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.tenantDb.ticket.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          ticketNo: true,
          subject: true,
          status: true,
          priority: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.tenantDb.ticket.count({ where: { customerId } }),
    ]);

    return { items, total, page, limit };
  }

  async findMessages(ticketId: string, customerId: string) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, customerId: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    if (ticket.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    return this.tenantDb.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true, senderType: true, content: true, createdAt: true },
    });
  }

  async addMessage(opts: {
    ticketId: string;
    customerId: string;
    content: string;
    senderType?: SenderType;
  }) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: opts.ticketId },
      select: { id: true, customerId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${opts.ticketId} not found`);
    }
    if (ticket.customerId !== opts.customerId) {
      throw new ForbiddenException('Access denied');
    }
    if (ticket.status === 'closed') {
      throw new BadRequestException('TICKET_CLOSED');
    }

    return this.tenantDb.ticketMessage.create({
      data: {
        ticketId: opts.ticketId,
        senderType: opts.senderType ?? 'customer',
        content: opts.content,
      },
    });
  }

  async closeByCustomer(ticketId: string, customerId: string) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, customerId: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    if (ticket.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }
    if (ticket.status === 'closed') {
      throw new BadRequestException('TICKET_CLOSED');
    }

    return this.tenantDb.ticket.update({
      where: { id: ticketId },
      data: { status: 'closed', closedAt: new Date() },
    });
  }

  async updateStatus(opts: { ticketId: string; status: TicketStatus; assigneeId?: string }) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: opts.ticketId },
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${opts.ticketId} not found`);
    }

    const currentStatus = assertTicketStatus(ticket.status);
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(opts.status)) {
      throw new BadRequestException(`Cannot transition from ${ticket.status} to ${opts.status}`);
    }

    return this.tenantDb.ticket.update({
      where: { id: opts.ticketId },
      data: {
        status: opts.status,
        assigneeId: opts.assigneeId,
        closedAt: opts.status === 'closed' ? new Date() : undefined,
      },
    });
  }

  async assign(ticketId: string, assigneeId: string) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return this.tenantDb.ticket.update({
      where: { id: ticketId },
      data: { assigneeId },
    });
  }

  async addAgentMessage(ticketId: string, content: string) {
    const ticket = await this.tenantDb.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    if (ticket.status === 'closed') {
      throw new BadRequestException('TICKET_CLOSED');
    }

    return this.tenantDb.ticketMessage.create({
      data: { ticketId, senderType: 'agent', content },
    });
  }

  private async generateTicketNo(brand: string): Promise<string> {
    const prefix = brand.slice(0, 2).toUpperCase();
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    // Use a PostgreSQL sequence for atomic, race-free ticket numbering.
    // The sequence is created per-schema by migrate-tenant-schemas.ts.
    const result = await this.tenantDb.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('ticket_seq')
    `;
    const seq = String(Number(result[0].nextval)).padStart(4, '0');
    return `${prefix}-${datePart}-${seq}`;
  }
}
