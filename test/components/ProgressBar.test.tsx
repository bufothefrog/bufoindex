/**
 * ProgressBar exposes role="progressbar" with its value range and an
 * accessible name, and clamps a value outside the range.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ProgressBar } from '@/components/ui/progress-bar';

afterEach(() => {
  cleanup();
});

describe('ProgressBar', () => {
  it('is a named progressbar with its value range', () => {
    render(<ProgressBar label="Profile fields answered" value={3} max={8} valueText="3 of 8 answered" />);

    const bar = screen.getByRole('progressbar', { name: 'Profile fields answered' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '8');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 8 answered');
  });

  it('defaults to a 0 to 100 range without a value text', () => {
    render(<ProgressBar label="Optimization progress" value={40} tone="info" />);

    const bar = screen.getByRole('progressbar', { name: 'Optimization progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).not.toHaveAttribute('aria-valuetext');
  });

  it.each([
    [-5, '0'],
    [12, '10'],
  ])('clamps %d into the range', (value, expected) => {
    render(<ProgressBar label="Steps" value={value} max={10} />);
    expect(screen.getByRole('progressbar', { name: 'Steps' })).toHaveAttribute('aria-valuenow', expected);
  });

  it('fills the share of the range that is done', () => {
    render(<ProgressBar label="Steps" value={3} max={8} />);
    // 3 / 8 = 37.5%, rounded to 38%.
    const fill = screen.getByRole('progressbar', { name: 'Steps' }).firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('38%');
  });

  it('shows an empty bar for an empty range', () => {
    render(<ProgressBar label="Steps" value={0} max={0} />);
    const fill = screen.getByRole('progressbar', { name: 'Steps' }).firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
