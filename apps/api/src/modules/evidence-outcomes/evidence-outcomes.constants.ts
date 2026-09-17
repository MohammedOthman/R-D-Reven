import { join } from 'node:path';

// EVD-02's "malware, type and access checks pass" acceptance gate: no
// AV/malware-scanning service is integrated anywhere in this codebase (same
// category of infra gap as "no transactional email provider" — see
// docs/DECISIONS.md), so this phase enforces type and size checks only.
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

// "Files live in object storage. Database records hold metadata,
// classification, checksum and storage pointer—not binary content." — no
// object storage integration exists yet in this codebase; local disk is the
// dev/MVP stand-in, the same proportionate substitution local Postgres is
// for a managed database. See docs/DECISIONS.md.
export const EVIDENCE_STORAGE_ROOT = join(process.cwd(), 'var', 'evidence-storage');
