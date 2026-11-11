/**
 * paycheckSummary: the gross-to-take-home breakdown of one paycheck. Taxes
 * are the residual of the gross and take-home pay the visitor typed, after
 * every employee 401(k) deferral (payroll withholds both the traditional and
 * the Roth one before take-home), so the rows always sum to take-home.
 */

import { describe, expect, it } from 'vitest';
import { paycheckSummary } from '@/lib/calculations/paycheckSummary';
import { formatPercent } from '@/lib/format';
import type { PaycheckProfile } from '@/lib/types';
import {
  createBenefitsData,
  createEmployerBenefits,
  createIncomeData,
  createPaycheckProfile,
} from '@/test/factories/test-data-factory';

function profileWith(
  income: Partial<PaycheckProfile['income']>,
  plan: Partial<PaycheckProfile['benefits']['employer401k']>
): PaycheckProfile {
  return createPaycheckProfile({
    income: createIncomeData(income),
    benefits: createBenefitsData({ employer401k: createEmployerBenefits(plan) }),
  });
}

describe('paycheckSummary', () => {
  it('nets a Roth deferral out of the residual', () => {
    // $3,500 gross, $2,000 take-home, 16% Roth, a full match on the first 4%.
    const summary = paycheckSummary(
      profileWith(
        { grossPaycheck: 3500, netPaycheck: 2000 },
        { available: true, traditionalContribution: 0, rothContribution: 0.16, matchPercent: 1, matchLimit: 0.04 }
      )
    );
    expect(summary).toEqual({
      traditional: 0,
      roth: 560, // 3,500 x 16%
      residualTaxes: 940, // 3,500 - 0 - 560 - 2,000
      effectiveRate: 940 / 3500, // taxable pay is the whole gross
      match: 140, // min(560, 3,500 x 4%) x 100%
    });
    expect(formatPercent(summary.effectiveRate, { digits: 1 })).toBe('26.9%');
  });

  it('nets a traditional deferral out of the residual and out of taxable pay', () => {
    const summary = paycheckSummary(
      profileWith(
        { grossPaycheck: 3500, netPaycheck: 2000 },
        { available: true, traditionalContribution: 0.1, rothContribution: 0, matchPercent: 0.5, matchLimit: 0.06 }
      )
    );
    expect(summary.traditional).toBe(350);
    expect(summary.roth).toBe(0);
    expect(summary.residualTaxes).toBe(1150); // 3,500 - 350 - 2,000
    expect(summary.effectiveRate).toBe(1150 / 3150); // taxable 3,500 - 350
    expect(formatPercent(summary.effectiveRate, { digits: 1 })).toBe('36.5%');
    expect(summary.match).toBeCloseTo(105, 10); // min(350, 3,500 x 6% = 210) x 50%
  });

  it('caps the match at the match limit across both deferrals', () => {
    const summary = paycheckSummary(
      profileWith(
        { grossPaycheck: 4000, netPaycheck: 2500 },
        { available: true, traditionalContribution: 0.05, rothContribution: 0.05, matchPercent: 0.5, matchLimit: 0.06 }
      )
    );
    // min(4,000 x 10%, 4,000 x 6%) x 50% = 240 x 50%
    expect(summary.match).toBeCloseTo(120, 10);
    // 4,000 - 200 - 200 - 2,500
    expect(summary.residualTaxes).toBeCloseTo(1100, 10);
  });

  it('ignores the deferral rates when no plan is offered', () => {
    const summary = paycheckSummary(
      profileWith(
        { grossPaycheck: 3000, netPaycheck: 2250 },
        { available: false, traditionalContribution: 0.06, rothContribution: 0.04, matchPercent: 0.5, matchLimit: 0.06 }
      )
    );
    expect(summary).toEqual({ traditional: 0, roth: 0, residualTaxes: 750, effectiveRate: 0.25, match: 0 });
  });

  it('never reports negative taxes', () => {
    const summary = paycheckSummary(
      profileWith({ grossPaycheck: 3000, netPaycheck: 3200 }, { available: false })
    );
    expect(summary.residualTaxes).toBe(0);
    expect(summary.effectiveRate).toBe(0);
  });

  it('reports a zero rate when there is no taxable pay', () => {
    const noPay = paycheckSummary(profileWith({ grossPaycheck: 0, netPaycheck: 0 }, { available: false }));
    expect(noPay.effectiveRate).toBe(0);
    // A 100% traditional deferral leaves nothing taxable.
    const allDeferred = paycheckSummary(
      profileWith({ grossPaycheck: 2000, netPaycheck: 0 }, { available: true, traditionalContribution: 1, rothContribution: 0 })
    );
    expect(allDeferred.residualTaxes).toBe(0);
    expect(allDeferred.effectiveRate).toBe(0);
  });

  it('prints the rate exactly as (rate x 100).toFixed(1) did', () => {
    // The results printed `${(residual / taxable * 100).toFixed(1)}%`.
    for (let taxable = 100; taxable <= 12000; taxable += 113) {
      for (let residual = 0; residual <= taxable; residual += 7) {
        const rate = residual / taxable;
        expect(formatPercent(rate, { digits: 1 })).toBe(`${(rate * 100).toFixed(1)}%`);
      }
    }
  });
});
