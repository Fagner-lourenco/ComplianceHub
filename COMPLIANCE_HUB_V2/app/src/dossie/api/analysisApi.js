import { apiPost, apiPatch } from '../../shared/utils/apiClient';

const BASE = '/api/v1/analysis';

export function createAnalysisComment(caseId, text) {
  return apiPost(`${BASE}/${caseId}/comments`, { text });
}

export function updateAnalysis(caseId, payload) {
  return apiPatch(`${BASE}/${caseId}`, payload);
}

export function approveAnalysis(caseId) {
  return apiPost(`${BASE}/${caseId}/approve`);
}

export function rejectAnalysis(caseId, reason) {
  return apiPost(`${BASE}/${caseId}/reject`, { reason });
}
