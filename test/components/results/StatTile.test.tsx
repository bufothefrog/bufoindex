/**
 * StatTile and StatGrid render headline figures from StatSpec data. The
 * figure is formatted through formatValue, the tile is a group named by its
 * label, and `loading` keeps the label while the figure is computed.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatTile, StatGrid } from '@/components/ui/results';
import type { StatSpec } from '@/lib/design-system/stat';

describe('StatTile', () => {
  it('is a group named by its label that shows the formatted figure', () => {
    render(<StatTile label="Projected at retirement" value={1234567.8} format="currency" hint="Today's dollars" />);

    const tile = screen.getByRole('group', { name: 'Projected at retirement' });
    expect(within(tile).getByText('$1,234,568')).toBeInTheDocument();
    expect(within(tile).getByText("Today's dollars")).toBeInTheDocument();
  });

  it.each<[StatSpec['format'], number, string]>([
    ['percent', 0.8125, '81.3%'],
    ['currency-compact', 633_400, '$633k'],
    ['currency-signed', -54_800, '\u2212$54,800'],
    ['multiple', 2.25, '2.25x'],
    ['months', 6, '6 months'],
    ['count', 1000, '1,000'],
  ])('formats a %s value (%d -> %s)', (format, value, expected) => {
    render(<StatTile label="Figure" value={value} format={format} />);
    expect(within(screen.getByRole('group', { name: 'Figure' })).getByText(expected)).toBeInTheDocument();
  });

  it('prints an em dash when the value is null', () => {
    render(<StatTile label="Success rate" value={null} format="percent" />);
    expect(within(screen.getByRole('group', { name: 'Success rate' })).getByText('\u2014')).toBeInTheDocument();
  });

  it('shows the badge beside the label', () => {
    render(<StatTile label="Monthly to invest" value={500} format="currency" badge="Active" />);
    expect(within(screen.getByRole('group', { name: 'Monthly to invest' })).getByText('Active')).toBeInTheDocument();
  });

  it('keeps the label and hint while loading, and hides the figure', () => {
    render(<StatTile label="Simulated success rate" value={0.72} format="percent" hint="1,000 paths" loading />);

    const tile = screen.getByRole('group', { name: 'Simulated success rate' });
    expect(tile).toHaveAttribute('aria-busy', 'true');
    expect(within(tile).getByText('Loading')).toBeInTheDocument();
    expect(within(tile).getByText('1,000 paths')).toBeInTheDocument();
    expect(within(tile).queryByText('72%')).not.toBeInTheDocument();
  });

  it('is not marked busy once loaded', () => {
    render(<StatTile label="Rate" value={0.04} format="percent" size="lg" align="center" tone="caution" />);
    const tile = screen.getByRole('group', { name: 'Rate' });
    expect(tile).not.toHaveAttribute('aria-busy');
    expect(within(tile).getByText('4%')).toBeInTheDocument();
  });
});

describe('StatGrid', () => {
  const stats: StatSpec[] = [
    { id: 'success', label: 'Simulated success rate', value: 0.912, format: 'percent', tone: 'positive' },
    { id: 'projected', label: 'Projected at retirement', value: 1_250_000, format: 'currency', hint: "Today's dollars" },
    { id: 'required', label: 'Balance the 4% guideline implies', value: null, format: 'currency' },
  ];

  it('renders one named tile per stat, in order', () => {
    render(<StatGrid stats={stats} fullWidth={['success']} />);

    expect(screen.getAllByRole('group').map((tile) => tile.textContent)).toEqual([
      'Simulated success rate91.2%',
      "Projected at retirement$1,250,000Today's dollars",
      'Balance the 4% guideline implies\u2014',
    ]);
  });

  it('puts every tile in its loading state at once', () => {
    const { container } = render(<StatGrid stats={stats} columns={3} loading />);

    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    for (const stat of stats) {
      expect(screen.getByRole('group', { name: stat.label })).toHaveAttribute('aria-busy', 'true');
    }
    expect(screen.getAllByText('Loading')).toHaveLength(3);
    expect(screen.queryByText('91.2%')).not.toBeInTheDocument();
  });
});
