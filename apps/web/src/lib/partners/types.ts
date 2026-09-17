export type PartnerStatus = 'ACTIVE' | 'ARCHIVED';

export interface Partner {
  id: string;
  legalName: string;
  displayName: string;
  identifiers: Record<string, string> | null;
  segment: string | null;
  domains: string[];
  status: PartnerStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
