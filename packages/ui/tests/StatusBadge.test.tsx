import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../src/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders the given label verbatim', () => {
    render(<StatusBadge label="Verified" tone="positive" />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });
});
