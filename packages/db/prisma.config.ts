import { defineConfig, env } from 'prisma/config';

// Prisma 7 config: connection details for `prisma migrate`/`studio` live
// here now, not in schema.prisma's datasource block. The runtime
// PrismaClient gets its own connection via a driver adapter — see src/index.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
