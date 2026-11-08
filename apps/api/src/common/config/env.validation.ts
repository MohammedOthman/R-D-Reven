import { z } from 'zod';

const envSchema = z
  .object({
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
    // Pilot mode: "true" only on the separate pilot app, which has its own
    // database. Visitors without a session are signed in as one shared
    // pilot Owner (see PilotService). Never set this on production.
    PILOT_AUTO_LOGIN: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    // Transactional email (password reset, invitations). All three set: the
    // API POSTs { from, to, subject, html, text } to MAIL_API_URL with
    // "Authorization: Bearer MAIL_API_KEY" (Resend's /emails API takes this
    // exact body; CranL's send_email uses the same fields). All three unset:
    // links are only logged, for local dev.
    MAIL_API_URL: z.string().url().optional(),
    MAIL_API_KEY: z.string().min(1).optional(),
    // A sender on a verified domain, e.g. "Reven <no-reply@reven.sa>".
    MAIL_FROM: z.string().min(3).optional(),
  })
  .superRefine((env, ctx) => {
    const set = [env.MAIL_API_URL, env.MAIL_API_KEY, env.MAIL_FROM].filter(Boolean).length;
    if (set !== 0 && set !== 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_API_URL'],
        message: 'Set MAIL_API_URL, MAIL_API_KEY and MAIL_FROM together, or none of them.',
      });
    }
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
