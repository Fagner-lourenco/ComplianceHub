import { apiGet, apiPost, apiDelete } from '../../shared/utils/apiClient';

const BASE = '/api/v1/profiles';

export function listProfiles() {
  return apiGet(BASE);
}

export function createProfile(payload) {
  return apiPost(BASE, payload);
}

export function deleteProfile(id) {
  return apiDelete(`${BASE}/${id}`);
}
