import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PilotGuide } from '@/src/components/PilotGuide';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
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

describe('pilot guidance follows the active role', () => {
  it('lets the Owner start the workflow and visit its four steps', async () => {
    render(await PilotGuide({ role: 'OWNER' }));
    expect(screen.getByRole('link', { name: 'startAction' })).toHaveAttribute(
      'href',
      '/partnerships?create=partner',
    );
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });
  it('sends a Reviewer to outcomes without offering creation or restricted initiative routes', async () => {
    render(await PilotGuide({ role: 'REVIEWER' }));
    expect(screen.getByRole('link', { name: 'reviewerAction' })).toHaveAttribute(
      'href',
      '/evidence-outcomes',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'startAction' })).not.toBeInTheDocument();
  });
  it('sends an Executive to decision reviews without offering partner creation', async () => {
    render(await PilotGuide({ role: 'EXECUTIVE' }));
    expect(screen.getByRole('link', { name: 'executiveAction' })).toHaveAttribute(
      'href',
      '/reviews',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
