/**
 * The step catalogue (PR 5): the allocator has one emergency step, to the
 * target months, so the catalogue has no one-month or starter step and the
 * 'emergency-full' entry is named plainly 'Emergency Fund'. Allocation texts
 * are shown as the engine writes them (no display relabelling).
 */

import { describe, expect, it } from 'vitest';
import { FINANCIAL_STEPS } from '@/lib/constants/financialSteps';

describe('FINANCIAL_STEPS', () => {
  it('has eight steps in the allocator order, the emergency fund after the match and high-interest debt', () => {
    expect(FINANCIAL_STEPS.map((step) => [step.id, step.priority])).toEqual([
      ['employer-match', 2],
      ['high-interest-debt', 3],
      ['emergency-full', 4],
      ['hsa-max', 5],
      ['roth-ira', 6],
      ['additional-401k', 7],
      ['mega-backdoor', 8],
      ['taxable-investment', 9],
    ]);
  });

  it("names the one emergency step 'Emergency Fund'", () => {
    expect(FINANCIAL_STEPS.find((step) => step.id === 'emergency-full')?.name).toBe('Emergency Fund');
  });

  it('names no starter or one-month step', () => {
    for (const step of FINANCIAL_STEPS) {
      expect(`${step.id} ${step.name}`).not.toMatch(/1-?month|starter|one month/i);
    }
  });
});
