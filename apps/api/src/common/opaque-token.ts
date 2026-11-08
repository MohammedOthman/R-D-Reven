import { randomBytes, createHash } from 'node:crypto';

/**
 * Every bearer token this app hands out that isn't a JWT (refresh tokens,
 * password-reset tokens, invitation tokens) follows the same rule: only the
 * SHA-256 hash is ever persisted or logged — the raw value exists solely in
 * the URL/cookie the recipient holds.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
