import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { prisma, type User } from '@revn/db';
import { generateOpaqueToken } from '../../../common/opaque-token';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { AuthService, type IssuedTokens } from './auth.service';

export const PILOT_USER_EMAIL = 'pilot@reven.pilot';
export const PILOT_TENANT_SLUG = 'reven-pilot';

/**
 * Pilot mode (PILOT_AUTO_LOGIN=true, set only on the pilot app): every
 * visitor without a session is signed in as one shared Owner of one shared
 * "Reven Pilot" organization, so people can try the product without an
 * account. The pilot app runs on its own database, so nothing entered there
 * reaches production.
 *
 * Every step is an idempotent upsert, so the first visitors after a fresh
 * deploy can arrive at once without creating duplicates. The pilot user's
 * password is random and never shown: the account exists only behind this
 * endpoint.
 */
@Injectable()
export class PilotService {
  constructor(private readonly authService: AuthService) {}

  async startPilotSession(): Promise<{ user: User; tokens: IssuedTokens }> {
    const user =
      (await prisma.user.findUnique({ where: { email: PILOT_USER_EMAIL } })) ??
      (await prisma.user.upsert({
        where: { email: PILOT_USER_EMAIL },
        update: {},
        create: {
          email: PILOT_USER_EMAIL,
          name: 'Pilot User',
          passwordHash: await argon2.hash(generateOpaqueToken()),
        },
      }));

    const tenant = await prisma.tenant.upsert({
      where: { slug: PILOT_TENANT_SLUG },
      update: {},
      create: { name: 'Reven Pilot', slug: PILOT_TENANT_SLUG },
    });

    const existingMembership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    if (!existingMembership) {
      await prisma.membership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: {},
        create: { tenantId: tenant.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' },
      });
      await recordAuditEvent(tenant.id, {
        actorId: user.id,
        action: 'tenant_created',
        objectType: 'Tenant',
        objectId: tenant.id,
        after: tenant,
      });
    }

    const tokens = await this.authService.startSession(user);
    return { user, tokens };
  }
}
