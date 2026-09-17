import type { MembershipRole } from './types';

/** Maps a role to its `common.role*` translation key — the one place this mapping lives, used by AppShell's footer and the Administration page's member table. */
const ROLE_LABEL_KEYS: Record<MembershipRole, string> = {
  OWNER: 'common.roleOwner',
  ADMIN: 'common.roleAdmin',
  EXECUTIVE: 'common.roleExecutive',
  MANAGER: 'common.roleManager',
  REVIEWER: 'common.roleReviewer',
  GUEST: 'common.roleGuest',
};

export function roleLabelKey(role: MembershipRole): string {
  return ROLE_LABEL_KEYS[role];
}
