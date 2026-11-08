'use client';

import { apiFetch, apiUpload } from '../api/client';
import type { ImportBatch, ImportFieldMapping } from './types';

export function uploadImportFile(tenantId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ batch: ImportBatch }>(`/tenants/${tenantId}/imports`, formData);
}

export function setImportMapping(
  tenantId: string,
  batchId: string,
  input: { version: number; mapping: ImportFieldMapping },
) {
  return apiFetch<{ batch: ImportBatch }>(`/tenants/${tenantId}/imports/${batchId}/mapping`, {
    method: 'PATCH',
    body: input,
  });
}

export function updateImportRow(
  tenantId: string,
  batchId: string,
  rowId: string,
  forceCreate: boolean,
) {
  return apiFetch<{ batch: ImportBatch }>(`/tenants/${tenantId}/imports/${batchId}/rows/${rowId}`, {
    method: 'PATCH',
    body: { forceCreate },
  });
}

export function commitImport(tenantId: string, batchId: string) {
  return apiFetch<{ batch: ImportBatch }>(`/tenants/${tenantId}/imports/${batchId}/commit`, {
    method: 'POST',
  });
}
