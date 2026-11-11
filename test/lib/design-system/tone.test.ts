/**
 * Tests for the tone scale (lib/design-system/tone.ts) and the stat value
 * formatter (lib/design-system/stat.ts).
 *
 * The class maps are the single place a tone turns into Tailwind classes, so
 * they are pinned here, at the lib level, and component tests never pin them.
 */

import { describe, expect, it } from 'vitest';
import {
  TONES,
  TONE_BORDER,
  TONE_FILL,
  TONE_SURFACE,
  TONE_TEXT,
  toneFromLegacy,
  type LegacyTone,
  type Tone,
} from '@/lib/design-system/tone';
import { MISSING_VALUE, formatStatValue } from '@/lib/design-system/stat';

describe('tone class maps', () => {
  it('lists every tone once', () => {
    expect(TONES).toEqual(['neutral', 'positive', 'caution', 'negative', 'info', 'brand']);
  });

  it.each<[Tone, string, string, string, string]>([
    ['neutral', 'text-foreground', 'border-border', 'bg-muted/40', 'bg-muted-foreground'],
    ['positive', 'text-success', 'border-success/30', 'bg-success/10', 'bg-success'],
    ['caution', 'text-warning', 'border-warning/30', 'bg-warning/10', 'bg-warning'],
    ['negative', 'text-destructive', 'border-destructive/30', 'bg-destructive/10', 'bg-destructive'],
    ['info', 'text-info', 'border-info/30', 'bg-info/10', 'bg-info'],
    [
      'brand',
      'text-sage-700 dark:text-sage-300',
      'border-sage-400 dark:border-sage-500',
      'bg-sage-50 dark:bg-sage-800/50',
      'bg-sage-500 dark:bg-sage-400',
    ],
  ])('maps %s to its text, border, surface and fill classes', (tone, text, border, surface, fill) => {
    expect(TONE_TEXT[tone]).toBe(text);
    expect(TONE_BORDER[tone]).toBe(border);
    expect(TONE_SURFACE[tone]).toBe(surface);
    expect(TONE_FILL[tone]).toBe(fill);
  });

  it('uses only semantic tokens or the sage scale with a dark-mode pair', () => {
    const classes = TONES.flatMap((tone) =>
      [TONE_TEXT, TONE_BORDER, TONE_SURFACE, TONE_FILL].flatMap((map) => map[tone].split(' '))
    );
    const semantic = /^(dark:)?(text|border|bg)-(foreground|border|muted|muted-foreground|success|warning|destructive|info|sage-\d{2,3})(\/\d+)?$/;
    for (const cls of classes) {
      expect(cls).toMatch(semantic);
    }
    for (const map of [TONE_TEXT, TONE_BORDER, TONE_SURFACE, TONE_FILL]) {
      expect(map.brand).toContain('dark:');
    }
  });
});

describe('toneFromLegacy', () => {
  it.each<[LegacyTone, Tone]>([
    ['default', 'neutral'],
    ['neutral', 'neutral'],
    ['success', 'positive'],
    ['up', 'positive'],
    ['warning', 'caution'],
    ['danger', 'negative'],
    ['error', 'negative'],
    ['down', 'negative'],
    ['info', 'info'],
    ['sage', 'brand'],
    ['emphasis', 'brand'],
    ['selected', 'brand'],
  ])('maps the legacy name %s to %s', (legacy, tone) => {
    expect(toneFromLegacy(legacy)).toBe(tone);
  });

  it('keeps the legacy alert and row colors: danger is text-destructive, warning is text-warning', () => {
    expect(TONE_TEXT[toneFromLegacy('danger')]).toBe('text-destructive');
    expect(TONE_TEXT[toneFromLegacy('warning')]).toBe('text-warning');
    expect(TONE_TEXT[toneFromLegacy('success')]).toBe('text-success');
    expect(TONE_TEXT[toneFromLegacy('default')]).toBe('text-foreground');
  });
});

describe('formatStatValue', () => {
  it('formats through formatValue', () => {
    expect(formatStatValue(1234.4, 'currency')).toBe('$1,234');
    expect(formatStatValue(0.0725, 'percent')).toBe('7.3%');
    expect(formatStatValue(2.25, 'multiple')).toBe('2.25x');
    expect(formatStatValue(-59300, 'currency-compact-signed')).toBe('\u2212$59.3k');
  });

  it('prints an em dash for a missing or non-finite value', () => {
    expect(MISSING_VALUE).toBe('\u2014');
    expect(formatStatValue(null, 'currency')).toBe('\u2014');
    expect(formatStatValue(Number.NaN, 'percent')).toBe('\u2014');
    expect(formatStatValue(Number.POSITIVE_INFINITY, 'count')).toBe('\u2014');
  });
});
