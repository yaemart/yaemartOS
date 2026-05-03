import { Injectable, Logger } from '@nestjs/common';
import { TENANT_SCHEMAS, type TenantSchema } from '@yaemartos/db';
import { PrismaClientManager } from '../../database/prisma.service';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';

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
   * Queries all schemas in parallel. On per-schema failures returns partial results
   * with failing brands listed in `partialFailures` — never throws.
   *
   * To avoid OOM, each schema query is capped at PER_SCHEMA_MAX rows. For exact
   * cross-brand pagination, a future implementation should use a cursor-based
   * approach or push pagination to a search index.
   */
  async findAll(filters: FilterOptions = {}): Promise<AggregationResult> {
    const { status, priority, brandId, page = 1, limit = 50 } = filters;
    const clampedLimit = Math.min(limit, 200);
    const PER_SCHEMA_MAX = Math.min(clampedLimit * page * 2, 500);

    const schemas = brandId ? TENANT_SCHEMAS.filter((s) => s === brandId) : [...TENANT_SCHEMAS];

    const schemaResults = await Promise.allSettled(
      schemas.map(async (schema) => {
        const client: TenantPrismaClient = this.prismaManager.getTenantClient(
          schema as TenantSchema,
        );
        const tickets = await client.ticket.findMany({
          where: {
            ...(status ? { status } : {}),
            ...(priority ? { priority } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: PER_SCHEMA_MAX,
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
        return { schema, tickets: tickets as Omit<AggregatedTicket, 'brand'>[] };
      }),
    );

    const allTickets: AggregatedTicket[] = [];
    const partialFailures: string[] = [];

    for (const result of schemaResults) {
      if (result.status === 'fulfilled') {
        allTickets.push(...result.value.tickets.map((t) => ({ ...t, brand: result.value.schema })));
      } else {
        const failedSchema = schemas[schemaResults.indexOf(result)];
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        this.logger.error(`Aggregation failed for schema ${failedSchema}: ${reason}`);
        partialFailures.push(failedSchema);
      }
    }

    allTickets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = allTickets.length;
    const skip = (page - 1) * clampedLimit;
    const results = allTickets.slice(skip, skip + clampedLimit);

    return { results, total, page, limit: clampedLimit, partialFailures };
  }
}
