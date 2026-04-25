import { apiGet, apiPost, apiPatch } from '../../shared/utils/apiClient';

const BASE = '/api/v1/dossiers';

export function listDossiers(query = {}) {
  return apiGet(BASE, query);
}

export function getDossier(id) {
  return apiGet(`${BASE}/${id}`);
}

export function createDossier(payload) {
  return apiPost(BASE, payload);
}

export function patchDossier(id, payload) {
  return apiPatch(`${BASE}/${id}`, payload);
}

export function processDossier(id) {
  return apiPost(`${BASE}/${id}/process`);
}

export function retrySource(id, sourceKey) {
  return apiPost(`${BASE}/${id}/retry-source`, { sourceKey });
}

export function createComment(id, text, highlighted = false) {
  return apiPost(`${BASE}/${id}/comments`, { text, highlighted });
}

export function approveDossier(id) {
  return apiPost(`${BASE}/${id}/approve`);
}

export function rejectDossier(id, reason) {
  return apiPost(`${BASE}/${id}/reject`, { reason });
}
