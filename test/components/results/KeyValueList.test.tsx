import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Wallet } from 'lucide-react';
import { KeyValueList } from '@/components/ui/results';
import { BreakdownRow } from '@/components/calculators/shared/BreakdownRow';
import { TONE_TEXT } from '@/lib/design-system/tone';

describe('KeyValueList', () => {
  it('renders a dl of dt/dd pairs', () => {
    const { container } = render(
      <KeyValueList
        label="Monthly breakdown"
        appearance="divided"
        items={[
          { label: 'Gross pay', value: '$8,000', subtitle: 'Before taxes', icon: Wallet },
          { id: 'tax', label: 'Taxes', value: '$1,900', prefix: '-', tone: 'negative' },
        ]}
      />
    );
    const list = container.querySelector('dl');
    expect(list).toHaveAttribute('aria-label', 'Monthly breakdown');
    const terms = list!.querySelectorAll('dt');
    const details = list!.querySelectorAll('dd');
    expect(terms).toHaveLength(2);
    expect(details).toHaveLength(2);
    expect(terms[0]).toHaveTextContent('Gross pay');
    expect(terms[0]).toHaveTextContent('Before taxes');
    expect(details[0]).toHaveTextContent('$8,000');
    expect(details[1]).toHaveTextContent('-$1,900');
    expect(details[1]).toHaveClass(TONE_TEXT.negative);
    expect(details[0]).toHaveClass(TONE_TEXT.neutral);
  });

  it('accepts non-string labels', () => {
    render(<KeyValueList appearance="plain" items={[{ label: <em>Rate</em>, value: '4%' }]} />);
    expect(screen.getByText('Rate').closest('dt')).not.toBeNull();
  });
});

describe('BreakdownRow', () => {
  it('renders one dt/dd row inside its own dl', () => {
    const { container } = render(<BreakdownRow label="Emergency fund" subtitle="3 months" value="$500" prefix="+" />);
    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    expect(within(list!).getByText('Emergency fund').closest('dt')).not.toBeNull();
    expect(list!.querySelector('dd')).toHaveTextContent('+$500');
  });

  it('maps the deprecated variant onto tone, and tone wins', () => {
    const { container, rerender } = render(<BreakdownRow label="A" value="1" variant="danger" />);
    expect(container.querySelector('dd')).toHaveClass(TONE_TEXT.negative);
    rerender(<BreakdownRow label="A" value="1" variant="danger" tone="info" />);
    expect(container.querySelector('dd')).toHaveClass(TONE_TEXT.info);
    rerender(<BreakdownRow label="A" value="1" variant="success" />);
    expect(container.querySelector('dd')).toHaveClass(TONE_TEXT.positive);
  });
});
