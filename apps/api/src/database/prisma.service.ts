import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_SCHEMAS, type TenantSchema, buildSchemaConnectionString } from '@yaemartos/db';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma';

@Injectable()
export class PrismaClientManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaClientManager.name);
  private readonly baseConnectionString: string;
  private readonly pools = new Map<string, Pool>();
  private readonly clients = new Map<string, PrismaClient>();

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PrismaClientManager');
    }
    this.baseConnectionString = connectionString;
  }

  async onModuleInit() {
    await this.getPublicClient().$connect();
    this.logger.log('Database connected (public)');
  }

  getPublicClient(): PrismaClient {
    return this.getClientForSchema('public');
  }

  getTenantClient(schema: TenantSchema): PrismaClient {
    if (!TENANT_SCHEMAS.includes(schema)) {
      throw new Error(`Unsupported tenant schema: ${schema}`);
    }
    return this.getClientForSchema(schema);
  }

  private getClientForSchema(schema: string): PrismaClient {
    if (this.clients.has(schema)) {
      return this.clients.get(schema)!;
    }

    const connectionString =
      schema === 'public'
        ? this.baseConnectionString
        : buildSchemaConnectionString(this.baseConnectionString, schema);

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    this.pools.set(schema, pool);
    this.clients.set(schema, client);
    return client;
  }

  async onModuleDestroy() {
    for (const client of this.clients.values()) {
      await client.$disconnect();
    }
    for (const pool of this.pools.values()) {
      await pool.end();
    }
    this.logger.log('Database disconnected (all schemas)');
  }
}
