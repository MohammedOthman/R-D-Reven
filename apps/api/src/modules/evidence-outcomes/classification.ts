import type { EvidenceClassification } from '@revn/db';

// Shared between Contribution and Evidence DTOs — see schema.prisma's
// EvidenceClassification comment for why this reuses REV-04's
// internal/shareable pair rather than inventing an unnamed third tier.
export const EVIDENCE_CLASSIFICATIONS = ['INTERNAL', 'SHAREABLE'] as const;
export type EvidenceClassificationValue = EvidenceClassification;
