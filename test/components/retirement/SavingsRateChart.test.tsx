/**
 * The Savings Rate Impact chart's two marker labels at phone width: the
 * dashed current-rate line separates "Your savings rate" from "Retire at N"
 * and crosses neither, whether the planned-age dot sits under the line or
 * over it. The planned-age label stays above the x-axis line (so clear of
 * the tick labels) and inside the SVG at every plotted age, at both phone
 * widths and at desktop width.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveContainer } from 'recharts';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SavingsRateChart from '@/app/tools/retirement-calculator/components/SavingsRateChart';
import type { SavingsRateMarkerInputs } from '@/app/tools/retirement-calculator/components/savingsRateMarkers';

// The plot inside a 390 px page: 16 px gutters and the card padding; the
// plot inside a 360 px page; a desktop plot. ChartFrame's tall height is h-96.
const WIDTH = 326;
const NARROW_WIDTH = 296;
const DESKTOP_WIDTH = 900;
const HEIGHT = 300;
const TALL_HEIGHT = 384;
// A generous average glyph width for the 12 px label font, in em (the same
// estimate the placement helper uses, so a label that passes here has room
// for its real, narrower text).
const CHAR_EM = 0.6;

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

function draw(inputs: SavingsRateMarkerInputs, width = WIDTH, height = HEIGHT) {
  const { container } = render(
    <ThemeProvider>
      <ResponsiveContainer width={width} height={height}>
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
    const x = Number(node.getAttribute('x'));
    const w = (tspan.textContent ?? '').length * CHAR_EM * fontSize;
    const anchor = node.getAttribute('text-anchor') ?? 'start';
    const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    return { top: baseline - 0.71 * fontSize, bottom: baseline + 0.25 * fontSize, left, right: left + w };
  };
  const line = container.querySelector('.recharts-reference-line line');
  const dot = container.querySelector('.recharts-reference-dot circle');
  const axis = container.querySelector('.recharts-xAxis .recharts-cartesian-axis-line');
  if (!line || !dot || !axis) throw new Error('markers not drawn');
  return {
    axisY: Number(axis.getAttribute('y1')),
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

  // Retiring at 70 needs about 2% (savingsRateMarkers.test.ts), so the dot
  // sits on the x-axis at the right edge of the plot.
  it('keep the label at the last plotted age above the axis and inside the chart', () => {
    const y = draw({ ...BASE, retirementAge: 70 });
    expect(y.dotLabel.bottom).toBeLessThan(y.axisY);
    expect(y.dotLabel.left).toBeGreaterThanOrEqual(0);
    expect(y.dotLabel.right).toBeLessThanOrEqual(WIDTH);
    expect(y.dotLabel.bottom <= y.lineY || y.dotLabel.top >= y.lineY).toBe(true);
  });

  it('keep the label at the first plotted age above the axis and inside the chart', () => {
    // A $2,000,000 starting balance needs no further savings at any age, so
    // the dot sits on the x-axis at the left edge of the plot, under the line.
    for (const startingBalance of [BASE.startingBalance, 2000000]) {
      const y = draw({ ...BASE, startingBalance, retirementAge: 45 });
      expect(y.dotLabel.bottom).toBeLessThan(y.axisY);
      expect(y.dotLabel.left).toBeGreaterThanOrEqual(0);
      expect(y.dotLabel.right).toBeLessThanOrEqual(WIDTH);
      expect(y.dotLabel.bottom <= y.lineY || y.dotLabel.top >= y.lineY).toBe(true);
      cleanup();
    }
  });

  // Savings of $0 (the line on the axis), 2.4%, 24% and 60% of income, and a
  // starting balance that makes the late ages need nothing.
  const PROFILES: Array<[string, Partial<SavingsRateMarkerInputs>]> = [
    ['no savings', { monthlySavings: 0 }],
    ['2.4% saved', { monthlySavings: 200 }],
    ['24% saved', {}],
    ['60% saved', { monthlySavings: 5000 }],
    ['a funded late curve', { startingBalance: 400000 }],
  ];
  const AGES = Array.from({ length: 26 }, (_, i) => 45 + i);

  describe.each([
    ['390 px page', WIDTH],
    ['360 px page', NARROW_WIDTH],
    ['desktop', DESKTOP_WIDTH],
  ])('at every plotted age on a %s', (_page, width) => {
    describe.each(PROFILES)('with %s', (_name, change) => {
      it.each(AGES)('retiring at %i', retirementAge => {
        const y = draw({ ...BASE, ...change, retirementAge }, width, TALL_HEIGHT);
        // (a) above the x-axis line, so clear of it and of the tick labels.
        expect(y.dotLabel.bottom).toBeLessThan(y.axisY);
        // (b) inside the SVG.
        expect(y.dotLabel.left).toBeGreaterThanOrEqual(0);
        expect(y.dotLabel.right).toBeLessThanOrEqual(width);
        expect(y.dotLabel.top).toBeGreaterThanOrEqual(0);
        // (c) off the dashed line and off its label.
        expect(y.dotLabel.bottom <= y.lineY - 1 || y.dotLabel.top >= y.lineY + 1).toBe(true);
        const apart =
          y.dotLabel.right <= y.rateLabel.left ||
          y.rateLabel.right <= y.dotLabel.left ||
          y.dotLabel.bottom <= y.rateLabel.top ||
          y.rateLabel.bottom <= y.dotLabel.top;
        expect(apart).toBe(true);
      });
    });
  });
});
