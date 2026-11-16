import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { WorkspaceMotion, MotionControl } from '@/src/components/WorkspaceMotion';
import messages from '../messages/en.json';

let reduced = false;
let notify: (() => void) | undefined;
function mount(initialEnabled = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduced,
      addEventListener: (_: string, listener: () => void) => {
        notify = listener;
      },
      removeEventListener: vi.fn(),
    })),
  );
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkspaceMotion initialEnabled={initialEnabled}>
        <MotionControl />
        <MotionControl compact />
      </WorkspaceMotion>
    </NextIntlClientProvider>,
  );
}
afterEach(() => {
  reduced = false;
  notify = undefined;
  vi.unstubAllGlobals();
  document.cookie = 'reven_motion=; Path=/; Max-Age=0';
});

describe('workspace motion preferences', () => {
  it('pauses both controls, persists the choice and covers portal animations', () => {
    mount();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pause motion' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Resume motion' })).toHaveLength(2);
    expect(document.cookie).toContain('reven_motion=off');
    expect(document.documentElement.dataset.workspaceMotion).toBe('off');
    fireEvent.click(screen.getAllByRole('button', { name: 'Resume motion' })[1]!);
    expect(document.cookie).toContain('reven_motion=on');
  });
  it('starts paused from the server preference without waiting for storage', () => {
    mount(false);
    expect(screen.getAllByRole('button', { name: 'Resume motion' })).toHaveLength(2);
    expect(document.querySelector('[data-motion="off"]')).toBeInTheDocument();
  });
  it('respects device reduced motion, including changes during the session', () => {
    mount();
    act(() => {
      reduced = true;
      notify?.();
    });
    expect(
      screen.getAllByRole('button', { name: 'Motion reduced by your device setting' })[0],
    ).toBeDisabled();
    expect(document.documentElement.dataset.workspaceMotion).toBe('off');
    act(() => {
      reduced = false;
      notify?.();
    });
    expect(screen.getAllByRole('button', { name: 'Pause motion' })[0]!).toBeEnabled();
  });
});
