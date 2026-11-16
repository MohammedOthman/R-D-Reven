import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import messages from '../messages/en.json';
import { portfolioSummary, dashboardAccess } from '@/src/lib/dashboard/visuals';
import {
  PortfolioHealth,
  PortfolioStages,
  OverviewAction,
  type PortfolioRecord,
} from '@/src/components/PortfolioVisuals';

vi.mock('@/src/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
const fixture: PortfolioRecord[] = [
  {
    id: 'healthy',
    partnerId: 'one',
    partnerName: 'Field Research',
    stage: 'ACTIVE',
    health: 'HEALTHY',
  },
  { id: 'risk', partnerId: 'two', partnerName: 'Coastal Labs', stage: 'AT_RISK', health: null },
  {
    id: 'closed',
    partnerId: 'three',
    partnerName: 'Archive Partner',
    stage: 'ARCHIVED',
    health: 'CRITICAL',
  },
].map((p) => ({
  ...p,
  ownerId: null,
  sponsorId: null,
  motion: null,
  objective: null,
  cadence: null,
  nextReviewAt: null,
  lastTransitionReason: null,
  version: 1,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
})) as PortfolioRecord[];
const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {children}
  </NextIntlClientProvider>
);

describe('portfolio visualization uses the actual population', () => {
  it('includes closed records in stages but excludes them from open relationship health', () => {
    const result = portfolioSummary(fixture);
    expect(result.total).toBe(3);
    expect(result.open).toBe(2);
    expect(result.stages.ACTIVE).toBe(1);
    expect(result.stages.ARCHIVED).toBe(1);
    expect(result.health).toEqual({ HEALTHY: 1, NEEDS_ATTENTION: 0, CRITICAL: 0, UNASSESSED: 1 });
  });
  it('does not invent a health score or percentage for an empty portfolio', () => {
    expect(portfolioSummary([]).open).toBe(0);
    render(<PortfolioHealth partnerships={[]} />, { wrapper });
    expect(screen.getByRole('img')).toHaveAccessibleName(
      '0 open relationships: 0 healthy, 0 need attention, 0 critical, 0 not assessed.',
    );
    expect(document.querySelectorAll('circle')).toHaveLength(1);
  });
  it('filters by stage, reports an empty stage, and restores all records', () => {
    render(<PortfolioStages partnerships={fixture} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /1.*At risk/ }));
    expect(screen.getByText('Coastal Labs')).toBeInTheDocument();
    expect(screen.queryByText('Field Research')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1.*At risk/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /0.*Planning/ }));
    expect(screen.getByText('No relationships at this stage.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all stages' }));
    expect(screen.getByText('Field Research')).toBeInTheDocument();
    expect(screen.getByText('Archive Partner')).toBeInTheDocument();
  });
});

describe('overview actions follow role access', () => {
  it.each([
    ['OWNER', 'Add a partner', '/partnerships?create=partner'],
    ['EXECUTIVE', 'Open reviews', '/reviews'],
    ['REVIEWER', 'Review outcomes', '/evidence-outcomes'],
  ])('%s gets its allowed next action', (role, name, href) => {
    render(<OverviewAction role={role} />, { wrapper });
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  });
  it('hides execution shortcuts for reviewers and creation for executives', () => {
    expect(dashboardAccess('REVIEWER')).toEqual({ canCreate: false, canExecute: false });
    expect(dashboardAccess('EXECUTIVE')).toEqual({ canCreate: false, canExecute: true });
  });
});
