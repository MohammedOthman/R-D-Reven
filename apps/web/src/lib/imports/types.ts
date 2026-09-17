export type ImportBatchStatus = 'UPLOADED' | 'MAPPED' | 'COMMITTED';

export type ImportRowDisposition = 'PENDING' | 'CREATE' | 'UPDATE' | 'SKIP' | 'REJECT';

/** One property per target field in `apps/api/.../imports/imports.constants.ts` — kept in sync by hand. */
export const IMPORT_TARGET_FIELDS = [
  'legalName',
  'displayName',
  'segment',
  'domains',
  'motion',
  'objective',
  'cadence',
  'ownerEmail',
  'sponsorEmail',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export type ImportFieldMapping = Partial<Record<ImportTargetField, string>>;

export interface ImportRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  disposition: ImportRowDisposition;
  matchReason: string | null;
  rejectReason: string | null;
  matchedPartnerId: string | null;
  forceCreate: boolean;
  committedPartnerId: string | null;
  committedPartnershipId: string | null;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  rowCount: number;
  columnHeaders: string[];
  fieldMapping: ImportFieldMapping | null;
  status: ImportBatchStatus;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  version: number;
  createdAt: string;
  committedAt: string | null;
  rows: ImportRow[];
}
