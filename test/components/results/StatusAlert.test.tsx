/**
 * StatusAlert takes a `tone` from the shared scale.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertTriangle } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';

describe('StatusAlert', () => {
  it('shows the title and the body', () => {
    render(
      <StatusAlert tone="caution" icon={AlertTriangle} title="Leveraged ETF risk">
        Daily reset funds can lose most of their value.
      </StatusAlert>
    );

    expect(screen.getByText('Leveraged ETF risk')).toBeInTheDocument();
    expect(screen.getByText('Daily reset funds can lose most of their value.')).toBeInTheDocument();
  });

  it('renders a tinted alert with the given role and test id', () => {
    render(
      <StatusAlert tone="caution" appearance="tinted" role="alert" testId="tax-event-warning">
        This plan sells $1,200 in taxable accounts.
      </StatusAlert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This plan sells $1,200 in taxable accounts.');
    expect(alert).toBe(screen.getByTestId('tax-event-warning'));
  });

  it('has no role unless one is given', () => {
    render(<StatusAlert tone="info">Note</StatusAlert>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
