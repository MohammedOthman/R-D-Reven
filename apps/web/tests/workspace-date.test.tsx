import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  WorkspaceDate,
  WorkspaceFormatProvider,
  formatWorkspaceDate,
} from '@/src/components/WorkspaceFormat';
vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
afterEach(cleanup);

describe('workspace dates', () => {
  it('uses the organization’s timezone across a UTC date boundary', () => {
    render(
      <WorkspaceFormatProvider timezone="Asia/Riyadh">
        <WorkspaceDate value="2026-11-15T23:30:00Z" />
      </WorkspaceFormatProvider>,
    );
    expect(screen.getByText('Nov 16, 2026')).toHaveAttribute('datetime', '2026-11-15T23:30:00Z');
  });
  it('formats Arabic dates in the selected language', () => {
    const result = formatWorkspaceDate('2026-11-15T12:00:00Z', 'ar', 'Asia/Riyadh');
    expect(result).toMatch(/[\u200f\u0660-\u0669]/);
    expect(result).not.toContain('Nov');
  });
  it('falls back to UTC for a previously saved invalid timezone', () => {
    expect(formatWorkspaceDate('2026-11-15T23:30:00Z', 'en', 'invalid/timezone')).toBe(
      'Nov 15, 2026',
    );
  });
  it('does not crash a workspace for an invalid date', () => {
    expect(formatWorkspaceDate('invalid', 'en', 'Asia/Riyadh')).toBe('—');
  });
});
