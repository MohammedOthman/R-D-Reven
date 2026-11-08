import type { EvidenceClassification } from '../contributions/types';

export type { EvidenceClassification };

export interface Evidence {
  id: string;
  contributionId: string | null;
  outcomeId: string | null;
  source: string;
  storageKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  observedAt: string;
  classification: EvidenceClassification;
  replacesEvidenceId: string | null;
  version: number;
  createdAt: string;
  createdById: string;
}
