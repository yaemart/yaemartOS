/**
 * Type for the tenant-scoped Prisma client.
 *
 * The generated PrismaClient covers only `schema.prisma` (public schema) models.
 * Tenant-specific models (ticket, ticketMessage, chatSession, chatMessage, customer, …)
 * are defined in `prisma/tenant.schema.prisma` which is applied at runtime by pointing
 * the Prisma adapter at a per-tenant schema via `buildSchemaConnectionString`.
 *
 * Pending: add a dedicated `prisma generate` target for tenant.schema.prisma that emits a
 * typed TenantPrismaClient (tracked as tech-debt). Until then, `unknown` would be too
 * restrictive for day-to-day use, so we accept `any` here in a single, documented place.
 *
 * @see apps/api/src/database/prisma.service.ts — PrismaClientManager.getTenantClient()
 * @see apps/api/prisma/tenant.schema.prisma — canonical model definitions
 */

export type TenantPrismaClient = any;
