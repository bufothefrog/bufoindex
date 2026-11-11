import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProgressBar, { progressShare } from '@/components/ui/progress-bar';
import { TONE_FILL } from '@/lib/design-system/tone';

describe('ProgressBar', () => {
  it('exposes progressbar ARIA values', () => {
    render(<ProgressBar label="Profile fields answered" value={12} max={30} valueText="12 of 30 fields answered" />);
    const bar = screen.getByRole('progressbar', { name: 'Profile fields answered' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '30');
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuetext', '12 of 30 fields answered');
    expect(bar.firstElementChild).toHaveStyle({ width: '40%' });
    expect(bar.firstElementChild).toHaveClass(TONE_FILL.brand);
  });

  it('clamps out-of-range values and applies the tone fill', () => {
    render(<ProgressBar label="Over" value={150} tone="caution" size="sm" />);
    const bar = screen.getByRole('progressbar', { name: 'Over' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.firstElementChild).toHaveClass(TONE_FILL.caution);
  });

  it('computes the share safely', () => {
    expect(progressShare(5, 0, 10)).toBe(0.5);
    expect(progressShare(-1, 0, 10)).toBe(0);
    expect(progressShare(5, 10, 10)).toBe(0);
    expect(progressShare(Number.NaN, 0, 10)).toBe(0);
  });
});
