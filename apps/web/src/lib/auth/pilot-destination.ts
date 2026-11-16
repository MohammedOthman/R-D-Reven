import type { MembershipRole } from '../tenant/types';

/** Keep a handoff on its record when the selected role can open that page. Server guards still authorize every request. */
export function pilotDestination(pathname: string, role: MembershipRole): string {
  if (!['OWNER', 'EXECUTIVE', 'REVIEWER'].includes(role)) return '/workspace';
  if (
    role !== 'OWNER' &&
    (pathname === '/partnerships/import' || pathname.startsWith('/partnerships/import/'))
  )
    return '/workspace';
  const sections =
    role === 'REVIEWER'
      ? ['/partnerships', '/agreements', '/evidence-outcomes', '/audit']
      : [
          '/partnerships',
          '/initiatives',
          '/reviews',
          '/agreements',
          '/evidence-outcomes',
          '/audit',
        ];
  return sections.some((section) => pathname === section || pathname.startsWith(section + '/'))
    ? pathname
    : '/workspace';
}
