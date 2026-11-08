export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string;
  before: unknown;
  after: unknown;
  correlationId: string;
  createdAt: string;
}

export interface AuditEventFilters {
  objectType?: string;
  objectId?: string;
  actorId?: string;
  action?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  cursor?: string;
}
