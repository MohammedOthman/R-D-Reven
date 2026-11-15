import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiFetch, apiDownload } from '@/src/lib/api/client';
import { ApiError } from '@/src/lib/api/error';

function jsonResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed body on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { user: { id: '1' } })));
    await expect(apiFetch('/tenants/me')).resolves.toEqual({ user: { id: '1' } });
  });

  it('resolves to undefined for a 2xx response with an empty body, whatever the status code', async () => {
    // Regression: inviting a member returns 201 with no body — treating
    // only 204 as "empty" made this throw a JSON parse error on the API's
    // actual happy path (found via live browser QA, not a unit test).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(201)));
    await expect(apiFetch('/tenants/t1/invitations', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws ApiError with the response body on a non-2xx response', async () => {
    const errorBody = {
      code: 'CONFLICT',
      message: 'Already exists.',
      correlation_id: 'x',
      retryable: false,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, errorBody)));

    await expect(apiFetch('/tenants')).rejects.toMatchObject({ body: errorBody });
  });

  it('silently refreshes and retries once on a 401 from a protected-resource call', async () => {
    const fetchMock = vi
      .fn()
      // 1) the original call — expired access token
      .mockResolvedValueOnce(
        jsonResponse(401, {
          code: 'UNAUTHENTICATED',
          message: 'x',
          correlation_id: 'x',
          retryable: false,
        }),
      )
      // 2) POST /auth/refresh — succeeds
      .mockResolvedValueOnce(jsonResponse(200, { user: { id: '1' } }))
      // 3) the retried original call — now succeeds
      .mockResolvedValueOnce(jsonResponse(200, { tenant: { id: 't1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/tenants/me')).resolves.toEqual({ tenant: { id: 't1' } });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/auth/refresh');
  });

  it('gives up after one retry and throws the original 401 if refresh also fails', async () => {
    const unauthenticated = {
      code: 'UNAUTHENTICATED',
      message: 'Session expired or invalid.',
      correlation_id: 'x',
      retryable: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated)) // original call
      .mockResolvedValueOnce(jsonResponse(401, unauthenticated)); // /auth/refresh also fails
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/tenants/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never attempts a silent refresh for a 401 from the auth flow itself (e.g. wrong password)', async () => {
    const invalidCredentials = {
      code: 'UNAUTHENTICATED',
      message: 'Invalid email or password.',
      correlation_id: 'x',
      retryable: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, invalidCredentials));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('/auth/sign-in', { method: 'POST', body: { email: 'a@b.com', password: 'wrong' } }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiDownload', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('renews an expired session before returning the original file', async () => {
    const file = new Blob(['evidence bytes']);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => file });
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiDownload('/tenants/t1/evidence/e1/file')).resolves.toBe(file);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('surfaces a forbidden download rather than saving an error as a file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(403, { code: 'FORBIDDEN', message: 'Denied' })),
    );
    await expect(apiDownload('/tenants/t1/evidence/e1/file')).rejects.toBeInstanceOf(ApiError);
  });
});
