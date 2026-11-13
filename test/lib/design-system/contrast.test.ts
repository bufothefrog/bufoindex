/**
 * WCAG contrast of the negative text token (app/globals.css).
 *
 * The helper below lives in this test only: it reads the HSL tokens of the
 * light and dark blocks, converts them to sRGB and applies the WCAG 2
 * relative-luminance formula. It guards the pairs the --negative token was
 * added for: red text on the dark background, card and muted surfaces at
 * 4.5:1 or more, the filled destructive pair untouched, and light mode
 * unchanged.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Rgb = readonly [number, number, number];

const css = readFileSync(resolve(__dirname, '../../../app/globals.css'), 'utf8');

/** The declarations of the first block whose selector list ends in `selector {`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  return css.slice(start, css.indexOf('}', start));
}

/** A token's "H S% L%" value in a block. */
function token(blockText: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(blockText);
  if (!match) throw new Error(`no --${name} token`);
  return match[1].trim();
}

function hslToRgb(value: string): Rgb {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over blend of `fg` at `alpha` on `bg` (a bg-destructive/10 tint). */
function mix(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as unknown as Rgb;
}

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 6);
    expect(contrast([1, 1, 1], [1, 1, 1])).toBeCloseTo(1, 6);
    // #767676 on white is the classic 4.54:1 grey.
    const grey = 0x76 / 255;
    expect(contrast([grey, grey, grey], [1, 1, 1])).toBeCloseTo(4.54, 2);
  });

  it('converts HSL like the browser does', () => {
    const [r, g, b] = hslToRgb('0 100% 50%');
    expect(r).toBeCloseTo(1, 6);
    expect(g).toBeCloseTo(0, 6);
    expect(b).toBeCloseTo(0, 6);
  });
});

describe('negative text token', () => {
  const dark = block('.dark');
  const light = block(':root,\n  .light');
  const darkRgb = (name: string) => hslToRgb(token(dark, name));

  it.each(['background', 'card', 'muted'])('reads at 4.5:1 or more on the dark %s surface', (surface) => {
    expect(contrast(darkRgb('negative'), darkRgb(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it('reads at 4.5:1 or more on the negative tint over the dark card', () => {
    const tint = mix(darkRgb('destructive'), darkRgb('card'), 0.1);
    expect(contrast(darkRgb('negative'), tint)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves the filled destructive pair at 4.5:1 or more in dark mode', () => {
    expect(contrast(darkRgb('destructive-foreground'), darkRgb('destructive'))).toBeGreaterThanOrEqual(4.5);
  });

  it('is the destructive color in light mode, so light mode does not change', () => {
    expect(token(light, 'negative')).toBe(token(light, 'destructive'));
  });
});
