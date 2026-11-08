import { Injectable, Logger } from '@nestjs/common';

/**
 * Placeholder — logs instead of sending. No transactional email provider
 * (Resend, SES, Postmark, ...) has been chosen yet; that's a real decision
 * with cost and deliverability implications outside this feature's scope.
 * See docs/DECISIONS.md. Swap this implementation for a real provider
 * before any password-reset or invitation flow reaches a production user —
 * until then, those links only ever reach the server log.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  sendPasswordResetEmail(to: string, resetUrl: string): void {
    this.logger.warn(
      `[MailerService placeholder] Password reset requested for ${to}. ` +
        `No email provider is configured — link (dev only): ${resetUrl}`,
    );
  }

  sendInvitationEmail(to: string, acceptUrl: string): void {
    this.logger.warn(
      `[MailerService placeholder] Invitation sent to ${to}. ` +
        `No email provider is configured — link (dev only): ${acceptUrl}`,
    );
  }
}
