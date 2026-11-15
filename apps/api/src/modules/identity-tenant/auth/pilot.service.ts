import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { prisma, type User } from '@revn/db';
import { generateOpaqueToken } from '../../../common/opaque-token';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { AuthService, type IssuedTokens } from './auth.service';

export const PILOT_USER_EMAIL = 'pilot@reven.pilot';
export const PILOT_TENANT_SLUG = 'reven-pilot';
export const PILOT_PERSONAS = {
  OWNER: { email: PILOT_USER_EMAIL, name: 'Pilot Owner' },
  EXECUTIVE: { email: 'executive@reven.pilot', name: 'Pilot Executive' },
  REVIEWER: { email: 'reviewer@reven.pilot', name: 'Pilot Reviewer' },
} as const;
export type PilotRole = keyof typeof PILOT_PERSONAS;

/**
 * Pilot mode (PILOT_AUTO_LOGIN=true, set only on the pilot app): every
 * visitor without a session is signed in as one shared Owner of one shared
 * "Reven Pilot" organization, so people can try the product without an
 * account. The pilot app runs on its own database, so nothing entered there
 * reaches production. Testers can switch to shared Executive and Reviewer
 * personas to exercise approvals without bypassing separation of duties.
 *
 * Every step is an idempotent upsert, so the first visitors after a fresh
 * deploy can arrive at once without creating duplicates. The pilot user's
 * password is random and never shown: the account exists only behind this
 * endpoint.
 */
@Injectable()
export class PilotService {
  constructor(private readonly authService: AuthService) {}

  async startPilotSession(
    role: PilotRole = 'OWNER',
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const tenant = await prisma.tenant.upsert({
      where: { slug: PILOT_TENANT_SLUG },
      update: {},
      create: { name: 'Reven Pilot', slug: PILOT_TENANT_SLUG },
    });

    // Create the whole pilot team before returning, so the Owner can assign
    // a Reviewer on their first outcome. Passwords never leave the API.
    let selectedUser: User | undefined;
    for (const personaRole of Object.keys(PILOT_PERSONAS) as PilotRole[]) {
      const persona = PILOT_PERSONAS[personaRole];
      const user =
        (await prisma.user.findUnique({ where: { email: persona.email } })) ??
        (await prisma.user.upsert({
          where: { email: persona.email },
          update: {},
          create: { ...persona, passwordHash: await argon2.hash(generateOpaqueToken()) },
        }));
      const key = { tenantId_userId: { tenantId: tenant.id, userId: user.id } };
      const existingMembership = await prisma.membership.findUnique({ where: key });
      const membership =
        existingMembership ??
        (await prisma.membership.upsert({
          where: key,
          update: {},
          create: { tenantId: tenant.id, userId: user.id, role: personaRole, status: 'ACTIVE' },
        }));
      if (!existingMembership && personaRole === 'OWNER') {
        await recordAuditEvent(tenant.id, {
          actorId: user.id,
          action: 'tenant_created',
          objectType: 'Tenant',
          objectId: tenant.id,
          after: tenant,
        });
      }
      if (personaRole === role) {
        if (
          user.status !== 'ACTIVE' ||
          membership.status !== 'ACTIVE' ||
          membership.role !== role
        ) {
          throw new UnauthorizedException('This pilot persona is unavailable.');
        }
        selectedUser = user;
      }
    }
    if (!selectedUser) throw new UnauthorizedException('This pilot persona is unavailable.');
    const tokens = await this.authService.startSession(selectedUser);
    return { user: selectedUser, tokens };
  }
}
