import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from '@/src/components/PasswordInput';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);

describe('password visibility', () => {
  it('reveals and hides the entered password without clearing it', () => {
    render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" defaultValue="my-entered-password" />
      </>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('my-entered-password');
    fireEvent.click(screen.getByRole('button', { name: 'hidePassword' }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('keeps the error description and never submits the form', () => {
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <PasswordInput
          id="password"
          aria-label="Password"
          aria-describedby="password-error"
          invalid
        />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'password-error');
    expect(submit).not.toHaveBeenCalled();
  });
});
