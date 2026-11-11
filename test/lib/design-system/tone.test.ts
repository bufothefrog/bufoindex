import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TONES,
  TONE_TEXT,
  TONE_BORDER,
  TONE_SURFACE,
  TONE_FILL,
  isTone,
  toneFromLegacy,
  type LegacyTone,
} from '@/lib/design-system/tone';
import { findStat, formatStat, type StatSpec } from '@/lib/design-system/stat';

describe('tone scale', () => {
  it('has a class for every tone in every map', () => {
    for (const map of [TONE_TEXT, TONE_BORDER, TONE_SURFACE, TONE_FILL]) {
      expect(Object.keys(map).sort()).toEqual([...TONES].sort());
      for (const tone of TONES) expect(map[tone].length).toBeGreaterThan(0);
    }
  });

  it('uses no hardcoded palette colors', () => {
    const all = [TONE_TEXT, TONE_BORDER, TONE_SURFACE, TONE_FILL].flatMap((map) => Object.values(map)).join(' ');
    expect(all).not.toMatch(/#[0-9a-f]{3,6}\b|(blue|gray|green|red|amber|yellow|slate)-\d/i);
  });

  it('maps every legacy spelling onto the scale', () => {
    const cases: Array<[LegacyTone, string]> = [
      ['default', 'neutral'],
      ['success', 'positive'],
      ['warning', 'caution'],
      ['danger', 'negative'],
      ['error', 'negative'],
      ['destructive', 'negative'],
      ['sage', 'brand'],
      ['primary', 'brand'],
      ['up', 'positive'],
      ['down', 'negative'],
      ['good', 'positive'],
      ['bad', 'negative'],
      ['info', 'info'],
      ['caution', 'caution'],
    ];
    for (const [legacy, tone] of cases) expect(toneFromLegacy(legacy)).toBe(tone);
  });

  it('falls back for missing or unknown values', () => {
    expect(toneFromLegacy(undefined)).toBe('neutral');
    expect(toneFromLegacy(null, 'info')).toBe('info');
    expect(toneFromLegacy('bogus' as LegacyTone, 'caution')).toBe('caution');
  });

  it('recognizes tones', () => {
    expect(isTone('brand')).toBe(true);
    expect(isTone('success')).toBe(false);
    expect(isTone(3)).toBe(false);
  });
});

describe('StatSpec helpers', () => {
  const specs: StatSpec[] = [
    { id: 'rate', label: 'Success rate', value: 0.874, format: 'percent' },
    { id: 'balance', label: 'Balance', value: null, format: 'currency' },
  ];

  it('formats through formatValue', () => {
    expect(formatStat(specs[0])).toBe('87.4%');
    expect(formatStat({ value: 1234.5, format: 'currency' })).toBe('$1,235');
    expect(formatStat(specs[1])).toBe('—');
  });

  it('finds a spec by id', () => {
    expect(findStat(specs, 'balance')?.label).toBe('Balance');
    expect(findStat(specs, 'missing')).toBeUndefined();
  });
});

/** Parses one theme block of app/globals.css into { token: [h, s, l] }. */
function readTheme(selector: RegExp): Record<string, [number, number, number]> {
  const css = readFileSync(resolve(__dirname, '../../../app/globals.css'), 'utf8');
  const block = css.match(selector)?.[1] ?? '';
  const tokens: Record<string, [number, number, number]> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

function luminance([h, s, l]: [number, number, number]): number {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('tone text contrast (app/globals.css)', () => {
  const themes = {
    light: readTheme(/:root,\s*\.light\s*\{([^}]*)\}/),
    dark: readTheme(/\.dark\s*\{([^}]*)\}/),
  };
  const textTokens = ['primary-text', 'success-text', 'warning-text', 'destructive-text', 'info-text', 'muted-foreground'];

  it('maps status tones to text-* utilities backed by text tokens', () => {
    const css = readFileSync(resolve(__dirname, '../../../app/globals.css'), 'utf8');
    for (const name of ['success', 'warning', 'destructive', 'info']) {
      expect(css).toContain(`--text-color-${name}: hsl(var(--${name}-text));`);
    }
  });

  for (const [theme, tokens] of Object.entries(themes)) {
    for (const token of textTokens) {
      it(`${theme} --${token} is at least 4.5:1 on background, card and muted`, () => {
        expect(tokens[token]).toBeDefined();
        for (const surface of ['background', 'card', 'muted']) {
          expect(tokens[surface]).toBeDefined();
          expect(contrast(tokens[token], tokens[surface])).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});
