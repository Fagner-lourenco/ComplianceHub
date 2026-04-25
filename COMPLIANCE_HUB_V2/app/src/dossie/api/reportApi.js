import { apiGet, apiPost } from '../../shared/utils/apiClient';

const BASE = '/api/v1/reports';

export function registerExport(caseId, format = 'pdf') {
  return apiPost(`${BASE}/export`, { caseId, format });
}

export function createPublicReport(caseId) {
  return apiPost(`${BASE}/public`, { caseId });
}

export function listPublicReports(query = {}) {
  return apiGet(`${BASE}/public`, query);
}

export function revokePublicReport(id) {
  return apiPost(`${BASE}/public/${id}/revoke`);
}
