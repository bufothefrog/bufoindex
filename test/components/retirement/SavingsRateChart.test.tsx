/**
 * The Savings Rate Impact chart's two marker labels at phone width: the
 * dashed current-rate line separates "Your savings rate" from "Retire at N"
 * and crosses neither, whether the planned-age dot sits under the line or
 * over it.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveContainer } from 'recharts';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SavingsRateChart from '@/app/tools/retirement-calculator/components/SavingsRateChart';
import type { SavingsRateMarkerInputs } from '@/app/tools/retirement-calculator/components/savingsRateMarkers';

// The plot inside a 390 px page: 16 px gutters and the card padding.
const WIDTH = 326;
const HEIGHT = 300;

// $2,000 x 12 / $100,000 = 24%; retiring at 60 needs about 10%, at 45 more
// than 24% (savingsRateMarkers.test.ts).
const BASE: SavingsRateMarkerInputs = {
  startingAge: 25,
  targetIncome: 80000,
  startingBalance: 10000,
  accumulationReturn: 0.08,
  currentIncome: 100000,
  monthlySavings: 2000,
  retirementAge: 60,
};

function draw(inputs: SavingsRateMarkerInputs) {
  const { container } = render(
    <ThemeProvider>
      <ResponsiveContainer width={WIDTH} height={HEIGHT}>
        <SavingsRateChart inputs={inputs} />
      </ResponsiveContainer>
    </ThemeProvider>
  );
  // The vertical extent of a label: Recharts sets the baseline at y plus the
  // tspan's dy (in em of the 12 px font); the glyphs reach about 0.71 em
  // above the baseline (the cap height Recharts itself assumes) and 0.25 em
  // below it.
  const textBox = (name: RegExp) => {
    const tspan = screen.getByText(name);
    const node = tspan.closest('text');
    if (!node) throw new Error(`no text for ${name}`);
    const fontSize = Number(node.getAttribute('font-size'));
    const baseline = Number(node.getAttribute('y')) + parseFloat(tspan.getAttribute('dy') ?? '0') * fontSize;
    return { top: baseline - 0.71 * fontSize, bottom: baseline + 0.25 * fontSize };
  };
  const line = container.querySelector('.recharts-reference-line line');
  const dot = container.querySelector('.recharts-reference-dot circle');
  if (!line || !dot) throw new Error('markers not drawn');
  return {
    lineY: Number(line.getAttribute('y1')),
    dotY: Number(dot.getAttribute('cy')),
    rateLabel: textBox(/^Your savings rate/),
    dotLabel: textBox(/^Retire at/),
  };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SavingsRateChart marker labels', () => {
  it('put the dot label below a dot under the line, and the rate label above the line', () => {
    const y = draw(BASE);
    // SVG y grows downward: under the line means a larger y.
    expect(y.dotY).toBeGreaterThan(y.lineY);
    expect(y.dotLabel.top).toBeGreaterThan(y.dotY);
    expect(y.rateLabel.bottom).toBeLessThan(y.lineY);
  });

  it('put the dot label above a dot over the line, and the rate label below the line', () => {
    const y = draw({ ...BASE, retirementAge: 45 });
    expect(y.dotY).toBeLessThan(y.lineY);
    expect(y.dotLabel.bottom).toBeLessThan(y.dotY);
    expect(y.rateLabel.top).toBeGreaterThan(y.lineY);
  });

  it('keep both labels clear of the line when the dot sits just under it', () => {
    // Retiring at 51 needs a little less than the 24% saved, so the dot is a
    // few pixels under the dashed line.
    const y = draw({ ...BASE, retirementAge: 51 });
    expect(y.dotY).toBeGreaterThan(y.lineY);
    expect(y.dotY - y.lineY).toBeLessThan(20);
    expect(y.rateLabel.bottom).toBeLessThan(y.lineY);
    expect(y.dotLabel.top).toBeGreaterThan(y.lineY);
  });
});
