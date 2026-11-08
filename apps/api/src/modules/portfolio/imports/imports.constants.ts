// PRD IMP-01: "up to configured row/file limits" — no number is given, so
// these are placeholders until real tenant-level configuration exists
// (ADM-07 territory). Chosen well under the 10k-row/10-minute benchmark
// §9.4 names as the eventual performance target.
export const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_IMPORT_ROWS = 1000;

export const ALLOWED_IMPORT_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];

/**
 * The fields a CSV column can be mapped to. `legalName` is the only one
 * required to reach a CREATE disposition — every other field mirrors an
 * optional field on Partner/Partnership. `program` isn't here because
 * Program isn't modeled yet (see docs/DECISIONS.md).
 */
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
