import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatTile, StatGrid } from '@/components/ui/results';
import { TONE_TEXT } from '@/lib/design-system/tone';
import type { StatSpec } from '@/lib/design-system/stat';

describe('StatTile', () => {
  it('is a group named by its label with the value, hint and badge', () => {
    render(<StatTile label="Projected at retirement" value="$1,234,567" hint="Today's dollars" badge="Active" />);
    const tile = screen.getByRole('group', { name: 'Projected at retirement' });
    expect(within(tile).getByText('$1,234,567')).toBeInTheDocument();
    expect(within(tile).getByText("Today's dollars")).toBeInTheDocument();
    expect(within(tile).getByText('Active')).toBeInTheDocument();
  });

  it('colors the value by tone', () => {
    render(<StatTile label="Shortfall" value="−$4k" tone="negative" />);
    expect(screen.getByText('−$4k')).toHaveClass(TONE_TEXT.negative);
    expect(screen.getByRole('group', { name: 'Shortfall' })).toHaveAttribute('data-tone', 'negative');
  });

  it('defaults to the neutral tone', () => {
    render(<StatTile label="Total" value="$10" />);
    expect(screen.getByText('$10')).toHaveClass(TONE_TEXT.neutral);
  });

  it('keeps the label and hides the value while loading', () => {
    render(<StatTile label="Simulated success rate" value="87%" loading align="center" size="lg" emphasis />);
    const tile = screen.getByRole('group', { name: 'Simulated success rate' });
    expect(tile).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('87%')).not.toBeInTheDocument();
  });
});

describe('StatGrid', () => {
  const stats: StatSpec[] = [
    { id: 'rate', label: 'Success rate', value: 0.9, format: 'percent', tone: 'positive' },
    { id: 'balance', label: 'Balance', value: 578_000, format: 'currencyCompact', hint: 'Nominal' },
    { id: 'gap', label: 'Gap', value: null, format: 'currency' },
  ];

  it('renders one formatted tile per spec, in order', () => {
    render(<StatGrid stats={stats} label="Headline figures" columns={3} featureFirst emphasisId="balance" />);
    const grid = screen.getByRole('group', { name: 'Headline figures' });
    const tiles = within(grid).getAllByRole('group');
    expect(tiles).toHaveLength(3);
    expect(within(screen.getByRole('group', { name: 'Success rate' })).getByText('90%')).toHaveClass(TONE_TEXT.positive);
    expect(within(screen.getByRole('group', { name: 'Balance' })).getByText('$578k')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Gap' })).getByText('—')).toBeInTheDocument();
  });

  it('marks every tile busy while loading and renders children', () => {
    render(
      <StatGrid stats={stats} loading columns={4}>
        <StatTile label="Extra" value="1" />
      </StatGrid>
    );
    expect(screen.getByRole('group', { name: 'Success rate' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('90%')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Extra' })).toBeInTheDocument();
  });

  it('has no group role without a label', () => {
    const { container } = render(<StatGrid columns={1} />);
    expect(container.firstElementChild).not.toHaveAttribute('role');
  });
});
