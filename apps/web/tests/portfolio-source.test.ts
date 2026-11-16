import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'access_token=local-test' }),
}));
import { getPartners } from '@/src/lib/partners/session';
import { getPartnerships } from '@/src/lib/partnerships/session';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
describe.each([
  ['partners', getPartners],
  ['partnerships', getPartnerships],
] as const)('portfolio %s source', (key, read) => {
  it('does not turn a failed chart source into a zero count', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(read('tenant', { failOnError: true })).rejects.toThrow(
      'Could not load the portfolio.',
    );
  });
  it('preserves a genuinely empty successful portfolio', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ [key]: [] }), { status: 200 }));
    await expect(read('tenant', { failOnError: true })).resolves.toEqual([]);
  });
});
