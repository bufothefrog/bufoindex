/**
 * The display text of an allocation item (PR 3, second fix round): the
 * engine's starter step is shown as the starter fund, never as a one-month
 * goal; every other item is shown as the engine wrote it.
 */

import { describe, expect, it } from 'vitest';
import {
  ENGINE_STARTER_FUND_ACCOUNT,
  STARTER_FUND_LABEL,
  STARTER_FUND_REASONING,
  allocationDisplayLabel,
  allocationDisplayText,
} from '@/lib/constants/financialSteps';

describe('allocationDisplayLabel', () => {
  it('shows the engine starter step as the starter emergency fund', () => {
    expect(ENGINE_STARTER_FUND_ACCOUNT).toBe('1-Month Emergency Fund');
    expect(allocationDisplayLabel('1-Month Emergency Fund')).toBe('Starter Emergency Fund');
  });

  it.each(['Emergency Fund', 'Roth IRA', 'Roth 401k', 'Employer 401k Match', 'Taxable Investment', ''])(
    'leaves %j unchanged',
    (name) => {
      expect(allocationDisplayLabel(name)).toBe(name);
    }
  );
});

describe('allocationDisplayText', () => {
  it('replaces the one-month account, reasoning and implementation text of the starter step', () => {
    const text = allocationDisplayText({
      account: '1-Month Emergency Fund',
      reasoning: 'Build basic financial security before optimization. One month of expenses provides essential protection.',
      implementation: 'Save $500 per paycheck to complete 1-month emergency fund',
    });
    expect(text).toEqual({
      account: STARTER_FUND_LABEL,
      reasoning: STARTER_FUND_REASONING,
      implementation: 'Save $500 per paycheck to complete the starter emergency fund',
    });
    expect(JSON.stringify(text)).not.toMatch(/one month|1-month/i);
  });

  it('keeps a partial-progress implementation as written', () => {
    expect(
      allocationDisplayText({
        account: '1-Month Emergency Fund',
        reasoning: 'x',
        implementation: 'Save $100 per paycheck toward emergency fund ($1,900 more needed)',
      }).implementation
    ).toBe('Save $100 per paycheck toward emergency fund ($1,900 more needed)');
  });

  it('returns any other item unchanged', () => {
    const item = { account: 'Roth IRA', reasoning: 'r', implementation: 'i' };
    expect(allocationDisplayText(item)).toEqual(item);
  });
});
