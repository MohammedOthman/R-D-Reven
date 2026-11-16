import { describe, it, expect } from 'vitest';
import { pilotDestination } from '@/src/lib/auth/pilot-destination';
import { outcomeVerifiers } from '@/src/lib/outcomes/verifiers';
import type { MembershipRole } from '@/src/lib/tenant/types';

describe('pilot task handoffs', () => {
  it('keeps decision approval on the same review when switching to Executive', () => {
    expect(pilotDestination('/reviews/review-1', 'EXECUTIVE')).toBe('/reviews/review-1');
  });
  it('keeps outcome verification on the same record when switching to Reviewer', () => {
    expect(pilotDestination('/evidence-outcomes/outcome-1', 'REVIEWER')).toBe(
      '/evidence-outcomes/outcome-1',
    );
  });
  it('returns to the overview when the new role cannot open the current area', () => {
    expect(pilotDestination('/initiatives/initiative-1', 'REVIEWER')).toBe('/');
    expect(pilotDestination('/partnerships/import', 'EXECUTIVE')).toBe('/');
  });
  it('does not preserve account, unknown or external paths', () => {
    for (const path of [
      '/administration',
      '/sign-in',
      '//example.com',
      'https://example.com',
      '/unknown',
    ]) {
      expect(pilotDestination(path, 'OWNER')).toBe('/');
    }
  });
  it('keeps permitted read-only commercial rules visible to a Reviewer', () => {
    expect(pilotDestination('/agreements/rules/rule-1', 'REVIEWER')).toBe(
      '/agreements/rules/rule-1',
    );
  });
});

describe('independent outcome verifier options', () => {
  const roles: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER', 'GUEST'];
  const members = roles.map((role) => ({
    id: role,
    name: role,
    email: `${role.toLowerCase()}@test.example`,
    role,
  }));
  it('offers only eligible members and excludes the creator regardless of role', () => {
    expect(outcomeVerifiers(members, 'OWNER').map((m) => m.role)).toEqual(['ADMIN', 'REVIEWER']);
    expect(outcomeVerifiers(members, 'REVIEWER').map((m) => m.role)).toEqual(['OWNER', 'ADMIN']);
  });
  it('leaves no selectable value when nobody independent can verify', () => {
    expect(
      outcomeVerifiers(
        members.filter((m) => ['OWNER', 'MANAGER'].includes(m.role)),
        'OWNER',
      ),
    ).toEqual([]);
  });
});
