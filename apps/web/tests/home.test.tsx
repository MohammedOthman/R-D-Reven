import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { RevenHome } from '@/src/components/home/RevenHome';
import en from '../messages/en.json';
import ar from '../messages/ar.json';

vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    fill: _fill,
    ...props
  }: ComponentProps<'img'> & { priority?: boolean; fill?: boolean }) => <img {...props} />,
}));
vi.mock('@/src/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    locale,
    prefetch: _prefetch,
    ...props
  }: ComponentProps<'a'> & { locale?: string; prefetch?: boolean; children: ReactNode }) => (
    <a href={locale ? `/${locale}` : href} {...props}>
      {children}
    </a>
  ),
}));
function mount({ pilotMode = false, locale = 'en' } = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en}>
      <RevenHome pilotMode={pilotMode} />
    </NextIntlClientProvider>,
  );
}

describe('public home handoffs and controls', () => {
  it('sends new visitors to signup and existing users into the protected workspace', () => {
    mount();
    expect(
      screen
        .getAllByRole('link', { name: 'Create your workspace' })
        .every((link) => link.getAttribute('href') === '/sign-up'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: 'Open workspace' })
        .every((link) => link.getAttribute('href') === '/workspace'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'العربية' })).toHaveAttribute('href', '/ar');
  });
  it('sends pilot CTAs into the workspace instead of starting account setup', () => {
    mount({ pilotMode: true });
    expect(
      screen
        .getAllByRole('link', { name: 'Try the pilot' })
        .every((link) => link.getAttribute('href') === '/workspace'),
    ).toBe(true);
    expect(document.querySelector('a[href="/sign-up"]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create your workspace' })).toBeNull();
    expect(
      screen.getByText('Explore a shared demo workspace. No account needed.'),
    ).toBeInTheDocument();
  });
  it('supports keyboard exploration with a linked, focusable tab panel', () => {
    mount();
    const first = screen.getByRole('tab', { name: /Partnerships/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const selected = screen.getByRole('tab', { name: /Joint work/ });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', selected.id);
    expect(
      within(screen.getByRole('tabpanel')).getByRole('heading', {
        name: 'Turn a plan into assigned work.',
      }),
    ).toBeInTheDocument();
    fireEvent.keyDown(selected, { key: 'End' });
    expect(screen.getByRole('tab', { name: /Evidence & results/ })).toHaveFocus();
  });
  it('pauses and resumes all decorative scene motion', () => {
    const { container } = mount();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pause motion' })[0]!);
    expect(container.firstChild).toHaveAttribute('data-motion', 'off');
    expect(screen.getAllByRole('button', { name: 'Resume motion' })[0]!).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Resume motion' })[0]!);
    expect(container.firstChild).toHaveAttribute('data-motion', 'on');
  });
  it('closes mobile navigation after selecting a section and on Escape', () => {
    mount();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(trigger);
    fireEvent.click(
      within(document.getElementById('home-mobile-nav')!).getByRole('link', {
        name: 'How it works',
      }),
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.keyDown(document.getElementById('home-mobile-nav')!, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });
  it('renders Arabic content and switches back to the English homepage', () => {
    mount({ locale: 'ar' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('شراكاتك.');
    expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('tab', { name: /الشراكات/ })).toBeInTheDocument();
  });
});
