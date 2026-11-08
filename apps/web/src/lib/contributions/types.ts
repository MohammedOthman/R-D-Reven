import type { Evidence } from '../evidence/types';

export type EvidenceClassification = 'INTERNAL' | 'SHAREABLE';

export interface Contribution {
  id: string;
  partnershipId: string | null;
  initiativeId: string | null;
  actionId: string | null;
  outcomeId: string | null;
  type: string;
  actorId: string;
  observedAt: string;
  narrative: string;
  classification: EvidenceClassification;
  version: number;
  createdAt: string;
  createdById: string;
  evidence?: Evidence[];
}
