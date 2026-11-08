import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

/**
 * Singleton Prisma client, created lazily on first use rather than at import
 * time. `@revn/db` may be imported before the consuming app has loaded its
 * environment (e.g. NestJS's ConfigModule runs during app bootstrap, which
 * happens after every module's imports have already resolved) — so reading
 * DATABASE_URL at import time would fail. Deferring construction to first
 * access guarantees env loading has already happened by then.
 *
 * Prisma 7 also requires an explicit driver adapter for the runtime client
 * (the schema's datasource no longer carries a `url` — see
 * prisma.config.ts for where Migrate/Studio get theirs).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let cachedClient: PrismaClient | undefined;

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  return new PrismaClient({
    adapter: new PrismaPg(connectionString),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getClient(): PrismaClient {
  // In development, stash the client on `globalThis` so a hot reload reuses
  // the same instance instead of opening a fresh pool on every file save.
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma ??= createClient();
    return globalForPrisma.prisma;
  }
  cachedClient ??= createClient();
  return cachedClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// `Prisma` is exported as a value (not just `export type *`, which would
// erase it) because consumers need it at runtime — e.g. `instanceof
// Prisma.PrismaClientKnownRequestError` to tell a real constraint violation
// (unique, version-mismatch "record not found") apart from any other error.
export { PrismaClient, Prisma } from '../generated/client/index.js';
export type * from '../generated/client/index.js';
