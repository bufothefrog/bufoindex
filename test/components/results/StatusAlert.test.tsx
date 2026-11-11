/**
 * StatusAlert and BreakdownRow take a `tone` from the shared scale and keep
 * accepting their legacy `variant`, which must render exactly what the same
 * tone renders, so every existing caller is unchanged.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';
import type { Tone } from '@/lib/design-system/tone';

afterEach(() => {
  cleanup();
});

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

  it.each<['info' | 'warning' | 'danger' | 'success', Tone]>([
    ['info', 'info'],
    ['warning', 'caution'],
    ['danger', 'negative'],
    ['success', 'positive'],
  ])('renders variant="%s" exactly as tone="%s"', (variant, tone) => {
    const legacy = render(
      <StatusAlert variant={variant} icon={AlertTriangle} title="Title">
        Body
      </StatusAlert>
    );
    const legacyHtml = legacy.container.innerHTML;
    legacy.unmount();

    const toned = render(
      <StatusAlert tone={tone} icon={AlertTriangle} title="Title">
        Body
      </StatusAlert>
    );
    expect(toned.container.innerHTML).toBe(legacyHtml);
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

describe('BreakdownRow', () => {
  it('shows the label, subtitle and prefixed value', () => {
    render(<BreakdownRow icon={DollarSign} label="Impact" subtitle="per paycheck" value="$45" prefix="+" tone="positive" />);

    expect(screen.getByText('Impact')).toBeInTheDocument();
    expect(screen.getByText('per paycheck')).toBeInTheDocument();
    expect(screen.getByText('+$45')).toBeInTheDocument();
  });

  it('stays outside description-list semantics so it can sit anywhere', () => {
    render(<BreakdownRow label="Expense ratio" value="0.95%" />);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(screen.queryByRole('definition')).not.toBeInTheDocument();
  });

  it.each<['default' | 'success' | 'warning' | 'danger' | 'info', Tone]>([
    ['default', 'neutral'],
    ['success', 'positive'],
    ['warning', 'caution'],
    ['danger', 'negative'],
    ['info', 'info'],
  ])('renders variant="%s" exactly as tone="%s"', (variant, tone) => {
    const legacy = render(<BreakdownRow label="Row" value={12} variant={variant} />);
    const legacyHtml = legacy.container.innerHTML;
    legacy.unmount();

    const toned = render(<BreakdownRow label="Row" value={12} tone={tone} />);
    expect(toned.container.innerHTML).toBe(legacyHtml);
  });
});
