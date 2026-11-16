import {
  PARTNERSHIP_STAGES,
  type Partnership,
  type PartnershipHealth,
} from '@/src/lib/partnerships/types';

export const HEALTH_KEYS = ['HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL', 'UNASSESSED'] as const;
export type HealthKey = PartnershipHealth | 'UNASSESSED';

/** Health covers open relationships; stage distribution covers the entire portfolio. */
export function portfolioSummary(partnerships: Pick<Partnership, 'stage' | 'health'>[]) {
  const stages = Object.fromEntries(PARTNERSHIP_STAGES.map((stage) => [stage, 0])) as Record<
    Partnership['stage'],
    number
  >;
  const health: Record<HealthKey, number> = {
    HEALTHY: 0,
    NEEDS_ATTENTION: 0,
    CRITICAL: 0,
    UNASSESSED: 0,
  };
  for (const partnership of partnerships) {
    stages[partnership.stage]++;
    if (partnership.stage !== 'TERMINATED' && partnership.stage !== 'ARCHIVED') {
      health[partnership.health ?? 'UNASSESSED']++;
    }
  }
  return {
    stages,
    health,
    open: Object.values(health).reduce((sum, count) => sum + count, 0),
    total: partnerships.length,
  };
}

export function dashboardAccess(role: string) {
  return {
    canCreate: ['OWNER', 'ADMIN', 'MANAGER'].includes(role),
    canExecute: ['OWNER', 'ADMIN', 'MANAGER', 'EXECUTIVE'].includes(role),
  };
}
