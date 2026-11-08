import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  // Signs access-token JWTs. Refresh tokens are opaque random values hashed
  // into the database, not JWTs, so they need no secret of their own.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters.'),
  // Shared across subdomains in production (e.g. ".reven.com") so the
  // auth cookies set by the API are sent back by the browser on requests to
  // the web app's own domain. Left unset in development (host-only cookie —
  // fine since both apps are on localhost).
  COOKIE_DOMAIN: z.string().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

/** Passed to ConfigModule.forRoot({ validate }) — fails fast on a missing/malformed env var. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return result.data;
}
