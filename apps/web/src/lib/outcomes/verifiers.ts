import type { MemberSummary } from '../members/types';

export function outcomeVerifiers(members: MemberSummary[], creatorId: string): MemberSummary[] {
  return members.filter(
    (member) => member.id !== creatorId && ['OWNER', 'ADMIN', 'REVIEWER'].includes(member.role),
  );
}
