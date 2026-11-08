'use client';

import { apiFetch } from '../api/client';
import type { AuditEvent, AuditEventFilters } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function filterQuery(filters: AuditEventFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function listAuditEvents(tenantId: string, filters: AuditEventFilters) {
  const query = filterQuery(filters);
  return apiFetch<{ events: AuditEvent[]; nextCursor: string | null }>(
    `/tenants/${tenantId}/audit-events${query ? `?${query}` : ''}`,
  );
}

/** AUD-03 / RPT-02 — the same filters the search above applies, so the export always matches the current view. */
export function auditExportUrl(tenantId: string, filters: AuditEventFilters): string {
  const query = filterQuery(filters);
  return `${API_URL}/tenants/${tenantId}/audit-events/export.csv${query ? `?${query}` : ''}`;
}
