import { auth } from '../../core/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getMockResponse } from './apiMock';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

class ApiError extends Error {
  constructor(message, status, code, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** Wait for Firebase Auth to resolve its initial state (restored from IndexedDB). */
function waitForAuthState(timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
    setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, timeoutMs);
  });
}

async function getIdToken() {
  const user = await waitForAuthState();
  if (!user) return null;
  try {
    return await user.getIdToken(false); // false = use cached token if not expired
  } catch {
    return null;
  }
}

function buildUrl(path, query = {}) {
  const base = API_BASE_URL || '';
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // When base URL points to the deployed API gateway, strip the /api/v1 prefix
  // so that /api/v1/dossiers becomes /dossiers at the gateway root.
  if (base && cleanPath.startsWith('/api/v1')) {
    cleanPath = cleanPath.slice('/api/v1'.length) || '/';
  }

  const url = new URL(cleanPath, base || window.location.origin);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });

  // If no base URL, return pathname + search to avoid host issues
  if (!base) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError('Request timeout', 0, 'TIMEOUT');
    }
    throw error;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    headers = {},
    timeout = DEFAULT_TIMEOUT_MS,
    retries = MAX_RETRIES,
    retryDelay = RETRY_DELAY_MS,
  } = options;

  const token = await getIdToken();
  const url = buildUrl(path, query);

  const requestHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, timeout);

      if (response.status === 204) {
        return { success: true };
      }

      // Network errors / backend down — try mock in development
      if (!response.ok && response.status === 0) {
        const mock = getMockResponse(path, method, body);
        if (mock !== null) {
          console.warn(`[MOCK] Network error, serving mock for ${method} ${path}`);
          return mock;
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Development fallback: return mock data only for server errors or network issues
        const isServerError = response.status >= 500;
        if (isServerError) {
          const mock = getMockResponse(path, method, body);
          if (mock !== null) {
            console.warn(`[MOCK] Backend returned ${response.status}, serving mock for ${method} ${path}`);
            return mock;
          }
        }
        const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
        const code = data?.error?.code || data?.code || `HTTP_${response.status}`;
        throw new ApiError(message, response.status, code, data);
      }

      return data;
    } catch (error) {
      lastError = error;

      // Don't retry client errors (4xx) except 429 (rate limit)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // Don't retry on last attempt — try mock first
      if (attempt >= retries) {
        const mock = getMockResponse(path, method, body);
        if (mock !== null) {
          console.warn(`[MOCK] Request failed after ${retries} retries, serving mock for ${method} ${path}`);
          return mock;
        }
        throw error;
      }

      await sleep(retryDelay * (attempt + 1));
    }
  }

  throw lastError;
}

// Convenience methods
export const apiGet = (path, query, options) => apiRequest(path, { ...options, method: 'GET', query });
export const apiPost = (path, body, options) => apiRequest(path, { ...options, method: 'POST', body });
export const apiPatch = (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body });
export const apiDelete = (path, options) => apiRequest(path, { ...options, method: 'DELETE' });

export { ApiError };
