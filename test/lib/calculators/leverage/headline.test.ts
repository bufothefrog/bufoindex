/**
 * leverageHeadline: the three headline figures, labelled and formatted the
 * way the results header printed them before the rebuild (the figures below
 * are the seeded engine's at the default inputs, as the old SummaryCards
 * showed them), and the narrative figures the results print beside them.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DCA_COMPARISON_INPUTS,
  simulateDcaComparison,
  type DcaComparisonResult,
} from '@/lib/calculations/leverageComparison';
import { leverageHeadline } from '@/lib/calculators/leverage/headline';
import { dragParts, recoveryGain, relativeGap, yearsText } from '@/lib/calculators/leverage/narrative';
import { formatStatValue } from '@/lib/design-system/stat';

const shown = (result: DcaComparisonResult, inputs = DEFAULT_DCA_COMPARISON_INPUTS) =>
  leverageHeadline(result, inputs).map(({ id, label, value, format, hint }) => ({
    id,
    label,
    value: formatStatValue(value, format),
    hint,
  }));

describe('leverageHeadline', () => {
  it('shows both median ending balances and the share of paths behind, at the defaults', () => {
    const result = simulateDcaComparison(DEFAULT_DCA_COMPARISON_INPUTS);
    expect(shown(result)).toEqual([
      {
        id: 'index-median',
        label: 'Index fund, median ending balance',
        value: '$578,082',
        hint: '10th to 90th: $319k to $1.12M',
      },
      {
        id: 'leveraged-median',
        label: '2x fund, median ending balance',
        value: '$632,905',
        hint: '10th to 90th: $206k to $2.49M',
      },
      {
        id: 'behind',
        label: 'Paths where the 2x fund ends behind the index fund',
        value: '43%',
        hint: '$221,000 contributed to each over 20 years, 500 paths',
      },
    ]);
  });

  it('names the ratio and prints a fractional horizon to one decimal', () => {
    const inputs = { ...DEFAULT_DCA_COMPARISON_INPUTS, leverageRatio: 1.5, years: 7.5 };
    const [index, leveraged, behind] = shown(simulateDcaComparison(inputs), inputs);
    expect(index).toEqual({
      id: 'index-median',
      label: 'Index fund, median ending balance',
      value: '$123,816',
      hint: '10th to 90th: $86.2k to $174k',
    });
    expect(leveraged.label).toBe('1.5x fund, median ending balance');
    expect(leveraged.hint).toBe('10th to 90th: $73.7k to $212k');
    // 7.5 years: $900 x 90 months + $5,000 = $86,000.
    expect(behind).toEqual({
      id: 'behind',
      label: 'Paths where the 1.5x fund ends behind the index fund',
      value: '44%',
      hint: '$86,000 contributed to each over 7.5 years, 500 paths',
    });
  });

  it('prints the share behind as a whole percent, exactly as (p * 100).toFixed(0) did', () => {
    const result = simulateDcaComparison(DEFAULT_DCA_COMPARISON_INPUTS);
    for (let paths = 0; paths <= 500; paths += 1) {
      const p = paths / 500;
      const [, , behind] = shown({ ...result, probLeveragedBehindDca: p });
      expect(behind.value, String(p)).toBe(`${(p * 100).toFixed(0)}%`);
    }
    const [, , exact] = leverageHeadline({ ...result, probLeveragedBehindDca: 0.434 }, DEFAULT_DCA_COMPARISON_INPUTS);
    expect(exact.value).toBe(0.43);
    expect(exact.format).toBe('percent');
  });
});

describe('leverage narrative figures', () => {
  it('prints the gain that recovers a drawdown as a whole percent', () => {
    // 1 / (1 - 0.5) - 1 = 100%; 1 / (1 - 0.3409) - 1 = 51.7% -> "52%".
    expect(recoveryGain(0.5)).toBe('100%');
    expect(recoveryGain(0.3409159201764608)).toBe('52%');
    expect(recoveryGain(0)).toBe('0%');
    expect(recoveryGain(0.999)).toBe('more than 100,000%');
    expect(recoveryGain(1)).toBe('more than 100,000%');
  });

  it('splits the drag into volatility drag and financing', () => {
    // 2x, 16% volatility: (4 - 2) / 2 x 0.0256 = 0.0256; (2 - 1) x 4.5% = 0.045.
    const parts = dragParts({ leverageRatio: 2, indexVolatility: 0.16, financingRate: 0.045 });
    expect(parts.volatilityDrag).toBeCloseTo(0.0256, 12);
    expect(parts.financing).toBeCloseTo(0.045, 12);
    // 3x: (9 - 3) / 2 x 0.0256 = 0.0768; a negative volatility counts as 0.
    expect(dragParts({ leverageRatio: 3, indexVolatility: 0.16, financingRate: 0.045 }).volatilityDrag).toBeCloseTo(0.0768, 12);
    expect(dragParts({ leverageRatio: 3, indexVolatility: -0.1, financingRate: 0 })).toEqual({ volatilityDrag: 0, financing: 0 });
  });

  it('prints the horizon in whole years, or to one decimal', () => {
    expect(yearsText(240)).toBe('20');
    expect(yearsText(90)).toBe('7.5');
    expect(yearsText(13)).toBe('1.1');
  });

  it('measures a gap against its base, and as 0 without a positive base', () => {
    expect(relativeGap(50, 200)).toBe(0.25);
    expect(relativeGap(50, 0)).toBe(0);
    expect(relativeGap(-50, -10)).toBe(0);
  });
});
