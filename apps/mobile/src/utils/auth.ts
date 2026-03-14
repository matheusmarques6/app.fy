import { getFromStorage, setToStorage, removeFromStorage } from './storage';

const AUTH_TOKEN_KEY = 'appfy_auth_token';

let cachedToken: string | null = null;

/**
 * Get the current auth token for API requests.
 * Returns null if user is not authenticated.
 */
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await getFromStorage(AUTH_TOKEN_KEY);
  return cachedToken;
}

/**
 * Set the auth token (called after login / token refresh).
 */
export async function setAuthToken(token: string): Promise<void> {
  cachedToken = token;
  await setToStorage(AUTH_TOKEN_KEY, token);
}

/**
 * Clear the auth token (called on logout).
 */
export async function clearAuthToken(): Promise<void> {
  cachedToken = null;
  await removeFromStorage(AUTH_TOKEN_KEY);
}

/**
 * Build auth headers for API requests.
 * Returns headers with Authorization + X-Tenant-Id.
 */
export async function getAuthHeaders(tenantId: string): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
