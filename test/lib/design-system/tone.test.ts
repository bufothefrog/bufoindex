import { describe, it, expect } from 'vitest';
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
