import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { ToastProvider } from '@revn/ui';
import enMessages from '../messages/en.json';
import arMessages from '../messages/ar.json';
import { EcosystemContent } from '@/app/[locale]/(app)/ecosystem/EcosystemContent';
import { EcosystemGraphCanvas } from '@/src/components/ecosystem/EcosystemGraphCanvas';
import type { EcosystemGraph } from '@/src/lib/ecosystem/types';

const routerRefresh = vi.fn();

vi.mock('@/src/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  useRouter: () => ({
    refresh: routerRefresh,
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const rebuildMock = vi.fn();
const seedMock = vi.fn();
const createMock = vi.fn();

vi.mock('@/src/lib/ecosystem/client', () => ({
  rebuildEcosystemGraph: (...args: unknown[]) => rebuildMock(...args),
  seedEcosystemExample: (...args: unknown[]) => seedMock(...args),
  createAccount: (...args: unknown[]) => createMock(...args),
}));

const sampleGraph: EcosystemGraph = {
  nodes: [
    {
      id: 'acc-1',
      name: 'Riyadh Pay',
      group: 0,
      headcount: 420,
      hqCity: 'Riyadh',
      hqCountry: 'Saudi Arabia',
      centrality: 0.42,
      x: 260,
      y: 260,
    },
    {
      id: 'acc-2',
      name: 'Jeddah Commerce',
      group: 0,
      headcount: 180,
      hqCity: 'Jeddah',
      hqCountry: 'Saudi Arabia',
      centrality: 0.25,
      x: 470,
      y: 220,
    },
    {
      id: 'acc-3',
      name: 'Dammam Cloud',
      group: 1,
      headcount: 95,
      hqCity: 'Dammam',
      hqCountry: 'Saudi Arabia',
      centrality: 0.19,
      x: 520,
      y: 410,
    },
    {
      id: 'acc-4',
      name: 'Khobar Freight',
      group: 1,
      headcount: 310,
      hqCity: 'Khobar',
      hqCountry: 'Saudi Arabia',
      centrality: 0.14,
      x: 740,
      y: 340,
    },
  ],
  edges: [
    {
      source: 'acc-1',
      target: 'acc-2',
      score: 0.72,
      components: [
        { family: 'technologies', score: 0.8, evidence: ['Snowflake', 'Stripe'] },
        { family: 'keywords', score: 0.64, evidence: ['payments', 'checkout'] },
      ],
    },
    {
      source: 'acc-1',
      target: 'acc-3',
      score: 0.51,
      components: [
        { family: 'technologies', score: 0.55, evidence: ['AWS'] },
        { family: 'industries', score: 0.45, evidence: ['518210'] },
        { family: 'lists', score: 0.4, evidence: ['Q4 Priority'] },
      ],
    },
    {
      source: 'acc-2',
      target: 'acc-4',
      score: 0.63,
      components: [{ family: 'keywords', score: 0.7, evidence: ['logistics', 'fulfillment'] }],
    },
  ],
  groups: [
    { id: 0, label: 'Payments & Commerce', members: 2, topTerms: ['payments', 'checkout'] },
    { id: 1, label: 'Cloud & Logistics', members: 2, topTerms: ['cloud', 'logistics'] },
  ],
  provenance: {
    calculationVersion: 'ecosystem-v1',
    refreshedAt: '2026-11-20T12:00:00.000Z',
    weights: { technologies: 0.4, keywords: 0.35, industries: 0.15, lists: 0.1 },
    source: 'stored',
  },
};

function renderWithIntl(ui: ReactNode, locale: 'en' | 'ar' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? enMessages : arMessages}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('Ecosystem studio experience', () => {
  it('syncs search & group filters across the map and company directory and resets cleanly', () => {
    renderWithIntl(
      <EcosystemContent
        tenantId="tenant-1"
        graph={sampleGraph}
        pilotMode={false}
        currentRole="OWNER"
      />,
    );

    expect(screen.getAllByText('Showing 4 of 4')).toHaveLength(2);

    // Search by city ("Jeddah") filters both table rows and map node opacity
    const search = screen.getByRole('searchbox', { name: 'Search by company, city, or group' });
    fireEvent.change(search, { target: { value: 'Jeddah' } });

    expect(screen.getAllByText('Showing 1 of 4')).toHaveLength(2);
    const table = screen.getByRole('table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(within(table).getByText('Jeddah Commerce')).toBeInTheDocument();

    const riyadhNode = document.querySelector('[data-node="acc-1"]');
    const jeddahNode = document.querySelector('[data-node="acc-2"]');
    expect(riyadhNode).toHaveAttribute('opacity', '0.22');
    expect(jeddahNode).not.toHaveAttribute('opacity', '0.22');

    // Non-matching query displays empty filter state and "Show all companies" resets both
    fireEvent.change(search, { target: { value: 'NoSuchCompany' } });
    expect(screen.getAllByText('Showing 0 of 4')).toHaveLength(2);
    expect(screen.getAllByText('No matching companies').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Show all companies' })[0]!);
    expect(screen.getAllByText('Showing 4 of 4')).toHaveLength(2);

    // Group filter pill filters both map & directory by group
    const cloudPill = screen.getByRole('button', { name: /Cloud & Logistics/ });
    fireEvent.click(cloudPill);
    expect(cloudPill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Showing 2 of 4')).toHaveLength(2);
    const filteredTable = screen.getByRole('table');
    expect(filteredTable.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(within(filteredTable).getByText('Dammam Cloud')).toBeInTheDocument();
    expect(within(filteredTable).getByText('Khobar Freight')).toBeInTheDocument();
  });

  it('compares any neighbour from the inspector list, via map edge clicks, and focuses a neighbour', () => {
    renderWithIntl(
      <EcosystemContent
        tenantId="tenant-1"
        graph={sampleGraph}
        pilotMode={false}
        currentRole="OWNER"
      />,
    );

    const inspector = screen.getByRole('complementary');
    const whySection = document.querySelector('[data-why-match="true"]') as HTMLElement;
    expect(whySection).toBeTruthy();
    // Default compares Riyadh Pay ↔ Jeddah Commerce (72%)
    expect(within(whySection).getByText('Riyadh Pay ↔ Jeddah Commerce')).toBeInTheDocument();
    expect(within(whySection).getByText('Snowflake')).toBeInTheDocument();

    // Clicking secondary neighbour ("Dammam Cloud") in Closest matches updates Why they match
    const dammamCompareBtn = within(inspector).getByRole('button', {
      name: /Dammam Cloud.*51% match/i,
    });
    fireEvent.click(dammamCompareBtn);
    expect(within(whySection).getByText('Riyadh Pay ↔ Dammam Cloud')).toBeInTheDocument();
    expect(within(whySection).getByText('AWS')).toBeInTheDocument();
    expect(within(whySection).getByText('Q4 Priority')).toBeInTheDocument();

    // Clicking an edge directly on the map (Jeddah Commerce ↔ Khobar Freight) updates Why they match
    const remoteEdge = document.querySelector('[data-edge="acc-2|acc-4"]') as Element;
    expect(remoteEdge).toBeTruthy();
    fireEvent.click(remoteEdge);
    expect(within(whySection).getByText('Jeddah Commerce ↔ Khobar Freight')).toBeInTheDocument();
    expect(within(whySection).getByText('logistics')).toBeInTheDocument();

    // Quick-focus button switches the selected company
    const focusBtn = screen.getByRole('button', { name: 'Focus Khobar Freight' });
    fireEvent.click(focusBtn);
    expect(
      within(screen.getByRole('complementary')).getByRole('heading', { name: 'Khobar Freight' }),
    ).toBeInTheDocument();
  });

  it('auto-selects the first company when an empty workspace receives data after seeding', () => {
    const emptyGraph: EcosystemGraph = {
      ...sampleGraph,
      nodes: [],
      edges: [],
      groups: [],
    };

    const { rerender } = renderWithIntl(
      <EcosystemContent
        tenantId="tenant-1"
        graph={emptyGraph}
        pilotMode={true}
        currentRole="OWNER"
      />,
    );

    expect(screen.getByText('No companies on the map yet')).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ToastProvider>
          <EcosystemContent
            tenantId="tenant-1"
            graph={sampleGraph}
            pilotMode={true}
            currentRole="OWNER"
          />
        </ToastProvider>
      </NextIntlClientProvider>,
    );

    // First company is automatically selected and shown in the inspector
    expect(
      within(screen.getByRole('complementary')).getByRole('heading', { name: 'Riyadh Pay' }),
    ).toBeInTheDocument();
  });

  it('supports Focus / Full map lenses, midpoint match badges, and hover preview cards', () => {
    renderWithIntl(
      <EcosystemContent
        tenantId="tenant-1"
        graph={sampleGraph}
        pilotMode={false}
        currentRole="OWNER"
      />,
    );

    const svg = screen.getByRole('img', { name: 'Company ecosystem map' });
    expect(svg).toHaveAttribute('data-lens', 'focus');

    // Focus lens marks 2-step warm bridge path (Jeddah Commerce -> Khobar Freight)
    expect(document.querySelector('[data-edge-kind="bridge"]')).toBeTruthy();

    // Midpoint match percentage badge renders at t = 0.5 of compared arc (72%)
    const midpointBadge = document.querySelector('[data-midpoint-badge="true"]');
    expect(midpointBadge).toBeTruthy();
    expect(midpointBadge?.textContent).toBe('72%');

    // Toggle to Full map lens
    const fullMapBtn = screen.getByRole('button', { name: 'Full map' });
    fireEvent.click(fullMapBtn);
    expect(fullMapBtn).toHaveAttribute('aria-pressed', 'true');
    expect(svg).toHaveAttribute('data-lens', 'full');

    // Hover a 1-hop neighbour -> floating dark glass preview card shows direct match %
    const jeddahNode = document.querySelector('[data-node="acc-2"]') as Element;
    fireEvent.mouseEnter(jeddahNode);
    const hoverCard = document.querySelector('[data-hover-card="true"]') as HTMLElement;
    expect(hoverCard).toBeTruthy();
    expect(within(hoverCard).getByText('Jeddah Commerce')).toBeInTheDocument();
    expect(within(hoverCard).getByText('Jeddah')).toBeInTheDocument();
    expect(within(hoverCard).getByText('72% direct match')).toBeInTheDocument();
    fireEvent.mouseLeave(jeddahNode);
    expect(document.querySelector('[data-hover-card="true"]')).toBeNull();

    // Hover a 2-hop company -> hover card shows 2-step reach via bridge company
    const khobarNode = document.querySelector('[data-node="acc-4"]') as Element;
    fireEvent.mouseEnter(khobarNode);
    const twoStepCard = document.querySelector('[data-hover-card="true"]') as HTMLElement;
    expect(within(twoStepCard).getByText('2 steps away via Jeddah Commerce')).toBeInTheDocument();
  });

  it('gates Refresh map to Owner/Admin and wires it to rebuildEcosystemGraph', async () => {
    rebuildMock.mockResolvedValue({ result: { accounts: 4, edges: 3 } });

    const { unmount } = renderWithIntl(
      <EcosystemContent
        tenantId="tenant-42"
        graph={sampleGraph}
        pilotMode={false}
        currentRole="ADMIN"
      />,
    );

    const refreshBtn = screen.getByRole('button', { name: 'Refresh map' });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(rebuildMock).toHaveBeenCalledWith('tenant-42');
      expect(routerRefresh).toHaveBeenCalled();
    });

    unmount();

    // Manager can add companies but cannot refresh/rebuild the map
    renderWithIntl(
      <EcosystemContent
        tenantId="tenant-42"
        graph={sampleGraph}
        pilotMode={false}
        currentRole="MANAGER"
      />,
    );

    expect(screen.getByRole('button', { name: 'Add company' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh map' })).not.toBeInTheDocument();
  });

  it('localizes SVG node aria-labels in Arabic without hardcoded English employees text', () => {
    renderWithIntl(
      <EcosystemGraphCanvas
        graph={sampleGraph}
        selectedId="acc-1"
        comparedId="acc-2"
        filteredIds={new Set(sampleGraph.nodes.map((n) => n.id))}
        group="all"
        onSelect={vi.fn()}
        onCompareEdge={vi.fn()}
      />,
      'ar',
    );

    const riyadhNode = document.querySelector('[data-node="acc-1"]');
    expect(riyadhNode).toBeTruthy();
    const label = riyadhNode?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Riyadh Pay');
    expect(label).toContain('موظف');
    expect(label).not.toContain('employees');
  });
});
