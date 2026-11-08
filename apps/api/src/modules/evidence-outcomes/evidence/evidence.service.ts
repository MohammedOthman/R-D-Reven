import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { prisma, type Evidence } from '@revn/db';
import { ALLOWED_EVIDENCE_MIME_TYPES } from '../evidence-outcomes.constants';
import { recordAuditEvent } from '../../audit-operations/audit.service';

export interface CreateEvidenceInput {
  contributionId?: string;
  outcomeId?: string;
  source: string;
  observedAt: string;
  classification?: 'INTERNAL' | 'SHAREABLE';
}

export interface ReplaceEvidenceInput {
  source: string;
  observedAt: string;
  classification?: 'INTERNAL' | 'SHAREABLE';
}

export interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class EvidenceService {
  private async assertLinksExist(
    tenantId: string,
    { contributionId, outcomeId }: { contributionId?: string; outcomeId?: string },
  ): Promise<void> {
    if (contributionId) {
      const contribution = await prisma.contribution.findFirst({
        where: { id: contributionId, tenantId },
        select: { id: true },
      });
      if (!contribution) throw new NotFoundException('Contribution not found.');
    }
    if (outcomeId) {
      const outcome = await prisma.outcome.findFirst({
        where: { id: outcomeId, tenantId },
        select: { id: true },
      });
      if (!outcome) throw new NotFoundException('Outcome not found.');
    }
  }

  list(
    tenantId: string,
    filters: { contributionId?: string; outcomeId?: string },
  ): Promise<Evidence[]> {
    return prisma.evidence.findMany({
      where: { tenantId, ...filters },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, evidenceId: string): Promise<Evidence> {
    const evidence = await prisma.evidence.findFirst({ where: { id: evidenceId, tenantId } });
    if (!evidence) {
      throw new NotFoundException('Evidence not found.');
    }
    return evidence;
  }

  async create(
    tenantId: string,
    input: CreateEvidenceInput,
    actingUserId: string,
  ): Promise<Evidence> {
    // EVD-02/INV-003: evidence proves a contribution's claim, or backs an
    // outcome's verification directly — at least one link is required.
    if (!input.contributionId && !input.outcomeId) {
      throw new UnprocessableEntityException(
        'Evidence needs to link to a contribution or an outcome.',
      );
    }
    await this.assertLinksExist(tenantId, input);

    const evidence = await prisma.evidence.create({
      data: {
        tenantId,
        contributionId: input.contributionId,
        outcomeId: input.outcomeId,
        source: input.source,
        observedAt: new Date(input.observedAt),
        classification: input.classification ?? 'INTERNAL',
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'evidence_created',
      objectType: 'Evidence',
      objectId: evidence.id,
      after: evidence,
    });
    return evidence;
  }

  /**
   * EVD-02's "upload" path. A separate step from `create` (rather than one
   * multipart request mixing JSON fields and a file) — see docs/DECISIONS.md.
   * Only allowed once per evidence row — EVD-04 requires a *new* version
   * (via `replace`) rather than overwriting an attached file.
   */
  async attachFile(
    tenantId: string,
    evidenceId: string,
    file: UploadedFile,
    actingUserId: string,
  ): Promise<Evidence> {
    const evidence = await this.get(tenantId, evidenceId);
    if (evidence.storageKey) {
      throw new UnprocessableEntityException(
        'This evidence already has a file — replace it to attach a new one instead.',
      );
    }
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `${evidenceId}-${Date.now()}`;

    // One transaction: the bytes and the pointer to them land together, so
    // an Evidence row never names a storageKey with no file behind it.
    const [, updated] = await prisma.$transaction([
      prisma.evidenceFile.create({
        data: { storageKey, tenantId, content: new Uint8Array(file.buffer) },
      }),
      prisma.evidence.update({
        where: { id: evidenceId, tenantId },
        data: {
          storageKey,
          fileName: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.buffer.byteLength,
          checksum,
          updatedById: actingUserId,
          version: { increment: 1 },
        },
      }),
    ]);
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'evidence_file_uploaded',
      objectType: 'Evidence',
      objectId: updated.id,
      before: evidence,
      after: updated,
    });
    return updated;
  }

  /** EVD-04: create a new evidence version pointing back at the one it replaces — never overwrites. */
  async replace(
    tenantId: string,
    evidenceId: string,
    input: ReplaceEvidenceInput,
    actingUserId: string,
  ): Promise<Evidence> {
    const previous = await this.get(tenantId, evidenceId);
    const existingReplacement = await prisma.evidence.findUnique({
      where: { replacesEvidenceId: previous.id },
      select: { id: true },
    });
    if (existingReplacement) {
      throw new UnprocessableEntityException('This evidence has already been replaced.');
    }

    const replacement = await prisma.evidence.create({
      data: {
        tenantId,
        contributionId: previous.contributionId,
        outcomeId: previous.outcomeId,
        source: input.source,
        observedAt: new Date(input.observedAt),
        classification: input.classification ?? previous.classification,
        replacesEvidenceId: previous.id,
        createdById: actingUserId,
        updatedById: actingUserId,
      },
    });
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'evidence_replaced',
      objectType: 'Evidence',
      objectId: replacement.id,
      before: previous,
      after: replacement,
    });
    return replacement;
  }
}
