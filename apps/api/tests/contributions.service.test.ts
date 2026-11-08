import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const partnershipFindFirst = vi.fn();
const initiativeFindFirst = vi.fn();
const actionFindFirst = vi.fn();
const outcomeFindFirst = vi.fn();
const contributionCreate = vi.fn();

vi.mock('@revn/db', () => ({
  prisma: {
    partnership: { findFirst: (...args: unknown[]) => partnershipFindFirst(...args) },
    initiative: { findFirst: (...args: unknown[]) => initiativeFindFirst(...args) },
    action: { findFirst: (...args: unknown[]) => actionFindFirst(...args) },
    outcome: { findFirst: (...args: unknown[]) => outcomeFindFirst(...args) },
    contribution: { create: (...args: unknown[]) => contributionCreate(...args) },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

const { ContributionsService } =
  await import('../src/modules/evidence-outcomes/contributions/contributions.service');

describe('ContributionsService.create — EVD-01', () => {
  beforeEach(() => {
    partnershipFindFirst.mockReset();
    initiativeFindFirst.mockReset();
    actionFindFirst.mockReset();
    outcomeFindFirst.mockReset();
    contributionCreate.mockReset();
  });

  it('rejects a contribution with no link at all', async () => {
    const service = new ContributionsService();

    await expect(
      service.create(
        'tenant-1',
        { type: 'Meeting', observedAt: '2026-01-01', narrative: 'Discussed rollout.' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(contributionCreate).not.toHaveBeenCalled();
  });

  it('rejects when the linked outcome does not exist', async () => {
    outcomeFindFirst.mockResolvedValue(null);
    const service = new ContributionsService();

    await expect(
      service.create(
        'tenant-1',
        {
          outcomeId: 'missing',
          type: 'Meeting',
          observedAt: '2026-01-01',
          narrative: 'Discussed rollout.',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(contributionCreate).not.toHaveBeenCalled();
  });

  it('creates a contribution linked to an outcome, defaulting actor to the acting user', async () => {
    outcomeFindFirst.mockResolvedValue({ id: 'outcome-1' });
    contributionCreate.mockResolvedValue({ id: 'contribution-1' });
    const service = new ContributionsService();

    await service.create(
      'tenant-1',
      {
        outcomeId: 'outcome-1',
        type: 'Meeting',
        observedAt: '2026-01-01',
        narrative: 'Discussed rollout.',
      },
      'user-1',
    );

    expect(contributionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcomeId: 'outcome-1', actorId: 'user-1' }),
      }),
    );
  });
});
