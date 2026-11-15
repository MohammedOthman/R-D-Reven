'use client';

import { ApiError, type ApiErrorBody } from './error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Internal — prevents infinite recursion if `/auth/refresh` itself ever 401s. */
  _isRetry?: boolean;
}

/**
 * Client-side fetch to the API — always sends cookies, always throws
 * `ApiError` on a non-2xx response.
 *
 * The access token cookie is short-lived (15 min); on a 401, this silently
 * exchanges the refresh token for a fresh session and retries the request
 * once before giving up. Without this, every open tab would start failing
 * requests 15 minutes after sign-in even though the user never left —
 * `proxy.ts` covers the equivalent case for full page loads, but a
 * client-side call like this one never goes through the proxy at all.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const res = await rawFetch(path, options);

  // `/auth/*` 401s are a business outcome (wrong password, no session at
  // all) rather than "your access token just expired" — never intercept
  // those, only protected-resource calls outside the auth flow itself.
  const eligibleForRefresh = res.status === 401 && !options._isRetry && !path.startsWith('/auth/');
  if (eligibleForRefresh) {
    if (await renewSession()) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
  }

  return parseResponse<T>(res);
}

/**
 * Same cookie/retry/error contract as `apiFetch`, for a `multipart/form-data`
 * body instead of JSON — `FormData` must never get a manually-set
 * `Content-Type`, since the browser needs to add its own multipart boundary.
 * `FormData` isn't a stream, so it's safe to resend on a silent-refresh retry.
 */
export async function apiUpload<T>(path: string, formData: FormData, _isRetry = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (res.status === 401 && !_isRetry) {
    if (await renewSession()) {
      return apiUpload<T>(path, formData, true);
    }
  }

  return parseResponse<T>(res);
}

/** Download through the same session renewal and API error contract as JSON requests. */
export async function apiDownload(path: string): Promise<Blob> {
  let res = await rawFetch(path, {});
  if (res.status === 401) {
    if (await renewSession()) res = await rawFetch(path, {});
  }
  if (!res.ok) await parseResponse<never>(res);
  return res.blob();
}

/** Pilot tabs can resume without a login form. The API returns 404 when pilot mode is disabled. */
async function renewSession(): Promise<boolean> {
  const refreshed = await rawFetch('/auth/refresh', { method: 'POST' });
  if (refreshed.ok) return true;
  const pilot = await rawFetch('/auth/pilot-session', { method: 'POST' });
  return pilot.ok;
}

function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Reads the body as text first rather than assuming JSON-or-nothing by
 * status code — a `201 Created` with no body (e.g. inviting a member: the
 * caller just re-fetches the list, so there's nothing to return) is just as
 * empty as a `204`, and calling `.json()` on an empty body throws. That
 * throw isn't an `ApiError`, so it silently read as a generic failure to
 * every caller — including on the API's happy path, where the invitation
 * had already been created. Caught by live browser QA sending a real
 * invite, not by any automated test.
 */
async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(body as ApiErrorBody);
  }
  return body as T;
}
