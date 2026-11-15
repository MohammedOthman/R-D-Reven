import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { DataTable } from '../src/components/DataTable/DataTable';
import { FormField } from '../src/components/FormField/FormField';
import { Input } from '../src/components/Input/Input';

afterEach(cleanup);

describe('workspace interactions', () => {
  it('exposes the primary row action as a keyboard-focusable button', () => {
    const open = vi.fn();
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name' }]}
        data={[{ id: '1', name: 'Review evidence' }]}
        getRowId={(row) => row.id}
        onRowClick={open}
      />,
    );
    const action = screen.getByRole('button', { name: 'Review evidence' });
    action.focus();
    expect(action).toHaveFocus();
    fireEvent.click(action);
    expect(open).toHaveBeenCalledExactlyOnceWith({ id: '1', name: 'Review evidence' });
  });

  it('keeps secondary row controls from also opening the row', () => {
    const open = vi.fn();
    const archive = vi.fn();
    render(
      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          {
            key: 'action',
            header: 'Action',
            render: () => <button onClick={archive}>Archive</button>,
          },
        ]}
        data={[{ id: '1', name: 'Partner' }]}
        getRowId={(row) => row.id}
        onRowClick={open}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archive).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('announces sorting on the column header', () => {
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name', sortable: true }]}
        data={[]}
        getRowId={() => '1'}
        sortKey="name"
        sortDirection="desc"
        onSortChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  it('associates a field error with its input while keeping existing descriptions', () => {
    render(
      <FormField id="email" label="Email" error="Enter your email">
        <Input id="email" aria-describedby="privacy" />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-describedby',
      'privacy email-error',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email');
  });

  it('associates hints with inputs before an error occurs', () => {
    render(
      <FormField id="password" label="Password" hint="At least 12 characters">
        <Input id="password" />
      </FormField>,
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'password-hint');
  });
});
