import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma, prisma, type ImportBatch, type ImportRowDisposition } from '@revn/db';
import { parseCsv } from './imports.csv';
import {
  ALLOWED_IMPORT_MIME_TYPES,
  MAX_IMPORT_ROWS,
  type ImportFieldMapping,
  type ImportTargetField,
} from './imports.constants';
import { recordAuditEvent } from '../../audit-operations/audit.service';
import { csvEscape } from '../../../common/csv';

interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

interface EvaluatedRow {
  id: string;
  disposition: ImportRowDisposition;
  matchReason?: string;
  rejectReason?: string;
  matchedPartnerId?: string;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomains(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function fieldGetter(rawData: unknown, mapping: ImportFieldMapping) {
  const data = (rawData ?? {}) as Record<string, string>;
  return (field: ImportTargetField): string | undefined => {
    const column = mapping[field];
    if (!column) return undefined;
    const value = data[column];
    const trimmed = typeof value === 'string' ? value.trim() : undefined;
    return trimmed || undefined;
  };
}

/**
 * PRD IMP-05: "detect exact and probable duplicates with explainable match
 * reasons." Exact = normalized legal name matches an existing partner, or an
 * earlier row already in this same file (a within-batch duplicate is just as
 * real as a cross-batch one). Probable = no name match, but a mapped domain
 * overlaps an existing partner's domains — a real, explainable signal
 * without a fuzzy-matching engine (out of scope; see docs/DECISIONS.md).
 */
function evaluateRows(
  rows: { id: string; rowNumber: number; rawData: unknown }[],
  mapping: ImportFieldMapping,
  existingPartners: { id: string; legalName: string; domains: string[] }[],
): {
  evaluated: EvaluatedRow[];
  counts: Record<ImportRowDisposition, number>;
} {
  const existingByName = new Map(existingPartners.map((p) => [normalizeName(p.legalName), p]));
  const existingByDomain = new Map<string, { id: string; legalName: string }>();
  for (const partner of existingPartners) {
    for (const domain of partner.domains) existingByDomain.set(domain.toLowerCase(), partner);
  }

  const seenInBatch = new Map<string, number>();
  const counts: Record<ImportRowDisposition, number> = {
    PENDING: 0,
    CREATE: 0,
    UPDATE: 0,
    SKIP: 0,
    REJECT: 0,
  };
  const evaluated: EvaluatedRow[] = [];

  for (const row of rows) {
    const get = fieldGetter(row.rawData, mapping);
    const legalName = get('legalName');
    const domains = extractDomains(get('domains'));

    let result: EvaluatedRow;

    if (!legalName) {
      result = { id: row.id, disposition: 'REJECT', rejectReason: 'Legal name is required.' };
    } else if (legalName.length > 200) {
      result = {
        id: row.id,
        disposition: 'REJECT',
        rejectReason: 'Legal name exceeds 200 characters.',
      };
    } else {
      const normalized = normalizeName(legalName);
      const existingMatch = existingByName.get(normalized);
      const duplicateRowNumber = seenInBatch.get(normalized);

      if (existingMatch) {
        result = {
          id: row.id,
          disposition: 'UPDATE',
          matchedPartnerId: existingMatch.id,
          matchReason: `Exact legal name match with an existing partner ("${existingMatch.legalName}").`,
        };
      } else if (duplicateRowNumber !== undefined) {
        result = {
          id: row.id,
          disposition: 'SKIP',
          matchReason: `Duplicate legal name already used by row ${duplicateRowNumber} in this file.`,
        };
      } else {
        const domainMatch = domains.map((d) => existingByDomain.get(d)).find((m) => m);
        if (domainMatch) {
          result = {
            id: row.id,
            disposition: 'SKIP',
            matchedPartnerId: domainMatch.id,
            matchReason: `Domain overlap with an existing partner ("${domainMatch.legalName}").`,
          };
        } else {
          result = { id: row.id, disposition: 'CREATE' };
          seenInBatch.set(normalized, row.rowNumber);
        }
      }
    }

    counts[result.disposition]++;
    evaluated.push(result);
  }

  return { evaluated, counts };
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  list(tenantId: string) {
    return prisma.importBatch.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async get(tenantId: string, batchId: string) {
    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, tenantId },
      include: { rows: { orderBy: { rowNumber: 'asc' } } },
    });
    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }
    return batch;
  }

  private async getBatchOnly(tenantId: string, batchId: string): Promise<ImportBatch> {
    const batch = await prisma.importBatch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) {
      throw new NotFoundException('Import batch not found.');
    }
    return batch;
  }

  async upload(tenantId: string, file: UploadedFile, actingUserId: string) {
    if (!ALLOWED_IMPORT_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException('Only CSV files are accepted.');
    }

    const { headers, rows } = parseCsv(file.buffer);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new UnprocessableEntityException(
        `This file has ${rows.length} rows, over the ${MAX_IMPORT_ROWS}-row limit.`,
      );
    }

    const batch = await prisma.importBatch.create({
      data: {
        tenantId,
        fileName: file.filename,
        rowCount: rows.length,
        columnHeaders: headers,
        createdById: actingUserId,
      },
    });

    await prisma.importRow.createMany({
      data: rows.map((row, index) => ({
        batchId: batch.id,
        tenantId,
        rowNumber: index + 1,
        rawData: row,
      })),
    });

    // PRD-required analytics event (§5.1's event schema).
    this.logger.log(
      `portfolio_import_started batch_id=${batch.id} source=csv row_count=${rows.length} mapping_id=(none)`,
    );

    return this.get(tenantId, batch.id);
  }

  async setMapping(
    tenantId: string,
    batchId: string,
    { version, mapping }: { version: number; mapping: ImportFieldMapping },
  ) {
    const batch = await this.getBatchOnly(tenantId, batchId);
    if (batch.status === 'COMMITTED') {
      throw new ConflictException('This import has already been committed.');
    }
    if (!mapping.legalName) {
      throw new UnprocessableEntityException(
        'Map a source column to Legal name before continuing.',
      );
    }

    const rows = await prisma.importRow.findMany({
      where: { batchId, tenantId },
      orderBy: { rowNumber: 'asc' },
      select: { id: true, rowNumber: true, rawData: true },
    });
    const existingPartners = await prisma.partner.findMany({
      where: { tenantId },
      select: { id: true, legalName: true, domains: true },
    });

    const { evaluated, counts } = evaluateRows(rows, mapping, existingPartners);

    await prisma.$transaction(
      evaluated.map((r) =>
        prisma.importRow.update({
          where: { id: r.id },
          data: {
            disposition: r.disposition,
            matchReason: r.matchReason,
            rejectReason: r.rejectReason,
            matchedPartnerId: r.matchedPartnerId,
          },
        }),
      ),
    );

    try {
      await prisma.importBatch.update({
        where: { id: batchId, tenantId, version },
        data: {
          fieldMapping: mapping as Prisma.InputJsonValue,
          status: 'MAPPED',
          mappedAt: new Date(),
          createdCount: counts.CREATE,
          updatedCount: counts.UPDATE,
          skippedCount: counts.SKIP,
          rejectedCount: counts.REJECT,
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'This import was changed by someone else. Refresh and try again.',
        );
      }
      throw error;
    }

    return this.get(tenantId, batchId);
  }

  async updateRow(
    tenantId: string,
    batchId: string,
    rowId: string,
    forceCreate: boolean,
  ): Promise<void> {
    const batch = await this.getBatchOnly(tenantId, batchId);
    if (batch.status === 'COMMITTED') {
      throw new ConflictException('This import has already been committed.');
    }
    const row = await prisma.importRow.findFirst({ where: { id: rowId, batchId, tenantId } });
    if (!row) {
      throw new NotFoundException('Import row not found.');
    }
    if (row.disposition !== 'SKIP') {
      throw new UnprocessableEntityException('Only a skipped row can be forced.');
    }
    await prisma.importRow.update({ where: { id: rowId }, data: { forceCreate } });
  }

  async commit(tenantId: string, batchId: string, actingUserId: string) {
    const batch = await this.getBatchOnly(tenantId, batchId);

    // T-003: re-committing an already-committed batch returns the existing
    // result rather than reprocessing or erroring — the batch's own
    // COMMITTED state (and each row's `committedPartnerId`) is what makes
    // this endpoint idempotent, not a generic Idempotency-Key cache.
    if (batch.status === 'COMMITTED') {
      return this.get(tenantId, batchId);
    }
    if (batch.status !== 'MAPPED') {
      throw new ConflictException('Set a field mapping and review the preview before committing.');
    }

    const mapping = (batch.fieldMapping ?? {}) as ImportFieldMapping;
    const rows = await prisma.importRow.findMany({
      where: { batchId, tenantId },
      orderBy: { rowNumber: 'asc' },
    });
    const members = await prisma.membership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true } } },
    });
    const memberIdByEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m.user.id]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let rejected = 0;

    for (const row of rows) {
      const willCommit =
        row.disposition === 'CREATE' ||
        row.disposition === 'UPDATE' ||
        (row.disposition === 'SKIP' && row.forceCreate);

      if (!willCommit) {
        if (row.disposition === 'REJECT') rejected++;
        else skipped++;
        continue;
      }

      const get = fieldGetter(row.rawData, mapping);
      const legalName = get('legalName')!;
      const displayName = get('displayName') || legalName;
      const segment = get('segment');
      const domains = extractDomains(get('domains'));
      const motion = get('motion');
      const objective = get('objective');
      const cadence = get('cadence');
      const ownerEmail = get('ownerEmail')?.toLowerCase();
      const sponsorEmail = get('sponsorEmail')?.toLowerCase();
      const ownerId = ownerEmail ? memberIdByEmail.get(ownerEmail) : undefined;
      const sponsorId = sponsorEmail ? memberIdByEmail.get(sponsorEmail) : undefined;

      try {
        if (row.disposition === 'UPDATE' && row.matchedPartnerId) {
          const partner = await prisma.partner.update({
            where: { id: row.matchedPartnerId, tenantId },
            data: {
              displayName,
              segment,
              domains,
              updatedById: actingUserId,
              version: { increment: 1 },
            },
          });
          await prisma.importRow.update({
            where: { id: row.id },
            data: { committedPartnerId: partner.id, committedAt: new Date() },
          });
          updated++;
        } else {
          const result = await prisma.$transaction(async (tx) => {
            const partner = await tx.partner.create({
              data: {
                tenantId,
                legalName,
                displayName,
                segment,
                domains,
                createdById: actingUserId,
                updatedById: actingUserId,
              },
            });
            const partnership = await tx.partnership.create({
              data: {
                tenantId,
                partnerId: partner.id,
                motion,
                objective,
                cadence,
                ownerId,
                sponsorId,
                createdById: actingUserId,
                updatedById: actingUserId,
              },
            });
            return { partner, partnership };
          });
          await prisma.importRow.update({
            where: { id: row.id },
            data: {
              committedPartnerId: result.partner.id,
              committedPartnershipId: result.partnership.id,
              committedAt: new Date(),
            },
          });
          created++;
          // PRD-required analytics event, same shape as the manual-create path.
          this.logger.log(
            `partnership_created relationship_id=${result.partnership.id} source=csv owner=${ownerId ?? '(none)'} motion=${motion ?? '(none)'}`,
          );
          await recordAuditEvent(tenantId, {
            actorId: actingUserId,
            action: 'partnership_created',
            objectType: 'Partnership',
            objectId: result.partnership.id,
            after: result.partnership,
          });
        }
      } catch {
        // FLOW-A explicitly allows partial commit — a row that validated
        // cleanly at preview time but fails here (e.g. another row in the
        // same batch just took the same legal name) doesn't fail the whole
        // batch; it's recorded as rejected instead.
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            disposition: 'REJECT',
            rejectReason: 'Failed during commit — likely a duplicate created since preview.',
          },
        });
        rejected++;
      }
    }

    const committedBatch = await prisma.importBatch.update({
      where: { id: batchId, tenantId },
      data: {
        status: 'COMMITTED',
        committedAt: new Date(),
        committedById: actingUserId,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        rejectedCount: rejected,
      },
    });

    this.logger.log(
      `portfolio_import_completed batch_id=${batchId} created=${created} updated=${updated} skipped=${skipped} rejected=${rejected}`,
    );
    await recordAuditEvent(tenantId, {
      actorId: actingUserId,
      action: 'import_batch_committed',
      objectType: 'ImportBatch',
      objectId: batchId,
      after: committedBatch,
    });

    return this.get(tenantId, batchId);
  }

  async rejectedCsv(tenantId: string, batchId: string): Promise<{ fileName: string; csv: string }> {
    const batch = await this.get(tenantId, batchId);
    const rejectedRows = batch.rows.filter((r) => r.disposition === 'REJECT');

    const headers = ['rowNumber', 'reason', ...batch.columnHeaders];
    const lines = [headers.map(csvEscape).join(',')];
    for (const row of rejectedRows) {
      const raw = (row.rawData ?? {}) as Record<string, string>;
      const line = [
        String(row.rowNumber),
        row.rejectReason ?? '',
        ...batch.columnHeaders.map((h) => raw[h] ?? ''),
      ];
      lines.push(line.map(csvEscape).join(','));
    }

    return {
      fileName: `${batch.fileName.replace(/\.csv$/i, '')}-rejected.csv`,
      csv: lines.join('\n'),
    };
  }
}
