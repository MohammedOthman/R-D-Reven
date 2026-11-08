import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const initiativeFindFirst = vi.fn();
const reviewFindFirst = vi.fn();
const milestoneFindFirst = vi.fn();
const membershipFindFirst = vi.fn();
const actionFindFirst = vi.fn();
const actionCreate = vi.fn();
const actionUpdate = vi.fn();

class FakePrismaClientKnownRequestError extends Error {
  code: string;
  constructor(code: string) {
    super(`Prisma error ${code}`);
    this.code = code;
  }
}

vi.mock('@revn/db', () => ({
  prisma: {
    initiative: { findFirst: (...args: unknown[]) => initiativeFindFirst(...args) },
    review: { findFirst: (...args: unknown[]) => reviewFindFirst(...args) },
    milestone: { findFirst: (...args: unknown[]) => milestoneFindFirst(...args) },
    membership: { findFirst: (...args: unknown[]) => membershipFindFirst(...args) },
    action: {
      findFirst: (...args: unknown[]) => actionFindFirst(...args),
      create: (...args: unknown[]) => actionCreate(...args),
      update: (...args: unknown[]) => actionUpdate(...args),
    },
  },
  Prisma: { PrismaClientKnownRequestError: FakePrismaClientKnownRequestError },
}));

const { ActionsService } = await import('../src/modules/execution/actions/actions.service');

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    tenantId: 'tenant-1',
    initiativeId: 'init-1',
    reviewId: null,
    milestoneId: null,
    title: 'Send proposal',
    assigneeUserId: 'user-9',
    assigneeExternalName: null,
    dueDate: null,
    status: 'OPEN',
    blockerReason: null,
    completionNote: null,
    completedAt: null,
    version: 1,
    ...overrides,
  };
}

describe('ActionsService.create', () => {
  beforeEach(() => {
    initiativeFindFirst.mockReset();
    reviewFindFirst.mockReset();
    membershipFindFirst.mockReset();
    milestoneFindFirst.mockReset();
    actionCreate.mockReset();
  });

  it('throws NotFoundException when the initiative does not exist', async () => {
    initiativeFindFirst.mockResolvedValue(null);
    const service = new ActionsService();

    await expect(
      service.create(
        'tenant-1',
        { initiativeId: 'missing', title: 'x', assigneeExternalName: 'Jane' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(actionCreate).not.toHaveBeenCalled();
  });

  it('rejects an action with neither an initiative nor a review', async () => {
    const service = new ActionsService();

    await expect(
      service.create('tenant-1', { title: 'x', assigneeExternalName: 'Jane' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(actionCreate).not.toHaveBeenCalled();
  });

  it('rejects an action with neither a member assignee nor an external name', async () => {
    initiativeFindFirst.mockResolvedValue({ id: 'init-1' });
    const service = new ActionsService();

    await expect(
      service.create('tenant-1', { initiativeId: 'init-1', title: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(actionCreate).not.toHaveBeenCalled();
  });

  it('rejects an assignee who is not an active tenant member', async () => {
    initiativeFindFirst.mockResolvedValue({ id: 'init-1' });
    membershipFindFirst.mockResolvedValue(null);
    const service = new ActionsService();

    await expect(
      service.create(
        'tenant-1',
        { initiativeId: 'init-1', title: 'x', assigneeUserId: 'user-9' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('creates an action linked only to a review, with an external counterpart assignee', async () => {
    reviewFindFirst.mockResolvedValue({ id: 'review-1' });
    actionCreate.mockResolvedValue(
      action({
        initiativeId: null,
        reviewId: 'review-1',
        assigneeUserId: null,
        assigneeExternalName: 'Jane at Acme',
      }),
    );
    const service = new ActionsService();

    await service.create(
      'tenant-1',
      { reviewId: 'review-1', title: 'x', assigneeExternalName: 'Jane at Acme' },
      'user-1',
    );

    expect(actionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewId: 'review-1',
          assigneeExternalName: 'Jane at Acme',
        }),
      }),
    );
  });
});

describe('ActionsService.update — status transitions', () => {
  beforeEach(() => {
    actionFindFirst.mockReset();
    actionUpdate.mockReset();
    membershipFindFirst.mockReset();
    milestoneFindFirst.mockReset();
  });

  it('rejects a transition that skips a status (Open -> Done)', async () => {
    actionFindFirst.mockResolvedValue(action({ status: 'OPEN' }));
    const service = new ActionsService();

    await expect(
      service.update('tenant-1', 'action-1', { version: 1, status: 'DONE' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(actionUpdate).not.toHaveBeenCalled();
  });

  it('rejects moving to Blocked without a reason', async () => {
    actionFindFirst.mockResolvedValue(action({ status: 'OPEN' }));
    const service = new ActionsService();

    await expect(
      service.update('tenant-1', 'action-1', { version: 1, status: 'BLOCKED' }, 'user-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows Open -> Blocked with a reason, and clears it on recovery to In Progress', async () => {
    actionFindFirst.mockResolvedValue(action({ status: 'OPEN' }));
    actionUpdate.mockResolvedValue(action({ status: 'BLOCKED' }));
    const service = new ActionsService();

    await service.update(
      'tenant-1',
      'action-1',
      { version: 1, status: 'BLOCKED', blockerReason: 'Waiting on partner legal.' },
      'user-1',
    );
    expect(actionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blockerReason: 'Waiting on partner legal.' }),
      }),
    );

    actionFindFirst.mockResolvedValue(
      action({ status: 'BLOCKED', blockerReason: 'Waiting on partner legal.' }),
    );
    await service.update('tenant-1', 'action-1', { version: 2, status: 'IN_PROGRESS' }, 'user-1');
    expect(actionUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ blockerReason: null }) }),
    );
  });

  it('sets completedAt when moving to Done', async () => {
    actionFindFirst.mockResolvedValue(action({ status: 'IN_PROGRESS' }));
    actionUpdate.mockResolvedValue(action({ status: 'DONE' }));
    const service = new ActionsService();

    await service.update('tenant-1', 'action-1', { version: 1, status: 'DONE' }, 'user-1');

    expect(actionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedAt: expect.any(Date) }) }),
    );
  });

  it('maps a version mismatch to ConflictException', async () => {
    actionFindFirst.mockResolvedValue(action());
    actionUpdate.mockRejectedValue(new FakePrismaClientKnownRequestError('P2025'));
    const service = new ActionsService();

    await expect(
      service.update('tenant-1', 'action-1', { version: 1, title: 'New title' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
