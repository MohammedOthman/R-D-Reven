/** PRD §2.3's MVP capability matrix columns, plus OWNER split out of ADMIN — see packages/db/prisma/schema.prisma. */
export type MembershipRole = 'OWNER' | 'ADMIN' | 'EXECUTIVE' | 'MANAGER' | 'REVIEWER' | 'GUEST';

export const MEMBERSHIP_ROLES: MembershipRole[] = [
  'OWNER',
  'ADMIN',
  'EXECUTIVE',
  'MANAGER',
  'REVIEWER',
  'GUEST',
];

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
}

export interface TenantWithRole {
  tenant: Tenant | null;
  role: MembershipRole | null;
}
