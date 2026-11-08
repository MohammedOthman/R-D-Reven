import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../common/config/env.validation';

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const SEND_TIMEOUT_MS = 10_000;

/**
 * Sends password-reset and invitation emails through an HTTP email API:
 * POST { from, to, subject, html, text } with a Bearer key (Resend's
 * /emails API takes this exact body; CranL's send_email uses the same
 * fields). Configured by MAIL_API_URL, MAIL_API_KEY and MAIL_FROM — see
 * env.validation.ts.
 *
 * Callers never wait on delivery: both methods return immediately and send
 * in the background, so a slow or failing provider cannot delay a request,
 * and a password-reset response takes the same time whether or not the
 * address has an account. Failures are logged without the link, which
 * carries a live single-use token.
 *
 * With nothing configured (local dev), the link is logged instead.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  sendPasswordResetEmail(to: string, resetUrl: string): void {
    this.dispatch(
      {
        to,
        subject: 'Reset your Reven password',
        text:
          `Someone asked to reset the password for your Reven account.\n\n` +
          `Open this link to choose a new password:\n${resetUrl}\n\n` +
          `If you didn't ask for this, ignore this email; your password stays the same.`,
        html: layout(
          'Reset your password',
          `<p>Someone asked to reset the password for your Reven account.</p>` +
            button(resetUrl, 'Choose a new password') +
            `<p>If you didn't ask for this, ignore this email; your password stays the same.</p>`,
        ),
      },
      `Password reset requested for ${to}`,
      resetUrl,
    );
  }

  sendInvitationEmail(to: string, acceptUrl: string): void {
    this.dispatch(
      {
        to,
        subject: "You're invited to Reven",
        text:
          `You've been invited to join an organization on Reven.\n\n` +
          `Open this link to accept:\n${acceptUrl}`,
        html: layout(
          "You're invited",
          `<p>You've been invited to join an organization on Reven.</p>` +
            button(acceptUrl, 'Accept invitation'),
        ),
      },
      `Invitation sent to ${to}`,
      acceptUrl,
    );
  }

  private dispatch(email: OutgoingEmail, description: string, link: string): void {
    const url = this.config.get('MAIL_API_URL', { infer: true });
    const key = this.config.get('MAIL_API_KEY', { infer: true });
    const from = this.config.get('MAIL_FROM', { infer: true });

    if (!url || !key || !from) {
      this.logger.warn(`${description}. No email provider configured; link (dev only): ${link}`);
      return;
    }

    void this.post(url, key, { from, ...email }).then(
      () => this.logger.log(`${description}: email accepted by provider`),
      (error: unknown) =>
        this.logger.error(
          `${description}: email NOT sent (${error instanceof Error ? error.message : String(error)})`,
        ),
    );
  }

  private async post(url: string, key: string, body: OutgoingEmail & { from: string }) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`provider answered ${res.status}${detail ? `: ${detail}` : ''}`);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function button(href: string, label: string): string {
  return (
    `<p style="margin:24px 0"><a href="${escapeHtml(href)}" ` +
    `style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:6px;` +
    `text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>` +
    `<p style="color:#6b7280;font-size:13px">Or paste this link into your browser:<br>` +
    `${escapeHtml(href)}</p>`
  );
}

function layout(title: string, body: string): string {
  return (
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111827;` +
    `max-width:520px;margin:0 auto;padding:24px">` +
    `<h1 style="font-size:20px">${escapeHtml(title)}</h1>${body}</body></html>`
  );
}
