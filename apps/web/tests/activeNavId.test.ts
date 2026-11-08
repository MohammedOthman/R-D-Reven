import { describe, expect, it } from 'vitest';
import { activeNavIdFromPathname } from '@/src/lib/activeNavId';

describe('activeNavIdFromPathname', () => {
  it('highlights the design system item on its route', () => {
    expect(activeNavIdFromPathname('/design-system')).toBe('design-system');
  });

  it('falls back to the command center for the home route', () => {
    expect(activeNavIdFromPathname('/')).toBe('command-center');
  });

  it('falls back to the command center for unknown routes', () => {
    expect(activeNavIdFromPathname('/something-not-built-yet')).toBe('command-center');
  });
});
