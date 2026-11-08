import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { MailerService } from '../src/modules/identity-tenant/mail/mailer.service';
import { validateEnv } from '../src/common/config/env.validation';

const MAIL = {
  MAIL_API_URL: 'https://mail.example.test/v1/emails',
  MAIL_API_KEY: 'test-key',
  MAIL_FROM: 'Reven <no-reply@example.test>',
};

function mailer(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] };
  return new MailerService(config as never);
}

// The send runs in the background; let its promise chain settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MailerService', () => {
  const fetchMock = vi.fn();
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs the link and sends nothing when no provider is configured', () => {
    mailer({}).sendPasswordResetEmail('a@example.test', 'https://app/reset?token=t1');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('https://app/reset?token=t1'));
  });

  it('posts from/to/subject/html/text with a Bearer key when configured', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    mailer(MAIL).sendInvitationEmail('b@example.test', 'https://app/accept-invite?token=t2');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(MAIL.MAIL_API_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-key' });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: MAIL.MAIL_FROM,
      to: 'b@example.test',
      subject: "You're invited to Reven",
    });
    expect(body.text).toContain('https://app/accept-invite?token=t2');
    expect(body.html).toContain('https://app/accept-invite?token=t2');
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a provider rejection without the token-bearing link and without throwing', async () => {
    fetchMock.mockResolvedValue(new Response('domain not verified', { status: 403 }));

    expect(() =>
      mailer(MAIL).sendPasswordResetEmail('c@example.test', 'https://app/reset?token=secret'),
    ).not.toThrow();
    await settle();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('403: domain not verified'));
    expect(String(error.mock.calls[0][0])).not.toContain('token=secret');
  });

  it('logs a network failure without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    mailer(MAIL).sendPasswordResetEmail('d@example.test', 'https://app/reset?token=t4');
    await settle();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });
});

describe('validateEnv mail settings', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'x'.repeat(40),
  };

  it('accepts all three mail settings or none', () => {
    expect(() => validateEnv(base)).not.toThrow();
    expect(validateEnv({ ...base, ...MAIL }).MAIL_FROM).toBe(MAIL.MAIL_FROM);
  });

  it('rejects a partial mail configuration', () => {
    expect(() => validateEnv({ ...base, MAIL_API_URL: MAIL.MAIL_API_URL })).toThrow(
      /MAIL_API_URL, MAIL_API_KEY and MAIL_FROM together/,
    );
  });
});
