import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI 配置（migrate / generate）。
 * `DIRECT_URL`：Neon 直连或本地 Postgres，供 migrate；运行时连接仍由 schema.prisma + DATABASE_URL 驱动。
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
