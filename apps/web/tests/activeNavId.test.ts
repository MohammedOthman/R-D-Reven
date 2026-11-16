import { describe, expect, it } from 'vitest';
import { activeNavIdFromPathname } from '@/src/lib/activeNavId';

describe('activeNavIdFromPathname', () => {
  it('highlights the design system item on its route', () => {
    expect(activeNavIdFromPathname('/design-system')).toBe('design-system');
  });

  it.each([
    'partnerships',
    'initiatives',
    'reviews',
    'agreements',
    'evidence-outcomes',
    'audit',
    'administration',
  ])('highlights %s for its list and record routes', (section) => {
    expect(activeNavIdFromPathname(`/${section}`)).toBe(section);
    expect(activeNavIdFromPathname(`/${section}/record-id`)).toBe(section);
  });

  it('does not match a route that only shares a prefix', () => {
    expect(activeNavIdFromPathname('/reviewstuff')).toBe('command-center');
    expect(activeNavIdFromPathname('/agreements-elsewhere')).toBe('command-center');
  });

  it('falls back to the command center for the home route', () => {
    expect(activeNavIdFromPathname('/')).toBe('command-center');
  });

  it('falls back to the command center for unknown routes', () => {
    expect(activeNavIdFromPathname('/something-not-built-yet')).toBe('command-center');
  });
});
