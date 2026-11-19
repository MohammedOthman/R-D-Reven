import { ConflictException, Injectable } from '@nestjs/common';
import { prisma } from '@revn/db';
import { normalizeDomain } from '../../../common/domain';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateAccountInput {
  name: string;
  domain?: string;
  headcount?: number;
  hqCity?: string;
  hqCountry?: string;
  parentName?: string;
  technologies?: string[];
  keywords?: string[];
  industryCodes?: string[];
  lists?: string[];
}

/**
 * Account is the ecosystem's source-of-truth company record. The derived
 * similarity graph lives in `intelligence/ecosystem-graph`; this service only
 * owns the tenant's data. New accounts are connected on the graph's next read
 * (or by an explicit rebuild), so this module never needs to call into the
 * read model.
 */
@Injectable()
export class AccountsService {
  async create(tenantId: string, input: CreateAccountInput, actingUserId: string) {
    const normalizedDomain = normalizeDomain(input.domain);
    if (normalizedDomain) {
      const duplicate = await prisma.account.findFirst({
        where: { tenantId, normalizedDomain },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('An account with this domain already exists.');
      }
    }

    const account = await prisma.account.create({
      data: {
        tenantId,
        name: input.name.trim(),
        normalizedDomain,
        domains: normalizedDomain ? [normalizedDomain] : [],
        headcount: input.headcount ?? null,
        hqCity: input.hqCity?.trim() || null,
        hqCountry: input.hqCountry?.trim() || null,
        parentName: input.parentName?.trim() || null,
        technologies: input.technologies ?? [],
        keywords: input.keywords ?? [],
        industryCodes: input.industryCodes ?? [],
        lists: input.lists ?? [],
        source: 'MANUAL',
        status: 'ACTIVE',
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });

    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'account_created',
      objectType: 'Account',
      objectId: account.id,
      after: account,
    });

    return account;
  }
}
