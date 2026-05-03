import { Injectable, Logger } from '@nestjs/common';
import { TENANT_SCHEMAS } from '@yaemartos/db';
import { PrismaClientManager } from '../../database/prisma.service';

export interface AggregatedTicket {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  brand: string;
  customerId: string;
  assigneeId: string | null;
}

export interface AggregationResult {
  results: AggregatedTicket[];
  total: number;
  page: number;
  limit: number;
  partialFailures: string[];
}

interface FilterOptions {
  status?: string;
  priority?: string;
  brandId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TicketAggregationService {
  private readonly logger = new Logger(TicketAggregationService.name);

  constructor(private readonly prismaManager: PrismaClientManager) {}

  /**
   * Aggregates tickets across all tenant schemas (or a single brand if specified).
   * On per-schema failures, returns partial results with failing brands listed in
   * `partialFailures` — never throws.
   */
  async findAll(filters: FilterOptions = {}): Promise<AggregationResult> {
    const { status, priority, brandId, page = 1, limit = 50 } = filters;

    const schemas = brandId ? TENANT_SCHEMAS.filter((s) => s === brandId) : [...TENANT_SCHEMAS];

    const allTickets: AggregatedTicket[] = [];
    const partialFailures: string[] = [];

    for (const schema of schemas) {
      try {
        const client = this.prismaManager.getTenantClient(schema);
        const tickets = await (client as any).ticket.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(priority ? { priority } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            ticketNo: true,
            subject: true,
            status: true,
            priority: true,
            tags: true,
            createdAt: true,
            updatedAt: true,
            customerId: true,
            assigneeId: true,
          },
        });

        allTickets.push(
          ...tickets.map((t: Omit<AggregatedTicket, 'brand'>) => ({
            ...t,
            brand: schema,
          })),
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Aggregation failed for schema ${schema}: ${reason}`);
        partialFailures.push(schema);
      }
    }

    allTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = allTickets.length;
    const skip = (page - 1) * limit;
    const results = allTickets.slice(skip, skip + limit);

    return { results, total, page, limit, partialFailures };
  }
}
