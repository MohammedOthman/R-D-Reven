export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';

/**
 * Mirrors `apps/api/.../actions/actions.service.ts`'s `VALID_TRANSITIONS` —
 * kept in sync by hand. The server re-validates every transition
 * regardless; this only decides which buttons to render.
 */
export const VALID_ACTION_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  OPEN: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

/** An Action belongs to an Initiative, a Review, or both — see docs/DECISIONS.md. */
export interface Action {
  id: string;
  initiativeId: string | null;
  reviewId: string | null;
  milestoneId: string | null;
  title: string;
  assigneeUserId: string | null;
  assigneeExternalName: string | null;
  dueDate: string | null;
  status: ActionStatus;
  blockerReason: string | null;
  completionNote: string | null;
  completedAt: string | null;
  version: number;
}
