import { apiGet } from '../../shared/utils/apiClient';

const BASE = '/api/v1/sources';

export function listSources() {
  return apiGet(BASE);
}

export function getSourceDetail(key) {
  return apiGet(`${BASE}/${key}`);
}
