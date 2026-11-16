import type { MembershipRole } from '../tenant/types';

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface Member {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface Invitation {
  id: string;
  email: string;
  role: MembershipRole;
  expiresAt: string;
  createdAt: string;
}

/** Active directory entries for owner/sponsor/verifier pickers, with a read-only role. */
export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  role: MembershipRole;
}
