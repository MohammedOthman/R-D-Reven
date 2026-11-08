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

// Material file bytes live in the evidence_files table (see the
// EvidenceFile model in packages/db/prisma/schema.prisma), not on the API
// container's disk, which is replaced on every deploy.
